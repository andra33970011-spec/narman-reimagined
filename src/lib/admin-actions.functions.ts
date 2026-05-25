// Server functions terproteksi untuk operasi admin sensitif.
// Semua endpoint:
//  - butuh autentikasi (requireSupabaseAuth)
//  - rate-limited per user
//  - validasi input via Zod
//  - mencatat audit_log
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error("Failed to verify role");
  if (!data) throw new Error("Forbidden: super admin only");
}

async function ensureProfileForUser(userId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authError) throw new Error(authError.message);
  const user = authUser.user;
  if (!user) throw new Error("User auth tidak ditemukan");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const username = typeof meta.username === "string" && meta.username.trim()
    ? meta.username.trim().toLowerCase()
    : (user.email ?? "").split("@")[0] || null;
  const nama = typeof meta.nama_lengkap === "string" && meta.nama_lengkap.trim()
    ? meta.nama_lengkap.trim()
    : username ?? "";
  const { error: insertError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    username,
    nama_lengkap: nama,
    no_hp: typeof meta.no_hp === "string" ? meta.no_hp : null,
    nik: typeof meta.nik === "string" ? meta.nik : null,
    desa: typeof meta.desa === "string" ? meta.desa : null,
  }, { onConflict: "id" });
  if (insertError) throw new Error(insertError.message);
}

// Returns: { isSuper: boolean, opdId: string | null }
async function assertAdminOrSuper(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const r = (roles ?? []).map((x) => x.role);
  const isSuper = r.includes("super_admin");
  const isOpd = r.includes("admin_opd");
  if (!isSuper && !isOpd) throw new Error("Forbidden: admin only");
  let opdId: string | null = null;
  if (isOpd) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("opd_id")
      .eq("id", userId)
      .maybeSingle();
    opdId = (prof?.opd_id as string | null) ?? null;
  }
  return { isSuper, opdId };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ============= UBAH ROLE USER =============
const setRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["warga", "admin_opd", "super_admin", "admin_desa", "asn"]),
  opd_id: z.string().uuid().nullable().optional(),
  desa: z.string().trim().min(2).max(120).nullable().optional(),
  nip: z.string().trim().regex(/^\d{8,20}$/).nullable().optional(),
  jabatan: z.string().trim().min(2).max(160).nullable().optional(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "set_role", 30, 60);
    if (!rl.ok) throw new Error("Too many requests, try again later");
    await ensureProfileForUser(data.user_id);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);

    // OPD diisi untuk admin_opd atau asn; selain itu null.
    // Desa diisi untuk admin_desa; selain itu null (kecuali warga yang sudah punya).
    // NIP & jabatan hanya disimpan untuk asn (boleh juga manual via super admin).
    const profileUpdate: {
      opd_id: string | null;
      desa?: string | null;
      nip?: string | null;
      jabatan?: string | null;
    } = {
      opd_id: data.role === "admin_opd" || data.role === "asn" ? (data.opd_id ?? null) : null,
    };
    if (data.role === "admin_desa" || data.desa !== undefined) {
      profileUpdate.desa = data.desa ?? null;
    }
    if (data.role === "asn") {
      if (data.nip !== undefined) profileUpdate.nip = data.nip ?? null;
      if (data.jabatan !== undefined) profileUpdate.jabatan = data.jabatan ?? null;
    } else {
      // Bersihkan field khusus ASN saat role bukan ASN.
      profileUpdate.jabatan = null;
    }
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", data.user_id);
    if (profErr) throw new Error(profErr.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "user.role_changed",
      entitas: "user",
      entitas_id: data.user_id,
      data_sesudah: { role: data.role, opd_id: data.opd_id ?? null } as never,
    });

    return { ok: true };
  });

// ============= ENQUEUE JOB =============
const enqueueSchema = z.object({
  job_type: z.string().min(1).max(64).regex(/^[a-z0-9_.\-]+$/),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const enqueueJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => enqueueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "enqueue_job", 60, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { data: row, error } = await supabaseAdmin
      .from("job_queue")
      .insert({ job_type: data.job_type, payload: data.payload as never, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, job: row };
  });

// ============= EXPORT DATA (BACKUP) =============
const exportSchema = z.object({
  tabel: z.enum([
    "profiles", "user_roles", "opd", "permohonan", "permohonan_riwayat",
    "audit_log", "job_queue", "kategori_layanan", "berita", "layanan_publik",
  ]),
});

export const exportTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => exportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "export", 10, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { data: rows, error } = await supabaseAdmin
      .from(data.tabel)
      .select("*")
      .limit(50000);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "data.export",
      entitas: "table",
      entitas_id: data.tabel,
      data_sesudah: { count: rows?.length ?? 0 } as never,
    });

    return { tabel: data.tabel, rows: rows ?? [], exported_at: new Date().toISOString() };
  });

// ============= LIST USERS DENGAN EMAIL =============
// Mengambil daftar user dari auth.users + profil + role + status, untuk Account Management.
export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "list_users", 60, 60);
    if (!rl.ok) throw new Error("Too many requests");

    // Diagnostic: pastikan service role key tersedia di runtime worker.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
      console.error("[listUsers] Missing env vars on server runtime", {
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      throw new Error(
        "Server tidak terkonfigurasi: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di environment hosting (Cloudflare Workers → Settings → Variables and Secrets).",
      );
    }

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.error("[listUsers] supabaseAdmin.auth.admin.listUsers error:", error);
      throw new Error(`Gagal memanggil Supabase Admin API: ${error.message}`);
    }

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,nama_lengkap,nik,no_hp,opd_id,status,desa,verified_at,jabatan").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);
    const profMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) ?? []);

    return {
      users: list.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        banned_until: (u as unknown as { banned_until?: string | null }).banned_until ?? null,
        nama_lengkap: profMap.get(u.id)?.nama_lengkap ?? "",
        nik: profMap.get(u.id)?.nik ?? null,
        no_hp: profMap.get(u.id)?.no_hp ?? null,
        opd_id: profMap.get(u.id)?.opd_id ?? null,
        desa: (profMap.get(u.id) as { desa?: string | null } | undefined)?.desa ?? null,
        verified_at: (profMap.get(u.id) as { verified_at?: string | null } | undefined)?.verified_at ?? null,
        jabatan: (profMap.get(u.id) as { jabatan?: string | null } | undefined)?.jabatan ?? null,
        status: profMap.get(u.id)?.status ?? "active",
        role: roleMap.get(u.id) ?? "warga",
      })),
    };
  });

// ============= SUSPEND / AKTIFKAN USER =============
const suspendSchema = z.object({
  user_id: z.string().uuid(),
  suspend: z.boolean(),
});

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => suspendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    if (data.user_id === userId) throw new Error("Tidak dapat menonaktifkan akun sendiri");
    const rl = await checkRateLimit(userId, "suspend_user", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    // Ban via auth admin (banned_until far future) + status di profiles
    const banned_until = data.suspend ? "2099-12-31T00:00:00Z" : "none";
    const { error: bErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.suspend ? "8760h" : "none",
    } as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1]);
    if (bErr) throw new Error(bErr.message);

    await supabaseAdmin.from("profiles").update({ status: data.suspend ? "suspended" : "active" }).eq("id", data.user_id);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: data.suspend ? "user.suspended" : "user.activated",
      entitas: "user",
      entitas_id: data.user_id,
      data_sesudah: { banned_until } as never,
    });

    return { ok: true };
  });

// ============= FORCE LOGOUT =============
const userIdSchema = z.object({ user_id: z.string().uuid() });

export const forceSignOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "force_logout", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { error } = await supabaseAdmin.auth.admin.signOut(data.user_id, "global");
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "user.force_logout", entitas: "user", entitas_id: data.user_id,
    });
    return { ok: true };
  });

// ============= KIRIM RESET PASSWORD =============
const resetSchema = z.object({ email: z.string().email() });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "reset_pw", 20, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "user.password_reset_sent", entitas: "user", user_email: data.email,
    });
    return { ok: true };
  });

// ============= OPD CRUD =============
const opdSchema = z.object({
  id: z.string().uuid().optional(),
  nama: z.string().min(2).max(120),
  singkatan: z.string().min(1).max(20),
  kategori: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export const upsertOpd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => opdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "opd_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const payload = { nama: data.nama, singkatan: data.singkatan, kategori: data.kategori };
    if (data.id) {
      const { error } = await supabaseAdmin.from("opd").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("audit_log").insert({ user_id: userId, aksi: "opd.updated", entitas: "opd", entitas_id: data.id, data_sesudah: payload as never });
      return { ok: true, id: data.id };
    } else {
      const { data: row, error } = await supabaseAdmin.from("opd").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("audit_log").insert({ user_id: userId, aksi: "opd.created", entitas: "opd", entitas_id: row.id, data_sesudah: payload as never });
      return { ok: true, id: row.id };
    }
  });

export const deleteOpd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const { error } = await supabaseAdmin.from("opd").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ user_id: userId, aksi: "opd.deleted", entitas: "opd", entitas_id: data.id });
    return { ok: true };
  });

// ============= KATEGORI LAYANAN CRUD =============
const kategoriSchema = z.object({
  id: z.string().uuid().optional(),
  nama: z.string().min(2).max(80),
  sla_hari: z.number().int().min(1).max(365),
  deskripsi: z.string().max(500).optional().nullable(),
  aktif: z.boolean().default(true),
});

export const upsertKategori = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => kategoriSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "kategori_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const payload = {
      nama: data.nama,
      slug: slugify(data.nama),
      sla_hari: data.sla_hari,
      deskripsi: data.deskripsi ?? null,
      aktif: data.aktif,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("kategori_layanan").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("kategori_layanan").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteKategori = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("kategori_layanan").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= BERITA CRUD =============
const beritaSchema = z.object({
  id: z.string().uuid().optional(),
  judul: z.string().min(3).max(200),
  ringkasan: z.string().max(500).optional().nullable(),
  isi: z.string().max(50000).default(""),
  gambar_url: z.string().url().max(1000).optional().nullable(),
  status: z.enum(["draft", "terbit"]).default("draft"),
});

export const upsertBerita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => beritaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "berita_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const payload = {
      judul: data.judul,
      slug: slugify(data.judul) + "-" + Math.random().toString(36).slice(2, 6),
      ringkasan: data.ringkasan ?? null,
      isi: data.isi,
      gambar_url: data.gambar_url ?? null,
      status: data.status,
      published_at: data.status === "terbit" ? new Date().toISOString() : null,
      penulis_id: context.userId,
    };
    if (data.id) {
      const { slug: _omit, ...upd } = payload;
      void _omit;
      const { error } = await supabaseAdmin.from("berita").update(upd).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("berita").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteBerita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("berita").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= LAYANAN PUBLIK CRUD =============
const layananSchema = z.object({
  id: z.string().uuid().optional(),
  judul: z.string().min(3).max(150),
  deskripsi: z.string().max(1000).optional().nullable(),
  ikon: z.string().max(40).optional().nullable(),
  opd_id: z.string().uuid().optional().nullable(),
  persyaratan: z.string().max(5000).optional().nullable(),
  alur: z.string().max(5000).optional().nullable(),
  aktif: z.boolean().default(true),
  urutan: z.number().int().min(0).max(9999).default(0),
  sla_hari: z.number().int().min(1).max(365).default(14),
});

export const upsertLayanan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => layananSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdminOrSuper(context.userId);
    const rl = await checkRateLimit(context.userId, "layanan_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    // Admin OPD wajib pakai opd_id miliknya
    let opdId = data.opd_id ?? null;
    if (!ctx.isSuper) {
      if (!ctx.opdId) throw new Error("Akun admin OPD belum memiliki OPD");
      opdId = ctx.opdId;
      if (data.id) {
        const { data: existing } = await supabaseAdmin
          .from("layanan_publik").select("opd_id").eq("id", data.id).maybeSingle();
        if (!existing || existing.opd_id !== ctx.opdId) {
          throw new Error("Forbidden: layanan bukan milik OPD Anda");
        }
      }
    }

    const payload = {
      judul: data.judul,
      slug: slugify(data.judul),
      deskripsi: data.deskripsi ?? null,
      ikon: data.ikon ?? null,
      opd_id: opdId,
      persyaratan: data.persyaratan ?? null,
      alur: data.alur ?? null,
      aktif: data.aktif,
      urutan: data.urutan,
      sla_hari: data.sla_hari,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("layanan_publik").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("layanan_publik").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteLayanan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await assertAdminOrSuper(context.userId);
    if (!ctx.isSuper) {
      const { data: existing } = await supabaseAdmin
        .from("layanan_publik").select("opd_id").eq("id", data.id).maybeSingle();
      if (!existing || existing.opd_id !== ctx.opdId) {
        throw new Error("Forbidden: layanan bukan milik OPD Anda");
      }
    }
    const { error } = await supabaseAdmin.from("layanan_publik").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= STORAGE EXPLORER =============
const listStorageSchema = z.object({
  prefix: z.string().max(500).default(""),
});

export const listStorageObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listStorageSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "storage_list", 60, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { data: rows, error } = await supabaseAdmin.storage
      .from("berkas-permohonan")
      .list(data.prefix, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error(error.message);

    // Tambahkan signed URL untuk file (bukan folder)
    const items = await Promise.all(
      (rows ?? []).map(async (r) => {
        const isFolder = !r.id;
        let signedUrl: string | null = null;
        if (!isFolder) {
          const fullPath = data.prefix ? `${data.prefix}/${r.name}` : r.name;
          const { data: signed } = await supabaseAdmin.storage
            .from("berkas-permohonan")
            .createSignedUrl(fullPath, 3600);
          signedUrl = signed?.signedUrl ?? null;
        }
        return {
          name: r.name,
          isFolder,
          size: r.metadata?.size ?? null,
          mimetype: r.metadata?.mimetype ?? null,
          updated_at: r.updated_at ?? r.created_at ?? null,
          signedUrl,
        };
      }),
    );
    return { items, prefix: data.prefix };
  });

const deleteStorageSchema = z.object({ path: z.string().min(1).max(1000) });

export const deleteStorageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteStorageSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "storage_delete", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const { error } = await supabaseAdmin.storage.from("berkas-permohonan").remove([data.path]);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "storage.deleted", entitas: "storage", entitas_id: data.path,
    });
    return { ok: true };
  });

// ============= IMPORT DATA (RESTORE) =============
// Menerima payload backup penuh ({ tables: { nama_tabel: rows[] } }) lalu melakukan upsert
// per tabel mengikuti primary key `id`. Tabel di-restore mengikuti urutan dependensi.
const RESTORE_ORDER = [
  "opd",
  "kategori_layanan",
  "layanan_publik",
  "profiles",
  "user_roles",
  "berita",
  "permohonan",
  "permohonan_riwayat",
  "audit_log",
  "job_queue",
] as const;

type RestoreTable = (typeof RESTORE_ORDER)[number];

const importSchema = z.object({
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "import", 5, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const summary: Record<string, { inserted: number; error?: string }> = {};

    for (const tabel of RESTORE_ORDER) {
      const rows = data.tables[tabel];
      if (!rows || rows.length === 0) continue;
      const chunkSize = 500;
      let inserted = 0;
      let lastError: string | undefined;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error, count } = await supabaseAdmin
          .from(tabel as RestoreTable)
          .upsert(chunk as never, { onConflict: "id", count: "exact" });
        if (error) {
          lastError = error.message;
          break;
        }
        inserted += count ?? chunk.length;
      }
      summary[tabel] = lastError ? { inserted, error: lastError } : { inserted };
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "data.import",
      entitas: "backup",
      data_sesudah: summary as never,
    });

    return { ok: true, summary };
  });

// ============= PEJABAT (STRUKTUR PEMERINTAHAN) CRUD =============
const pejabatSchema = z.object({
  id: z.string().uuid().optional(),
  nama: z.string().min(2).max(120),
  jabatan: z.string().min(2).max(80),
  foto_url: z.string().url().max(1000).optional().nullable(),
  urutan: z.number().int().min(0).max(9999).default(0),
  aktif: z.boolean().default(true),
});

export const upsertPejabat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pejabatSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "pejabat_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const payload = {
      nama: data.nama,
      jabatan: data.jabatan,
      foto_url: data.foto_url ?? null,
      urutan: data.urutan,
      aktif: data.aktif,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("pejabat").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("audit_log").insert({
        user_id: context.userId, aksi: "pejabat.updated", entitas: "pejabat", entitas_id: data.id, data_sesudah: payload as never,
      });
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("pejabat").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "pejabat.created", entitas: "pejabat", entitas_id: row.id, data_sesudah: payload as never,
    });
    return { ok: true, id: row.id };
  });

export const deletePejabat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("pejabat").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "pejabat.deleted", entitas: "pejabat", entitas_id: data.id,
    });
    return { ok: true };
  });

// ============= HAPUS PERMOHONAN (SUPER ADMIN) =============
export const deletePermohonan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "permohonan_delete", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    // Ambil dulu untuk membersihkan storage folder pemohon/permohonan
    const { data: row } = await supabaseAdmin
      .from("permohonan")
      .select("id,kode,pemohon_id")
      .eq("id", data.id)
      .maybeSingle();

    // Bersihkan riwayat & rating (tidak ada FK cascade)
    await supabaseAdmin.from("permohonan_riwayat").delete().eq("permohonan_id", data.id);
    await supabaseAdmin.from("permohonan_rating").delete().eq("permohonan_id", data.id);

    // Bersihkan berkas storage milik permohonan ini
    if (row) {
      const folder = `${row.pemohon_id}/${row.id}`;
      const { data: files } = await supabaseAdmin.storage.from("berkas-permohonan").list(folder);
      if (files && files.length > 0) {
        const paths = files.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
        if (paths.length) await supabaseAdmin.storage.from("berkas-permohonan").remove(paths);
      }
    }

    const { error } = await supabaseAdmin.from("permohonan").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "permohonan.deleted", entitas: "permohonan", entitas_id: data.id,
      data_sebelum: row as never,
    });
    return { ok: true };
  });

// ============= HAPUS LAPORAN MASYARAKAT (SUPER ADMIN) =============
export const deleteLaporan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "laporan_delete", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { data: row } = await supabaseAdmin
      .from("laporan_masyarakat").select("*").eq("id", data.id).maybeSingle();

    const { error } = await supabaseAdmin.from("laporan_masyarakat").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "laporan.deleted", entitas: "laporan_masyarakat", entitas_id: data.id,
      data_sebelum: row as never,
    });
    return { ok: true };
  });

// ============= SNAPSHOT / POINT-IN-TIME RECOVERY =============
// Tabel yang ikut di-snapshot
const SNAPSHOT_TABLES = [
  "profiles", "user_roles", "opd", "kategori_layanan", "layanan_publik",
  "berita", "pejabat", "data_terpadu_item", "app_setting",
  "permohonan", "permohonan_riwayat", "permohonan_rating",
  "laporan_masyarakat", "audit_log", "job_queue",
] as const;

type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

async function buildSnapshotPayload() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const t of SNAPSHOT_TABLES) {
    const { data: rows, error } = await supabaseAdmin.from(t).select("*").limit(50000);
    if (error) {
      tables[t] = [];
      counts[t] = 0;
      continue;
    }
    tables[t] = (rows ?? []) as Record<string, unknown>[];
    counts[t] = tables[t].length;
  }
  return { tables, counts };
}

// Buat snapshot manual (super admin)
export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      label: z.string().min(2).max(120).optional(),
      tipe: z.enum(["manual", "auto"]).default("manual"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "snapshot_create", 10, 60);
    if (!rl.ok) throw new Error("Too many requests");

    const { tables, counts } = await buildSnapshotPayload();
    const payloadStr = JSON.stringify(tables);
    const size = new TextEncoder().encode(payloadStr).length;
    const label = data.label ?? `Snapshot ${new Date().toLocaleString("id-ID")}`;

    const { data: row, error } = await supabaseAdmin
      .from("backup_snapshot")
      .insert({
        label,
        tipe: data.tipe,
        size_bytes: size,
        table_counts: counts as never,
        data: { tables } as never,
        created_by: userId,
      })
      .select("id, created_at, label, tipe, size_bytes, table_counts")
      .single();
    if (error) throw new Error(error.message);

    // Retention: simpan max 30 snapshot (drop terlama)
    const { data: all } = await supabaseAdmin
      .from("backup_snapshot")
      .select("id")
      .order("created_at", { ascending: false });
    if (all && all.length > 30) {
      const toDelete = all.slice(30).map((x) => x.id);
      await supabaseAdmin.from("backup_snapshot").delete().in("id", toDelete);
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "snapshot.created", entitas: "backup_snapshot", entitas_id: row.id,
      data_sesudah: { counts, size } as never,
    });
    return { ok: true, snapshot: row };
  });

// List snapshot (tanpa payload data) — untuk PITR picker
export const listSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("backup_snapshot")
      .select("id, created_at, label, tipe, size_bytes, table_counts")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { snapshots: data ?? [] };
  });

// Ambil isi data snapshot tertentu (untuk download lokal)
export const getSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("backup_snapshot")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Snapshot tidak ditemukan");
    return { snapshot: row };
  });

// Restore snapshot ke database (Point-in-Time Recovery)
export const restoreSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "snapshot_restore", 3, 300);
    if (!rl.ok) throw new Error("Too many requests");

    const { data: row, error } = await supabaseAdmin
      .from("backup_snapshot").select("data, label, created_at").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Snapshot tidak ditemukan");

    const payload = (row.data as { tables?: Record<string, Record<string, unknown>[]> }) ?? {};
    const tables = payload.tables ?? {};

    const summary: Record<string, { inserted: number; error?: string }> = {};
    for (const t of RESTORE_ORDER) {
      const rows = tables[t];
      if (!rows || rows.length === 0) continue;
      const chunkSize = 500;
      let inserted = 0;
      let lastError: string | undefined;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upErr, count } = await supabaseAdmin
          .from(t as RestoreTable)
          .upsert(chunk as never, { onConflict: "id", count: "exact" });
        if (upErr) { lastError = upErr.message; break; }
        inserted += count ?? chunk.length;
      }
      summary[t] = lastError ? { inserted, error: lastError } : { inserted };
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "snapshot.restored", entitas: "backup_snapshot", entitas_id: data.id,
      data_sesudah: { summary, restored_to: row.created_at } as never,
    });
    return { ok: true, summary, restored_to: row.created_at, label: row.label };
  });

// Hapus snapshot
export const deleteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("backup_snapshot").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "snapshot.deleted", entitas: "backup_snapshot", entitas_id: data.id,
    });
    return { ok: true };
  });

// ============= STORAGE CLEANUP CONFIG (SUPER ADMIN) =============
export const getStorageCleanupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("app_setting").select("key,value")
      .in("key", ["storage_cleanup_enabled", "storage_cleanup_months"]);
    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    const enabledVal = map.get("storage_cleanup_enabled");
    const monthsVal = map.get("storage_cleanup_months");
    return {
      enabled: enabledVal === true || enabledVal === "true",
      months: Math.max(1, Math.min(120, Number(monthsVal) || 6)),
    };
  });

export const setStorageCleanupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      enabled: z.boolean(),
      months: z.number().int().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await supabaseAdmin.from("app_setting").upsert(
      [
        { key: "storage_cleanup_enabled", value: data.enabled as never },
        { key: "storage_cleanup_months", value: data.months as never },
      ],
      { onConflict: "key" },
    );
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "storage_cleanup.config",
      entitas: "app_setting", data_sesudah: data as never,
    });
    return { ok: true };
  });

export const runStorageCleanupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "storage_cleanup_run", 5, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const { runStorageCleanupServer } = await import("@/routes/api/public/hooks/storage-cleanup");
    const result = (await runStorageCleanupServer()) as Record<string, string | number | boolean>;
    return result;
  });

// ============= WAKIL AMBIL BERKAS (PEMOHON) =============
export const setWakilAmbil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      permohonan_id: z.string().uuid(),
      nama: z.string().trim().min(2).max(120),
      nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit angka"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row, error: getErr } = await supabaseAdmin
      .from("permohonan")
      .select("id,pemohon_id,status")
      .eq("id", data.permohonan_id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!row) throw new Error("Permohonan tidak ditemukan");
    if (row.pemohon_id !== userId) throw new Error("Bukan permohonan Anda");
    if (row.status !== "selesai") throw new Error("Hanya berlaku untuk permohonan berstatus selesai");

    const { error } = await supabaseAdmin
      .from("permohonan")
      .update({
        wakil_ambil_nama: data.nama,
        wakil_ambil_nik: data.nik,
      })
      .eq("id", data.permohonan_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "permohonan.wakil_ambil_set",
      entitas: "permohonan", entitas_id: data.permohonan_id,
      data_sesudah: { nama: data.nama, nik: data.nik } as never,
    });
    return { ok: true };
  });

export const clearWakilAmbil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ permohonan_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row } = await supabaseAdmin
      .from("permohonan").select("pemohon_id").eq("id", data.permohonan_id).maybeSingle();
    if (!row || row.pemohon_id !== userId) throw new Error("Bukan permohonan Anda");
    const { error } = await supabaseAdmin
      .from("permohonan")
      .update({ wakil_ambil_nama: null, wakil_ambil_nik: null })
      .eq("id", data.permohonan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============= VERIFIKASI AKUN STAFF (admin_opd / admin_desa) OLEH SUPER ADMIN =============
const verifyStaffSchema = z.object({
  user_id: z.string().uuid(),
  verified: z.boolean(),
});

export const setUserVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    const rl = await checkRateLimit(userId, "verify_staff", 60, 60);
    if (!rl.ok) throw new Error("Too many requests");
    await ensureProfileForUser(data.user_id);

    const patch = data.verified
      ? { verified_at: new Date().toISOString(), verified_by: userId }
      : { verified_at: null, verified_by: null };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: data.verified ? "user.verified" : "user.unverified",
      entitas: "profile",
      entitas_id: data.user_id,
    });
    return { ok: true };
  });


// ============= MASTER DESA (SUPER ADMIN) =============
const desaSchema = z.object({
  id: z.string().uuid().optional(),
  nama: z.string().trim().min(2).max(120),
  kecamatan: z.string().trim().max(120).optional().nullable(),
  aktif: z.boolean().default(true),
});

export const upsertDesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => desaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const rl = await checkRateLimit(context.userId, "desa_write", 30, 60);
    if (!rl.ok) throw new Error("Too many requests");
    const payload = { nama: data.nama, kecamatan: data.kecamatan ?? null, aktif: data.aktif };
    if (data.id) {
      const { error } = await supabaseAdmin.from("desa").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("desa").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "desa.created", entitas: "desa", entitas_id: row.id, data_sesudah: payload as never,
    });
    return { ok: true, id: row.id };
  });

export const deleteDesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("desa").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "desa.deleted", entitas: "desa", entitas_id: data.id,
    });
    return { ok: true };
  });

// ============= TOGGLE SETTING SEDERHANA (SUPER ADMIN) =============
const ALLOWED_SETTING_KEYS = new Set([
  "permohonan_require_verification",
  "show_opd_directory",
]);

export const setSiteToggle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      key: z.string().min(2).max(64),
      value: z.record(z.string(), z.unknown()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (!ALLOWED_SETTING_KEYS.has(data.key)) throw new Error("Key tidak diizinkan");
    const { error } = await supabaseAdmin.from("app_setting").upsert(
      { key: data.key, value: data.value as never },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId, aksi: "site.setting_changed", entitas: "app_setting",
      entitas_id: data.key, data_sesudah: data.value as never,
    });
    return { ok: true };
  });

// ============= HAPUS USER (super admin) =============
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertSuperAdmin(userId);
    if (data.user_id === userId) throw new Error("Tidak dapat menghapus akun sendiri");
    const rl = await checkRateLimit(userId, "delete_user", 20, 60);
    if (!rl.ok) throw new Error("Too many requests");

    // Tolak hapus super admin lain (didukung trigger DB juga).
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.user_id);
    if ((roles ?? []).some((r) => r.role === "super_admin")) {
      throw new Error("Tidak dapat menghapus akun Super Admin");
    }

    // Hapus auth user — cascade akan menghapus data terkait yang terhubung lewat FK.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    // Bersihkan profile & user_roles eksplisit (jika ada FK terputus).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId, aksi: "user.deleted", entitas: "user", entitas_id: data.user_id,
    });
    return { ok: true };
  });
