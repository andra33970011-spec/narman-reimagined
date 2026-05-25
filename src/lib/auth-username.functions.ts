// Login/Daftar dengan USERNAME (email opsional - mode dev).
// Strategi: simpan username di profiles.username; email auth = username@local.narman jika tidak diisi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

const USERNAME_DOMAIN = "local.narman";
const usernameSchema = z.string().trim().min(3).max(40).regex(/^[a-z0-9_.-]+$/, "Username hanya huruf kecil, angka, . _ -");

export const resolveUsernameEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const u = data.username.toLowerCase();
    // Jika user input email langsung, kembalikan apa adanya.
    if (u.includes("@")) return { email: u };
    const rl = await checkRateLimit(`uname:${u}`, "resolve_username", 30, 60);
    if (!rl.ok) throw new Error("Terlalu banyak percobaan, coba lagi nanti");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", u)
      .maybeSingle();
    if (!prof) {
      // Fallback: coba sebagai local-part email shadow
      return { email: `${u}@${USERNAME_DOMAIN}` };
    }
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(prof.id);
    return { email: au.user?.email ?? `${u}@${USERNAME_DOMAIN}` };
  });

const signupSchema = z.object({
  username: usernameSchema,
  password: z.string().min(6).max(72),
  email: z.string().trim().email().max(255).optional().nullable(),
  nama_lengkap: z.string().trim().min(2).max(120),
  no_hp: z.string().trim().regex(/^(\+62|62|0)8\d{7,12}$/).optional().nullable(),
  nik: z.string().trim().regex(/^\d{16}$/).optional().nullable(),
  desa: z.string().trim().min(2).max(120).optional().nullable(),
  opd_id: z.string().uuid().optional().nullable(),
  nip: z.string().trim().regex(/^\d{8,20}$/).optional().nullable(),
  jabatan: z.string().trim().min(2).max(160).optional().nullable(),
  requested_role: z.enum(["warga", "admin_desa", "admin_opd", "asn"]),
});

export const signupWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const u = data.username.toLowerCase();
    const rl = await checkRateLimit(`signup:${u}`, "signup", 5, 300);
    if (!rl.ok) throw new Error("Terlalu banyak pendaftaran, coba lagi nanti");

    // Cek konflik username
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("id").ilike("username", u).maybeSingle();
    if (existing) throw new Error("Username sudah dipakai");

    const email = (data.email && data.email.trim().length > 0) ? data.email : `${u}@${USERNAME_DOMAIN}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: u,
        nama_lengkap: data.nama_lengkap,
        no_hp: data.no_hp ?? null,
        nik: data.requested_role === "warga" ? (data.nik ?? null) : null,
        desa: data.requested_role === "warga" || data.requested_role === "admin_desa" ? (data.desa ?? null) : null,
      },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    // Upsert profile: jangan bergantung pada trigger auth.users karena bisa tidak aktif
    // di lingkungan hosted; tanpa baris profiles, verifikasi/manajemen user kosong.
    const profileUpdate: {
      id: string;
      username: string;
      nama_lengkap: string;
      no_hp: string | null;
      nik?: string | null;
      desa?: string | null;
      opd_id?: string | null;
      nip?: string | null;
      jabatan?: string | null;
    } = {
      id: userId,
      username: u,
      nama_lengkap: data.nama_lengkap,
      no_hp: data.no_hp ?? null,
    };
    if (data.requested_role === "warga") {
      profileUpdate.nik = data.nik ?? null;
      profileUpdate.desa = data.desa ?? null;
    }
    if (data.requested_role === "admin_desa") profileUpdate.desa = data.desa ?? null;
    if (data.requested_role === "admin_opd") profileUpdate.opd_id = data.opd_id ?? null;
    if (data.requested_role === "asn") {
      profileUpdate.opd_id = data.opd_id ?? null;
      profileUpdate.nip = data.nip ?? null;
      profileUpdate.jabatan = data.jabatan ?? null;
    }
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "id" });
    if (profileErr) throw new Error(profileErr.message);

    // Untuk staf (non-warga), set role tanpa verified_at. Trigger super_admin protection tetap aktif.
    if (data.requested_role !== "warga") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.requested_role });
      if (roleErr) throw new Error(roleErr.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "user.registered",
      entitas: "user",
      entitas_id: userId,
      data_sesudah: { username: u, requested_role: data.requested_role } as never,
    });

    return { ok: true, email, username: u };
  });
