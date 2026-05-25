// Verifikasi akun warga oleh Admin Desa.
// Token sekali pakai (UUID) di-encode jadi QR. Admin desa men-scan QR,
// melihat data warga, lalu menekan tombol verifikasi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function getDesa(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("desa").eq("id", userId).maybeSingle();
  return (data?.desa as string | null) ?? null;
}

async function ensureProfilesForUsers(userIds: string[]) {
  if (userIds.length === 0) return;
  const { data: existing, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("id", userIds);
  if (error) throw new Error(error.message);
  const existingIds = new Set((existing ?? []).map((p) => p.id as string));
  const missingIds = userIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return;

  const rows = await Promise.all(missingIds.map(async (id) => {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authError || !authUser.user) return null;
    const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>;
    const username = typeof meta.username === "string" && meta.username.trim()
      ? meta.username.trim().toLowerCase()
      : (authUser.user.email ?? "").split("@")[0] || null;
    return {
      id,
      username,
      nama_lengkap: typeof meta.nama_lengkap === "string" && meta.nama_lengkap.trim() ? meta.nama_lengkap.trim() : username ?? "",
      no_hp: typeof meta.no_hp === "string" ? meta.no_hp : null,
      nik: typeof meta.nik === "string" ? meta.nik : null,
      desa: typeof meta.desa === "string" ? meta.desa : null,
    };
  }));
  const payload = rows.filter((row): row is NonNullable<typeof row> => row !== null);
  if (payload.length > 0) {
    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(payload, { onConflict: "id" });
    if (upsertError) throw new Error(upsertError.message);
  }
}

// ---- Konfigurasi Verifikasi Desa (super admin) ----
type VerifConfig = {
  enabled: boolean;
  mode: "block_login" | "block_permohonan" | "badge_only";
};

export const getVerificationConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("app_setting")
      .select("value")
      .eq("key", "village_verification")
      .maybeSingle();
    const v = (data?.value as VerifConfig | null) ?? { enabled: false, mode: "badge_only" };
    return v;
  });

const setConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["block_login", "block_permohonan", "badge_only"]),
});

export const setVerificationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => setConfigSchema.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    if (!roles.includes("super_admin")) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("app_setting")
      .upsert({ key: "village_verification", value: data as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Token QR untuk warga ----
// Token akan diregenerasi otomatis bila: belum ada, sudah dipakai, atau kedaluwarsa.
// Bila profil sudah verified, tidak menerbitkan token (warga tidak butuh QR lagi).
export const getMyVerificationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("verified_at")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.verified_at) {
      return { token: "", used: true, verified: true };
    }

    const { data: existing } = await supabaseAdmin
      .from("verification_token")
      .select("token,used_at,expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    const now = Date.now();
    const stillValid =
      existing && !existing.used_at && new Date(existing.expires_at).getTime() > now;
    if (stillValid) {
      return { token: existing!.token as string, used: false, verified: false };
    }

    // generate token baru (regenerasi bila habis pakai / kedaluwarsa)
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("verification_token")
      .upsert(
        {
          user_id: userId,
          token,
          used_at: null,
          used_by: null,
          expires_at: new Date(now + 30 * 86400_000).toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { token, used: false, verified: false };
  });

// ---- Lookup data warga dari token (admin_desa / super_admin) ----
const tokenSchema = z.object({ token: z.string().min(8).max(64).regex(/^[a-f0-9]+$/i) });

export const lookupVerificationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data, context }) => {
    const roles = await getRoles(context.userId);
    const isSuper = roles.includes("super_admin");
    const isDesa = roles.includes("admin_desa");
    if (!isSuper && !isDesa) throw new Error("Forbidden");

    const { data: tok } = await supabaseAdmin
      .from("verification_token")
      .select("user_id,used_at,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Token tidak ditemukan");
    if (new Date(tok.expires_at as string) < new Date()) throw new Error("Token sudah kedaluwarsa");

    const [{ data: prof }, { data: authUser }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,nama_lengkap,nik,no_hp,desa,verified_at,verified_by").eq("id", tok.user_id).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(tok.user_id as string),
    ]);
    if (!prof) throw new Error("Profil tidak ditemukan");

    if (isDesa && !isSuper) {
      const myDesa = await getDesa(context.userId);
      if (!myDesa || prof.desa !== myDesa) {
        throw new Error("Warga ini berada di desa berbeda dari penugasan Anda");
      }
    }
    return {
      profile: { ...prof, email: authUser?.user?.email ?? "" },
      already_verified: !!prof.verified_at,
      already_used: !!tok.used_at,
    };
  });

// ---- Verifikasi warga (admin_desa / super_admin) ----
export const verifyWargaByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => tokenSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const roles = await getRoles(userId);
    const isSuper = roles.includes("super_admin");
    const isDesa = roles.includes("admin_desa");
    if (!isSuper && !isDesa) throw new Error("Forbidden");

    const { data: tok } = await supabaseAdmin
      .from("verification_token")
      .select("user_id,used_at,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Token tidak ditemukan");
    if (new Date(tok.expires_at as string) < new Date()) throw new Error("Token sudah kedaluwarsa");
    if (tok.used_at) throw new Error("Token sudah pernah digunakan");

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("desa,verified_at").eq("id", tok.user_id).maybeSingle();
    if (!prof) throw new Error("Profil tidak ditemukan");
    if (prof.verified_at) throw new Error("Akun ini sudah diverifikasi");

    if (isDesa && !isSuper) {
      const myDesa = await getDesa(userId);
      if (!myDesa || prof.desa !== myDesa) throw new Error("Warga di desa berbeda");
    }

    const now = new Date().toISOString();
    const { error: e1 } = await supabaseAdmin
      .from("profiles")
      .update({ verified_at: now, verified_by: userId })
      .eq("id", tok.user_id);
    if (e1) throw new Error(e1.message);

    await supabaseAdmin
      .from("verification_token")
      .update({ used_at: now, used_by: userId })
      .eq("token", data.token);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "warga.verified",
      entitas: "profile",
      entitas_id: tok.user_id as string,
    });
    return { ok: true };
  });

// ---- Daftar warga di desa admin (untuk dashboard admin_desa) ----
type WargaRow = {
  id: string;
  nama_lengkap: string | null;
  nik: string | null;
  no_hp: string | null;
  desa: string | null;
  verified_at: string | null;
  created_at: string;
};

export const listWargaSedesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: WargaRow[] }> => {
    const roles = await getRoles(context.userId);
    const isSuper = roles.includes("super_admin");
    const isDesa = roles.includes("admin_desa");
    if (!isSuper && !isDesa) throw new Error("Forbidden");

    // Hanya warga (bukan staff) yang relevan untuk verifikasi desa.
    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin_opd", "admin_desa", "super_admin", "asn"]);
    const staffIds = new Set((staffRoles ?? []).map((r) => r.user_id as string));

    let query = supabaseAdmin
      .from("profiles")
      .select("id,nama_lengkap,nik,no_hp,desa,verified_at,created_at");
    if (isDesa && !isSuper) {
      const myDesa = await getDesa(context.userId);
      if (!myDesa) return { rows: [] };
      query = query.eq("desa", myDesa);
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as WargaRow[]).filter((r) => !staffIds.has(r.id));
    return { rows };
  });

// ---- Daftar staff (admin_opd / admin_desa / asn) untuk verifikasi oleh super_admin ----
type StaffRow = {
  id: string;
  email: string;
  nama_lengkap: string | null;
  role: "admin_opd" | "admin_desa" | "asn";
  desa: string | null;
  opd_id: string | null;
  opd_nama: string | null;
  nip: string | null;
  jabatan: string | null;
  verified_at: string | null;
  created_at: string;
};

export const listPendingStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: StaffRow[] }> => {
    const roles = await getRoles(context.userId);
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["admin_opd", "admin_desa", "asn"]);
    const ids = (roleRows ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) return { rows: [] };
    const roleMap = new Map((roleRows ?? []).map((r) => [r.user_id as string, r.role as "admin_opd" | "admin_desa" | "asn"]));
    await ensureProfilesForUsers(ids);

    const [{ data: profs }, { data: list }, { data: opds }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,nama_lengkap,desa,opd_id,nip,jabatan,verified_at,created_at").in("id", ids),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from("opd").select("id,nama,singkatan"),
    ]);
    const emailMap = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const opdMap = new Map(((opds ?? []) as { id: string; nama: string; singkatan: string }[]).map((o) => [o.id, `${o.singkatan} — ${o.nama}`]));
    const rows: StaffRow[] = (profs ?? []).map((p) => ({
      id: p.id as string,
      email: emailMap.get(p.id as string) ?? "",
      nama_lengkap: (p.nama_lengkap as string | null) ?? null,
      role: roleMap.get(p.id as string) ?? "admin_opd",
      desa: (p.desa as string | null) ?? null,
      opd_id: (p.opd_id as string | null) ?? null,
      opd_nama: p.opd_id ? opdMap.get(p.opd_id as string) ?? null : null,
      nip: (p.nip as string | null) ?? null,
      jabatan: (p.jabatan as string | null) ?? null,
      verified_at: (p.verified_at as string | null) ?? null,
      created_at: p.created_at as string,
    }));
    rows.sort((a, b) => {
      if (!!a.verified_at !== !!b.verified_at) return a.verified_at ? 1 : -1;
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return (a.nama_lengkap ?? "").localeCompare(b.nama_lengkap ?? "");
    });
    return { rows };
  });

// ---- Detail verifikasi untuk warga (siapa & kapan) ----
export const getMyVerificationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("verified_at,verified_by")
      .eq("id", userId)
      .maybeSingle();
    if (!prof?.verified_at) return { verified_at: null, verifier: null };
    let verifier: { id: string; nama_lengkap: string | null; email: string; role: string | null } | null = null;
    if (prof.verified_by) {
      const [{ data: vp }, vu, { data: vr }] = await Promise.all([
        supabaseAdmin.from("profiles").select("nama_lengkap").eq("id", prof.verified_by).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(prof.verified_by as string),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", prof.verified_by).limit(1).maybeSingle(),
      ]);
      verifier = {
        id: prof.verified_by as string,
        nama_lengkap: (vp?.nama_lengkap as string | null) ?? null,
        email: vu?.data?.user?.email ?? "",
        role: (vr?.role as string | null) ?? null,
      };
    }
    return { verified_at: prof.verified_at as string, verifier };
  });

// ---- Log verifikasi (super_admin) ----
type LogRow = {
  id: string;
  created_at: string;
  aksi: string;
  actor: { id: string | null; nama: string | null; email: string };
  target: { id: string; nama: string | null; email: string };
};

export const listVerificationLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: LogRow[] }> => {
    const roles = await getRoles(context.userId);
    if (!roles.includes("super_admin")) throw new Error("Forbidden");

    const { data: rows, error } = await supabaseAdmin
      .from("audit_log")
      .select("id,created_at,aksi,user_id,user_email,entitas_id")
      .in("aksi", ["user.verified", "user.unverified", "warga.verified"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    (rows ?? []).forEach((r) => {
      if (r.user_id) ids.add(r.user_id as string);
      if (r.entitas_id) ids.add(r.entitas_id as string);
    });
    const idList = Array.from(ids);
    const profsRes = idList.length
      ? await supabaseAdmin.from("profiles").select("id,nama_lengkap").in("id", idList)
      : { data: [] as { id: string; nama_lengkap: string | null }[] };
    const listUsers = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const nameMap = new Map<string, string | null>();
    ((profsRes.data ?? []) as { id: string; nama_lengkap: string | null }[]).forEach((p) => nameMap.set(p.id, p.nama_lengkap));
    const emailMap = new Map((listUsers?.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    return {
      rows: (rows ?? []).map((r) => ({
        id: r.id as string,
        created_at: r.created_at as string,
        aksi: r.aksi as string,
        actor: {
          id: (r.user_id as string | null) ?? null,
          nama: r.user_id ? nameMap.get(r.user_id as string) ?? null : null,
          email: r.user_id ? emailMap.get(r.user_id as string) ?? (r.user_email as string | null) ?? "" : ((r.user_email as string | null) ?? ""),
        },
        target: {
          id: (r.entitas_id as string) ?? "",
          nama: r.entitas_id ? nameMap.get(r.entitas_id as string) ?? null : null,
          email: r.entitas_id ? emailMap.get(r.entitas_id as string) ?? "" : "",
        },
      })),
    };
  });

// ---- Admin Desa: update data warga terverifikasi ----
const updateWargaSchema = z.object({
  user_id: z.string().uuid(),
  nama_lengkap: z.string().trim().min(1).max(120),
  nik: z.string().trim().regex(/^\d{16}$/).nullable().optional(),
  no_hp: z.string().trim().min(6).max(20).nullable().optional(),
  desa: z.string().trim().min(2).max(120).nullable().optional(),
});

export const adminUpdateWarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateWargaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const roles = await getRoles(userId);
    const isSuper = roles.includes("super_admin");
    const isDesa = roles.includes("admin_desa");
    if (!isSuper && !isDesa) throw new Error("Forbidden");

    const { data: target } = await supabaseAdmin
      .from("profiles").select("desa").eq("id", data.user_id).maybeSingle();
    if (!target) throw new Error("Profil tidak ditemukan");

    if (isDesa && !isSuper) {
      const myDesa = await getDesa(userId);
      if (!myDesa || target.desa !== myDesa) throw new Error("Warga di luar desa Anda");
    }

    const patch: { nama_lengkap: string; nik: string | null; no_hp: string | null; desa?: string | null } = {
      nama_lengkap: data.nama_lengkap,
      nik: data.nik ?? null,
      no_hp: data.no_hp ?? null,
    };
    if (isSuper) patch.desa = data.desa ?? null;

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "warga.updated", entitas: "profile",
      entitas_id: data.user_id, data_sesudah: patch as never,
    });
    return { ok: true };
  });

// ---- Admin Desa: hapus akun warga (mis. pindah desa) dengan alasan ----
const deleteWargaSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export const adminDeleteWarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => deleteWargaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const roles = await getRoles(userId);
    const isSuper = roles.includes("super_admin");
    const isDesa = roles.includes("admin_desa");
    if (!isSuper && !isDesa) throw new Error("Forbidden");
    if (data.user_id === userId) throw new Error("Tidak dapat menghapus akun sendiri");

    // Pastikan target adalah warga (bukan staff) dan di desa admin (kecuali super).
    const [{ data: target }, { data: targetRoles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("desa,nama_lengkap").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id),
    ]);
    if (!target) throw new Error("Profil tidak ditemukan");
    const tRoles = (targetRoles ?? []).map((r) => r.role as string);
    if (tRoles.some((r) => ["super_admin", "admin_opd", "admin_desa", "asn"].includes(r))) {
      throw new Error("Tidak dapat menghapus akun staff melalui menu ini");
    }
    if (isDesa && !isSuper) {
      const myDesa = await getDesa(userId);
      if (!myDesa || target.desa !== myDesa) throw new Error("Warga di luar desa Anda");
    }

    // Audit dulu, lalu hapus.
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "warga.deleted",
      entitas: "user",
      entitas_id: data.user_id,
      data_sebelum: { nama_lengkap: target.nama_lengkap, desa: target.desa } as never,
      data_sesudah: { reason: data.reason } as never,
    });

    // Bersihkan data terkait (tidak ada FK eksplisit).
    await supabaseAdmin.from("verification_token").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
