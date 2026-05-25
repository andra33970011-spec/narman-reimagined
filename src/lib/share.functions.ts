// Modul Berbagi Data: paket, target, lampiran, approval, komentar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";
import { sendPushToUsers, resolveTargetUserIds } from "./push.server";

async function userCtx(userId: string) {
  const [{ data: roles }, { data: prof }, { data: pej }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("opd_id,nama_lengkap").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("pejabat").select("id,is_pimpinan,level").eq("user_id", userId).eq("aktif", true).maybeSingle(),
  ]);
  const r = (roles ?? []).map((x) => x.role);
  return {
    isSuper: r.includes("super_admin"),
    isAdminOpd: r.includes("admin_opd"),
    isAsn: r.includes("asn"),
    isPimpinan: !!pej?.is_pimpinan,
    pejabat: pej,
    opdId: (prof?.opd_id as string | null) ?? null,
    nama: prof?.nama_lengkap ?? "",
  };
}

// Helper: notifikasi penerima saat paket benar-benar terkirim.
async function notifyRecipients(paketId: string, judul: string, kode: string | null) {
  try {
    const userIds = await resolveTargetUserIds(paketId);
    if (userIds.length === 0) return;
    await sendPushToUsers(userIds, {
      title: "Paket berbagi baru",
      body: `${kode ? `[${kode}] ` : ""}${judul}`,
      url: `/berbagi/${paketId}`,
      tag: `paket-${paketId}`,
    });
  } catch { /* ignore push errors */ }
}

// Helper: notifikasi admin OPD asal saat masuk antrian approval.
async function notifyApprovers(opdId: string | null, paketId: string, judul: string) {
  try {
    if (!opdId) return;
    const { data: admins } = await supabaseAdmin
      .from("user_roles").select("user_id, profiles!inner(opd_id)").eq("role", "admin_opd");
    const ids = (admins ?? [])
      .filter((a) => (a as unknown as { profiles: { opd_id: string | null } }).profiles?.opd_id === opdId)
      .map((a) => a.user_id);
    if (ids.length === 0) return;
    await sendPushToUsers(ids, {
      title: "Perlu persetujuan",
      body: judul,
      url: `/admin/berbagi`,
      tag: `approval-${paketId}`,
    });
  } catch { /* ignore */ }
}

// Helper: notifikasi pengirim saat paket disetujui/ditolak.
async function notifySender(userId: string, paketId: string, judul: string, approved: boolean) {
  try {
    await sendPushToUsers([userId], {
      title: approved ? "Paket disetujui & dikirim" : "Paket ditolak",
      body: judul,
      url: `/berbagi/${paketId}`,
      tag: `paket-status-${paketId}`,
    });
  } catch { /* ignore */ }
}

// ============= CREATE PAKET =============
const targetSchema = z.object({
  target_type: z.enum(["opd", "user", "pimpinan"]),
  target_opd_id: z.string().uuid().nullable().optional(),
  target_user_id: z.string().uuid().nullable().optional(),
  target_pejabat_id: z.string().uuid().nullable().optional(),
});

export const createPaket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      judul: z.string().trim().min(3).max(200),
      deskripsi: z.string().max(4000).optional().nullable(),
      tipe: z.enum(["dokumen", "memo", "dataset"]),
      prioritas: z.enum(["normal", "penting", "segera", "rahasia"]).default("normal"),
      sensitivitas: z.enum(["publik_internal", "terbatas", "rahasia"]).default("publik_internal"),
      dataset_template_id: z.string().uuid().nullable().optional(),
      expires_at: z.string().datetime().nullable().optional(),
      targets: z.array(targetSchema).min(1).max(60),
      lampiran: z.array(z.object({
        nama_file: z.string().max(255),
        mime: z.string().max(120).optional(),
        ukuran: z.number().int().min(0).max(20 * 1024 * 1024),
        path: z.string().max(500),
      })).max(20).optional(),
      submit: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    const rl = await checkRateLimit(context.userId, "share_create", 30, 60);
    if (!rl.ok) throw new Error("Terlalu banyak permintaan");

    const { data: paket, error: e1 } = await supabaseAdmin
      .from("share_paket")
      .insert({
        judul: data.judul,
        deskripsi: data.deskripsi ?? null,
        tipe: data.tipe,
        prioritas: data.prioritas,
        sensitivitas: data.sensitivitas,
        dataset_template_id: data.dataset_template_id ?? null,
        expires_at: data.expires_at ?? null,
        pengirim_user_id: context.userId,
        pengirim_opd_id: ctx.opdId,
        status: "draft",
      })
      .select()
      .single();
    if (e1) throw new Error(e1.message);

    if (data.targets.length) {
      const rows = data.targets.map((t) => ({ paket_id: paket.id, ...t }));
      const { error: e2 } = await supabaseAdmin.from("share_target").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    if (data.lampiran?.length) {
      const rows = data.lampiran.map((l) => ({ paket_id: paket.id, uploaded_by: context.userId, ...l }));
      const { error: e3 } = await supabaseAdmin.from("share_lampiran").insert(rows);
      if (e3) throw new Error(e3.message);
    }

    if (data.submit) {
      const { error: eUpd } = await supabaseAdmin
        .from("share_paket")
        .update({ status: "menunggu_approval" })
        .eq("id", paket.id);
      if (eUpd) throw new Error(eUpd.message);

      const { data: refreshed } = await supabaseAdmin
        .from("share_paket").select("approval_required").eq("id", paket.id).single();
      if (refreshed && !refreshed.approval_required) {
        await supabaseAdmin.from("share_paket")
          .update({ status: "terkirim", approver_id: context.userId, approved_at: new Date().toISOString() })
          .eq("id", paket.id);
        await notifyRecipients(paket.id, data.judul, paket.kode);
      } else {
        await notifyApprovers(ctx.opdId, paket.id, data.judul);
      }
    }

    return { ok: true, id: paket.id, kode: paket.kode };
  });

// ============= LIST =============
export const listInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.userId);
    const { data: targets } = await supabaseAdmin
      .from("share_target")
      .select("paket_id,target_type,status_baca")
      .or([
        `target_user_id.eq.${context.userId}`,
        ctx.opdId ? `target_opd_id.eq.${ctx.opdId}` : "",
      ].filter(Boolean).join(","));
    const ids = new Set((targets ?? []).map((t) => t.paket_id));
    if (ctx.isPimpinan) {
      const { data: pim } = await supabaseAdmin
        .from("share_target").select("paket_id").eq("target_type", "pimpinan");
      (pim ?? []).forEach((p) => ids.add(p.paket_id));
    }
    if (ids.size === 0) return { rows: [] };
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("share_paket")
      .select("id,kode,judul,tipe,prioritas,sensitivitas,status,created_at,expires_at,pengirim_user_id,pengirim_opd_id, opd:opd!pengirim_opd_id(nama,singkatan), pengirim:profiles!pengirim_user_id(nama_lengkap)")
      .in("id", Array.from(ids))
      .eq("status", "terkirim")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("share_paket")
      .select("id,kode,judul,tipe,prioritas,sensitivitas,status,created_at,expires_at,approval_required")
      .eq("pengirim_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listApprovalQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isAdminOpd && !ctx.isSuper) throw new Error("Forbidden");
    let q = supabaseAdmin
      .from("share_paket")
      .select("id,kode,judul,tipe,prioritas,sensitivitas,status,created_at,pengirim_opd_id, opd:opd!pengirim_opd_id(nama,singkatan), pengirim:profiles!pengirim_user_id(nama_lengkap)")
      .eq("status", "menunggu_approval")
      .eq("approval_required", true);
    if (!ctx.isSuper && ctx.opdId) q = q.eq("pengirim_opd_id", ctx.opdId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// ============= DETAIL =============
export const getPaketDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: paket, error } = await supabaseAdmin
      .from("share_paket")
      .select("*, opd:opd!pengirim_opd_id(nama,singkatan), pengirim:profiles!pengirim_user_id(nama_lengkap)")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: canAccess } = await supabaseAdmin.rpc("can_access_paket" as never, { _paket_id: data.id, _user_id: context.userId } as never);
    if (!canAccess) throw new Error("Forbidden");

    const [{ data: targets }, { data: lampiran }, { data: riwayat }, { data: komentar }] = await Promise.all([
      supabaseAdmin.from("share_target").select("*, opd:opd!target_opd_id(nama,singkatan), user:profiles!target_user_id(nama_lengkap), pejabat:pejabat!target_pejabat_id(nama,jabatan)").eq("paket_id", data.id),
      supabaseAdmin.from("share_lampiran").select("*").eq("paket_id", data.id).order("created_at"),
      supabaseAdmin.from("share_riwayat").select("*, oleh:profiles!oleh_user_id(nama_lengkap)").eq("paket_id", data.id).order("created_at"),
      supabaseAdmin.from("share_komentar").select("*, oleh:profiles!oleh_user_id(nama_lengkap)").eq("paket_id", data.id).order("created_at"),
    ]);
    return { paket, targets: targets ?? [], lampiran: lampiran ?? [], riwayat: riwayat ?? [], komentar: komentar ?? [] };
  });

// ============= APPROVAL =============
export const approvePaket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(500).optional(), approve: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isAdminOpd && !ctx.isSuper) throw new Error("Forbidden");
    const { data: paket } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,pengirim_opd_id,status,judul,kode").eq("id", data.id).single();
    if (!paket) throw new Error("Paket tidak ditemukan");
    if (!ctx.isSuper && paket.pengirim_opd_id !== ctx.opdId) throw new Error("Bukan OPD Anda");
    if (paket.status !== "menunggu_approval") throw new Error("Paket tidak dalam antrian persetujuan");

    const { error } = await supabaseAdmin.from("share_paket").update({
      status: data.approve ? "terkirim" : "ditolak",
      approver_id: context.userId,
      approved_at: new Date().toISOString(),
      approval_note: data.note ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await notifySender(paket.pengirim_user_id, data.id, paket.judul, data.approve);
    if (data.approve) await notifyRecipients(data.id, paket.judul, paket.kode);
    return { ok: true };
  });

// ============= TINDAK LANJUT TARGET =============
export const markTargetAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      target_id: z.string().uuid(),
      aksi: z.enum(["dibuka", "ditindaklanjuti", "ditolak"]),
      catatan: z.string().max(800).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = data.aksi === "dibuka"
      ? { status_baca: data.aksi, dibuka_oleh: context.userId, dibuka_pada: new Date().toISOString() }
      : { status_baca: data.aksi, tindak_lanjut_catatan: data.catatan ?? null, tindak_lanjut_pada: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("share_target").update(patch).eq("id", data.target_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= KOMENTAR =============
export const addKomentar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paket_id: z.string().uuid(), isi: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: canAccess } = await supabaseAdmin.rpc("can_access_paket" as never, { _paket_id: data.paket_id, _user_id: context.userId } as never);
    if (!canAccess) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("share_komentar").insert({
      paket_id: data.paket_id, oleh_user_id: context.userId, isi: data.isi,
    });
    if (error) throw new Error(error.message);
    // Notify pihak terkait (pengirim + penerima) selain penulis
    try {
      const { data: p } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,judul,kode").eq("id", data.paket_id).single();
      const recipients = await resolveTargetUserIds(data.paket_id);
      const ids = new Set<string>(recipients);
      if (p?.pengirim_user_id) ids.add(p.pengirim_user_id);
      ids.delete(context.userId);
      if (ids.size > 0 && p) {
        await sendPushToUsers(Array.from(ids), {
          title: `Komentar baru pada paket`,
          body: `${p.kode ? `[${p.kode}] ` : ""}${p.judul}`,
          url: `/berbagi/${data.paket_id}`,
          tag: `komentar-${data.paket_id}`,
        });
      }
    } catch { /* ignore */ }
    return { ok: true };
  });

// ============= LOOKUPS =============
export const lookupTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [{ data: opd }, { data: pim }] = await Promise.all([
      supabaseAdmin.from("opd").select("id,nama,singkatan").order("nama"),
      supabaseAdmin.from("pejabat").select("id,nama,jabatan,level").eq("is_pimpinan", true).eq("aktif", true).order("urutan"),
    ]);
    return { opd: opd ?? [], pimpinan: pim ?? [] };
  });

// ============= SIGNED URL UNTUK LAMPIRAN =============
export const getLampiranUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(500), paket_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: canAccess } = await supabaseAdmin.rpc("can_access_paket" as never, { _paket_id: data.paket_id, _user_id: context.userId } as never);
    if (!canAccess) throw new Error("Forbidden");
    const { data: signed, error } = await supabaseAdmin.storage.from("share-files").createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ============= CARI USER =============
export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const like = `%${data.q.replace(/[%_]/g, "")}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_lengkap,jabatan,opd_id, opd:opd!opd_id(singkatan,nama)")
      .or(`nama_lengkap.ilike.${like},username.ilike.${like},nip.ilike.${like}`)
      .eq("status", "active")
      .limit(15);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ============= AKSI PAKET =============
export const submitDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: p } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,pengirim_opd_id,status,judul,kode").eq("id", data.id).single();
    if (!p) throw new Error("Paket tidak ditemukan");
    if (p.pengirim_user_id !== context.userId) throw new Error("Forbidden");
    if (!["draft", "ditolak"].includes(p.status)) throw new Error("Hanya draft/ditolak yang bisa dikirim");
    const { error } = await supabaseAdmin.from("share_paket").update({ status: "menunggu_approval" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { data: refreshed } = await supabaseAdmin.from("share_paket").select("approval_required").eq("id", data.id).single();
    if (refreshed && !refreshed.approval_required) {
      await supabaseAdmin.from("share_paket")
        .update({ status: "terkirim", approver_id: context.userId, approved_at: new Date().toISOString() })
        .eq("id", data.id);
      await notifyRecipients(data.id, p.judul, p.kode);
    } else {
      await notifyApprovers(p.pengirim_opd_id, data.id, p.judul);
    }
    return { ok: true };
  });

export const cancelPaket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), alasan: z.string().max(500).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    const { data: p } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,pengirim_opd_id,status").eq("id", data.id).single();
    if (!p) throw new Error("Paket tidak ditemukan");
    const ok = p.pengirim_user_id === context.userId || ctx.isSuper || (ctx.isAdminOpd && p.pengirim_opd_id === ctx.opdId);
    if (!ok) throw new Error("Forbidden");
    if (["dibatalkan", "arsip"].includes(p.status)) throw new Error("Paket sudah final");
    const { error } = await supabaseAdmin.from("share_paket").update({
      status: "dibatalkan", approval_note: data.alasan ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archivePaket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    const { data: p } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,pengirim_opd_id,status").eq("id", data.id).single();
    if (!p) throw new Error("Paket tidak ditemukan");
    const ok = p.pengirim_user_id === context.userId || ctx.isSuper || (ctx.isAdminOpd && p.pengirim_opd_id === ctx.opdId);
    if (!ok) throw new Error("Forbidden");
    if (!["terkirim", "ditolak", "dibatalkan"].includes(p.status)) throw new Error("Paket tidak bisa diarsipkan dari status ini");
    const { error } = await supabaseAdmin.from("share_paket").update({ status: "arsip" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: p } = await supabaseAdmin.from("share_paket").select("pengirim_user_id,status").eq("id", data.id).single();
    if (!p) throw new Error("Paket tidak ditemukan");
    if (p.pengirim_user_id !== context.userId) throw new Error("Forbidden");
    if (p.status !== "draft") throw new Error("Hanya draft yang bisa dihapus");
    await supabaseAdmin.from("share_target").delete().eq("paket_id", data.id);
    await supabaseAdmin.from("share_lampiran").delete().eq("paket_id", data.id);
    await supabaseAdmin.from("share_komentar").delete().eq("paket_id", data.id);
    await supabaseAdmin.from("share_riwayat").delete().eq("paket_id", data.id);
    const { error } = await supabaseAdmin.from("share_paket").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= ENFORCE EXPIRY (auto-arsip paket kedaluwarsa) =============
export const enforceExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("share_paket")
      .update({ status: "arsip" })
      .lt("expires_at", nowIso)
      .in("status", ["terkirim", "menunggu_approval", "ditolak", "dibatalkan"])
      .select("id");
    if (error) throw new Error(error.message);
    return { archived: data?.length ?? 0 };
  });
