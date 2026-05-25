// Modul ASN: Kantor QR + Absensi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Haversine distance in meters
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function userRolesAndOpd(userId: string) {
  const [{ data: roles }, { data: prof }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("opd_id").eq("id", userId).maybeSingle(),
  ]);
  const r = (roles ?? []).map((x) => x.role);
  return {
    isSuper: r.includes("super_admin"),
    isAdminOpd: r.includes("admin_opd"),
    isAsn: r.includes("asn"),
    opdId: (prof?.opd_id as string | null) ?? null,
  };
}

// ============= GENERATE / ROTATE QR KANTOR =============
export const regenerateKantorQR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      opd_id: z.string().uuid(),
      label: z.string().max(120).optional(),
      lokasi: z.string().max(255).optional(),
      lat: z.number().min(-90).max(90).optional().nullable(),
      lng: z.number().min(-180).max(180).optional().nullable(),
      radius_m: z.number().int().min(10).max(5000).optional(),
      rotate: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ctx = await userRolesAndOpd(userId);
    if (!(ctx.isSuper || (ctx.isAdminOpd && ctx.opdId === data.opd_id))) {
      throw new Error("Forbidden");
    }
    const rl = await checkRateLimit(userId, "qr_regen", 20, 60);
    if (!rl.ok) throw new Error("Terlalu banyak permintaan");

    const { data: existing } = await supabaseAdmin
      .from("kantor_qr").select("id,token").eq("opd_id", data.opd_id).maybeSingle();
    const token = existing && !data.rotate ? existing.token : randomToken(24);
    const patch = {
      token,
      aktif: true,
      ...(data.label !== undefined ? { label: data.label ?? null } : {}),
      ...(data.lokasi !== undefined ? { lokasi: data.lokasi ?? null } : {}),
      ...(data.lat !== undefined ? { lat: data.lat } : {}),
      ...(data.lng !== undefined ? { lng: data.lng } : {}),
      ...(data.radius_m !== undefined ? { radius_m: data.radius_m } : {}),
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("kantor_qr").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("kantor_qr").insert({ opd_id: data.opd_id, ...patch });
      if (error) throw new Error(error.message);
    }

    return { ok: true, token };
  });

// ============= LIST KANTOR QR (super admin) =============
export const listKantorQR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userRolesAndOpd(context.userId);
    if (!ctx.isSuper) throw new Error("Forbidden");
    const { data, error } = await supabaseAdmin
      .from("kantor_qr")
      .select("id,opd_id,token,label,lokasi,lat,lng,radius_m,aktif,updated_at, opd:opd!opd_id(nama,singkatan)");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// ============= RESOLVE QR TOKEN =============
export const resolveKantorQR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("kantor_qr")
      .select("id,opd_id,label,lokasi,lat,lng,radius_m,aktif, opd:opd!opd_id(nama,singkatan)")
      .eq("token", data.token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.aktif) throw new Error("QR tidak valid / nonaktif");
    return row;
  });

// ============= SUBMIT ABSENSI =============
export const submitAbsensi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      token: z.string().min(8).max(80),
      tipe: z.enum(["masuk", "pulang"]),
      lat: z.number(),
      lng: z.number(),
      device_info: z.string().max(200).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const rl = await checkRateLimit(userId, "absensi", 10, 60);
    if (!rl.ok) throw new Error("Terlalu banyak percobaan absen");

    const ctx = await userRolesAndOpd(userId);
    if (!ctx.isAsn) throw new Error("Hanya ASN terdaftar yang dapat absen");
    if (!ctx.opdId) throw new Error("Profil Anda belum terhubung ke OPD");

    const { data: qr, error: qErr } = await supabaseAdmin
      .from("kantor_qr").select("opd_id,aktif,lat,lng,radius_m").eq("token", data.token).maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!qr || !qr.aktif) throw new Error("QR tidak valid");
    if (qr.opd_id !== ctx.opdId) throw new Error("QR ini bukan untuk kantor OPD Anda");

    // Validasi jarak terhadap koordinat kantor yang ditetapkan superadmin
    if (qr.lat !== null && qr.lng !== null) {
      const radius = (qr.radius_m as number | null) ?? 100;
      const dist = haversineMeters(Number(qr.lat), Number(qr.lng), data.lat, data.lng);
      if (dist > radius) {
        throw new Error(`Absen gagal. Anda berada ${Math.round(dist)} m dari kantor (maks ${radius} m). Mendekatlah ke titik kantor lalu coba lagi.`);
      }
    } else {
      throw new Error("Koordinat kantor belum ditetapkan superadmin. Hubungi admin.");
    }

    // Cegah duplikat masuk/pulang di hari yang sama (UTC date)
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const { data: dup } = await supabaseAdmin
      .from("absensi_asn").select("id")
      .eq("user_id", userId).eq("opd_id", qr.opd_id).eq("tipe", data.tipe)
      .gte("waktu", today.toISOString()).maybeSingle();
    if (dup) throw new Error(`Anda sudah absen ${data.tipe} hari ini`);

    const { error: insErr } = await supabaseAdmin.from("absensi_asn").insert({
      user_id: userId,
      opd_id: qr.opd_id,
      tipe: data.tipe,
      lat: data.lat,
      lng: data.lng,
      device_info: data.device_info ?? null,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

// ============= LIST ABSENSI =============
export const listAbsensiSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("absensi_asn")
      .select("id,tipe,waktu,opd:opd!opd_id(nama,singkatan)")
      .eq("user_id", context.userId)
      .order("waktu", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listAbsensiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      opd_id: z.string().uuid().optional().nullable(),
      from: z.string().optional().nullable(),
      to: z.string().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userRolesAndOpd(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd) throw new Error("Forbidden");
    let q = supabaseAdmin
      .from("absensi_asn")
      .select("id,user_id,tipe,waktu,lat,lng,opd_id, opd:opd!opd_id(nama,singkatan), profile:profiles!user_id(nama_lengkap,nip,jabatan)")
      .order("waktu", { ascending: false })
      .limit(500);
    const filterOpd = ctx.isSuper ? (data.opd_id ?? null) : ctx.opdId;
    if (filterOpd) q = q.eq("opd_id", filterOpd);
    if (data.from) q = q.gte("waktu", data.from);
    if (data.to) q = q.lte("waktu", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
