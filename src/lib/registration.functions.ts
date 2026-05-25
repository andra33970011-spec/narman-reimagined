// Registrasi peran staf (admin_desa / admin_opd / asn) setelah signup.
// User signup membuat baris profile + role 'warga' melalui trigger.
// Setelah itu client memanggil applyStaffRegistration untuk:
//  - mengganti role 'warga' menjadi role yang diminta
//  - mengisi data tambahan (opd_id / desa / nip / jabatan)
//  - profile.verified_at SENGAJA dikosongkan agar super admin yang verifikasi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  requested_role: z.enum(["admin_desa", "admin_opd", "asn"]),
  opd_id: z.string().uuid().nullable().optional(),
  desa: z.string().trim().min(2).max(120).nullable().optional(),
  nip: z.string().trim().regex(/^\d{8,20}$/, "NIP 8-20 digit").nullable().optional(),
  jabatan: z.string().trim().min(2).max(160).nullable().optional(),
});

export const applyStaffRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Validasi syarat per role
    if (data.requested_role === "admin_desa" && !data.desa) {
      throw new Error("Desa wajib diisi untuk Admin Desa");
    }
    if (data.requested_role === "admin_opd" && !data.opd_id) {
      throw new Error("OPD wajib dipilih untuk Admin OPD");
    }
    if (data.requested_role === "asn") {
      if (!data.opd_id) throw new Error("OPD/Instansi wajib dipilih untuk ASN");
      if (!data.nip) throw new Error("NIP wajib diisi untuk ASN");
      if (!data.jabatan) throw new Error("Jabatan wajib diisi untuk ASN");
    }

    // Cegah eskalasi: hanya jalan bila user saat ini belum menjadi staf terverifikasi.
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const existingRoles = (existing ?? []).map((r) => r.role as string);
    if (existingRoles.some((r) => ["super_admin", "admin_opd", "admin_desa", "asn"].includes(r))) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("verified_at")
        .eq("id", userId)
        .maybeSingle();
      if (prof?.verified_at) {
        throw new Error("Akun Anda sudah terdaftar dengan peran staf yang terverifikasi.");
      }
    }

    // Hapus role 'warga' & role staf lain (rebrand), lalu insert role baru.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: rerr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.requested_role });
    if (rerr) throw new Error(rerr.message);

    // Update profile (pastikan verified_at null sampai super admin verifikasi).
    const patch: {
      verified_at: null;
      verified_by: null;
      desa?: string | null;
      opd_id?: string | null;
      nip?: string | null;
      jabatan?: string | null;
    } = { verified_at: null, verified_by: null };
    if (data.requested_role === "admin_desa") patch.desa = data.desa ?? null;
    if (data.requested_role === "admin_opd" || data.requested_role === "asn") {
      patch.opd_id = data.opd_id ?? null;
    }
    if (data.requested_role === "asn") {
      patch.nip = data.nip ?? null;
      patch.jabatan = data.jabatan ?? null;
    }
    const { error: perr } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (perr) throw new Error(perr.message);

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "staff.registration_requested",
      entitas: "profile",
      entitas_id: userId,
      data_sesudah: { requested_role: data.requested_role } as never,
    });

    return { ok: true };
  });

// Daftar OPD publik untuk dropdown registrasi (read-only nama+singkatan)
export const listOpdPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("opd")
    .select("id,nama,singkatan")
    .order("nama");
  if (error) throw new Error(error.message);
  return { rows: data ?? [] };
});
