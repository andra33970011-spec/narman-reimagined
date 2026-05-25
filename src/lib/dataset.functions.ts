// Modul Dataset: template formulir + submission + export Excel rangkuman.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

export type KolomDef = {
  key: string;
  label: string;
  tipe: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  options?: string[];
  help?: string;
};

const kolomSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().min(1).max(120),
  tipe: z.enum(["text", "number", "date", "select", "textarea"]),
  required: z.boolean().optional(),
  options: z.array(z.string().max(80)).max(50).optional(),
  help: z.string().max(200).optional(),
});

async function userCtx(userId: string) {
  const [{ data: roles }, { data: prof }, { data: pej }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("opd_id,nama_lengkap").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("pejabat").select("is_pimpinan").eq("user_id", userId).eq("aktif", true).maybeSingle(),
  ]);
  const r = (roles ?? []).map((x) => x.role);
  return {
    isSuper: r.includes("super_admin"),
    isAdminOpd: r.includes("admin_opd"),
    isAsn: r.includes("asn"),
    isPimpinan: !!pej?.is_pimpinan,
    opdId: (prof?.opd_id as string | null) ?? null,
  };
}

// ============= TEMPLATE CRUD =============
export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      judul: z.string().trim().min(3).max(200),
      deskripsi: z.string().max(2000).optional().nullable(),
      target_role: z.enum(["asn", "admin_opd", "semua"]).default("asn"),
      target_scope: z.enum(["opd_sendiri", "lintas_opd", "spesifik"]).default("opd_sendiri"),
      target_opd_ids: z.array(z.string().uuid()).max(80).default([]),
      kolom: z.array(kolomSchema).min(1).max(60),
      deadline: z.string().datetime().nullable().optional(),
      aktif: z.boolean().default(true),
      allow_multiple_submit: z.boolean().default(false),
      excel_layout: z.object({
        sheet_name: z.string().max(31).default("Rangkuman"),
        group_by: z.enum(["opd", "tanggal", "none"]).default("opd"),
      }).default({ sheet_name: "Rangkuman", group_by: "opd" }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd) throw new Error("Hanya admin yang dapat membuat template");
    const payload = {
      judul: data.judul,
      deskripsi: data.deskripsi ?? null,
      opd_pemilik_id: ctx.isSuper ? (data.target_scope === "opd_sendiri" ? ctx.opdId : null) : ctx.opdId,
      target_role: data.target_role,
      target_scope: data.target_scope,
      target_opd_ids: data.target_opd_ids,
      kolom: data.kolom,
      deadline: data.deadline ?? null,
      aktif: data.aktif,
      allow_multiple_submit: data.allow_multiple_submit,
      excel_layout: data.excel_layout,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("dataset_template").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("dataset_template").insert(payload).select("id,kode").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id, kode: row.kode };
  });

export const listTemplatesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd) throw new Error("Forbidden");
    let q = supabaseAdmin.from("dataset_template")
      .select("id,kode,judul,target_role,target_scope,deadline,aktif,created_at, opd:opd!opd_pemilik_id(nama,singkatan)")
      .order("created_at", { ascending: false });
    if (!ctx.isSuper && ctx.opdId) q = q.eq("opd_pemilik_id", ctx.opdId);
    const { data, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const listTemplatesForMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await userCtx(context.userId);
    const { data, error } = await supabaseAdmin
      .from("dataset_template")
      .select("id,kode,judul,deskripsi,target_role,target_scope,target_opd_ids,opd_pemilik_id,deadline,aktif, opd:opd!opd_pemilik_id(nama,singkatan)")
      .eq("aktif", true)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Filter sesuai scope & opd
    const rows = (data ?? []).filter((t) => {
      if (t.target_scope === "opd_sendiri") return ctx.opdId && t.opd_pemilik_id === ctx.opdId;
      if (t.target_scope === "spesifik") return ctx.opdId && (t.target_opd_ids as string[] | null)?.includes(ctx.opdId);
      return true; // lintas_opd
    });
    return { rows };
  });

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: tpl, error } = await supabaseAdmin
      .from("dataset_template").select("*, opd:opd!opd_pemilik_id(nama,singkatan)").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return { template: tpl };
  });

export const toggleTemplateAktif = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), aktif: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd) throw new Error("Forbidden");
    const { error } = await supabaseAdmin.from("dataset_template").update({ aktif: data.aktif }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= SUBMISSION =============
export const submitDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      template_id: z.string().uuid(),
      data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      submission_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    const rl = await checkRateLimit(context.userId, "ds_submit", 30, 60);
    if (!rl.ok) throw new Error("Terlalu banyak pengiriman");

    const { data: tpl } = await supabaseAdmin
      .from("dataset_template").select("kolom,allow_multiple_submit,aktif,deadline").eq("id", data.template_id).single();
    if (!tpl || !tpl.aktif) throw new Error("Template tidak aktif");
    if (tpl.deadline && new Date(tpl.deadline) < new Date()) throw new Error("Pengisian telah ditutup (lewat deadline)");

    const kolom = (tpl.kolom as unknown as KolomDef[]) ?? [];
    for (const k of kolom) {
      if (k.required && (data.data[k.key] === undefined || data.data[k.key] === null || data.data[k.key] === "")) {
        throw new Error(`Kolom "${k.label}" wajib diisi`);
      }
    }

    if (data.submission_id) {
      const { error } = await supabaseAdmin.from("dataset_submission")
        .update({ data: data.data, status: "final", submitted_at: new Date().toISOString() })
        .eq("id", data.submission_id).eq("oleh_user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.submission_id };
    }

    if (!tpl.allow_multiple_submit) {
      const { data: existing } = await supabaseAdmin.from("dataset_submission")
        .select("id").eq("template_id", data.template_id).eq("oleh_user_id", context.userId).maybeSingle();
      if (existing) {
        const { error } = await supabaseAdmin.from("dataset_submission")
          .update({ data: data.data, status: "final", submitted_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return { ok: true, id: existing.id, updated: true };
      }
    }

    const { data: row, error } = await supabaseAdmin.from("dataset_submission").insert({
      template_id: data.template_id,
      oleh_user_id: context.userId,
      opd_id: ctx.opdId,
      data: data.data,
      status: "final",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd && !ctx.isPimpinan) throw new Error("Forbidden");
    const { data: rows, error } = await supabaseAdmin
      .from("dataset_submission")
      .select("id,data,status,submitted_at,oleh_user_id,opd_id, user:profiles!oleh_user_id(nama_lengkap,nip,jabatan), opd:opd!opd_id(nama,singkatan)")
      .eq("template_id", data.template_id)
      .order("submitted_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const mySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("dataset_submission")
      .select("id,data,status,submitted_at")
      .eq("template_id", data.template_id).eq("oleh_user_id", context.userId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ============= EXPORT EXCEL =============
export const exportSubmissionsXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ template_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await userCtx(context.userId);
    if (!ctx.isSuper && !ctx.isAdminOpd && !ctx.isPimpinan) throw new Error("Forbidden");
    const rl = await checkRateLimit(context.userId, "ds_export", 20, 60);
    if (!rl.ok) throw new Error("Terlalu banyak ekspor");

    const { data: tpl } = await supabaseAdmin.from("dataset_template")
      .select("judul,kode,kolom,excel_layout,deadline, opd:opd!opd_pemilik_id(nama,singkatan)").eq("id", data.template_id).single();
    if (!tpl) throw new Error("Template tidak ditemukan");

    const { data: subs } = await supabaseAdmin.from("dataset_submission")
      .select("data,submitted_at,opd_id, user:profiles!oleh_user_id(nama_lengkap,nip,jabatan), opd:opd!opd_id(nama,singkatan)")
      .eq("template_id", data.template_id).eq("status", "final");

    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "Portal Pemerintah — Modul Berbagi Data";
    wb.created = new Date();

    const kolom = (tpl.kolom as unknown as KolomDef[]) ?? [];
    const layout = (tpl.excel_layout as { sheet_name?: string; group_by?: string }) ?? {};

    const ws = wb.addWorksheet(layout.sheet_name || "Rangkuman");
    ws.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "OPD", key: "opd", width: 28 },
      { header: "Nama", key: "nama", width: 26 },
      { header: "NIP", key: "nip", width: 22 },
      { header: "Jabatan", key: "jabatan", width: 24 },
      ...kolom.map((k) => ({ header: k.label, key: k.key, width: Math.max(14, Math.min(40, k.label.length + 6)) })),
      { header: "Waktu Submit", key: "waktu", width: 22 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 24;

    const rows = subs ?? [];
    const sorted = layout.group_by === "opd"
      ? [...rows].sort((a, b) => ((a.opd as { nama?: string } | null)?.nama ?? "").localeCompare((b.opd as { nama?: string } | null)?.nama ?? ""))
      : rows;

    sorted.forEach((s, i) => {
      const u = s.user as { nama_lengkap?: string; nip?: string; jabatan?: string } | null;
      const o = s.opd as { nama?: string; singkatan?: string } | null;
      const d = (s.data ?? {}) as Record<string, string | number | null>;
      const row: Record<string, unknown> = {
        no: i + 1,
        opd: o?.nama ?? "-",
        nama: u?.nama_lengkap ?? "-",
        nip: u?.nip ?? "-",
        jabatan: u?.jabatan ?? "-",
        waktu: new Date(s.submitted_at).toLocaleString("id-ID"),
      };
      for (const k of kolom) row[k.key] = d[k.key] ?? "";
      ws.addRow(row);
    });

    ws.eachRow({ includeEmpty: false }, (r) => {
      r.eachCell((c) => {
        c.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
        c.alignment = { vertical: "middle", wrapText: true };
      });
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

    // Sheet 2 — Per OPD
    const ws2 = wb.addWorksheet("Per OPD");
    ws2.columns = [{ header: "OPD", key: "opd", width: 36 }, { header: "Jumlah Submission", key: "n", width: 22 }];
    ws2.getRow(1).font = { bold: true };
    const byOpd = new Map<string, number>();
    rows.forEach((s) => {
      const nama = (s.opd as { nama?: string } | null)?.nama ?? "Tanpa OPD";
      byOpd.set(nama, (byOpd.get(nama) ?? 0) + 1);
    });
    Array.from(byOpd.entries()).sort((a, b) => b[1] - a[1]).forEach(([opd, n]) => ws2.addRow({ opd, n }));

    // Sheet 3 — Metadata
    const ws3 = wb.addWorksheet("Metadata");
    ws3.columns = [{ header: "Field", key: "k", width: 24 }, { header: "Value", key: "v", width: 50 }];
    ws3.getRow(1).font = { bold: true };
    ws3.addRows([
      { k: "Judul Template", v: tpl.judul },
      { k: "Kode", v: tpl.kode ?? "-" },
      { k: "OPD Pemilik", v: (tpl.opd as { nama?: string } | null)?.nama ?? "-" },
      { k: "Deadline", v: tpl.deadline ? new Date(tpl.deadline).toLocaleString("id-ID") : "-" },
      { k: "Total Submission", v: rows.length },
      { k: "Diekspor", v: new Date().toLocaleString("id-ID") },
    ]);

    const buffer = await wb.xlsx.writeBuffer();
    const path = `exports/${data.template_id}/${Date.now()}.xlsx`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("share-files")
      .upload(path, buffer as ArrayBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: sErr } = await supabaseAdmin.storage.from("share-files").createSignedUrl(path, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl, filename: `${(tpl.kode ?? "dataset")}-${Date.now()}.xlsx` };
  });
