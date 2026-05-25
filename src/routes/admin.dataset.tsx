import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  upsertTemplate, listTemplatesAdmin, toggleTemplateAktif,
  listSubmissions, exportSubmissionsXlsx,
} from "@/lib/dataset.functions";
import { Plus, X, FileSpreadsheet, Eye, Power, Save } from "lucide-react";

export const Route = createFileRoute("/admin/dataset")({
  head: () => ({ meta: [{ title: "Admin — Dataset" }, { name: "robots", content: "noindex" }] }),
  component: () => <AdminGuard><AdminShell><Page /></AdminShell></AdminGuard>,
});

type Tpl = { id: string; kode: string | null; judul: string; target_role: string; target_scope: string; deadline: string | null; aktif: boolean; opd: { nama: string; singkatan: string | null } | null };
type Kolom = { key: string; label: string; tipe: "text" | "number" | "date" | "select" | "textarea"; required?: boolean; options?: string[]; help?: string };

function Page() {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewSubs, setViewSubs] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try { const r = await listTemplatesAdmin() as unknown as { rows: Tpl[] }; setRows(r.rows); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onToggle(id: string, aktif: boolean) {
    await toggleTemplateAktif({ data: { id, aktif: !aktif } });
    await load();
  }

  async function onExport(id: string) {
    try {
      const r = await exportSubmissionsXlsx({ data: { template_id: id } }) as unknown as { url: string; filename: string };
      const a = document.createElement("a"); a.href = r.url; a.download = r.filename; a.target = "_blank"; a.click();
    } catch (ex) { alert(ex instanceof Error ? ex.message : "Gagal ekspor"); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Manajemen Dataset</h2>
          <p className="text-sm text-muted-foreground">Buat template formulir untuk diisi ASN, lalu ekspor rangkuman ke Excel.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft">
          <Plus className="h-4 w-4" /> Template Baru
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Judul</th>
              <th className="px-3 py-2">Pemilik</th>
              <th className="px-3 py-2">Sasaran</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {busy && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Memuat…</td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Belum ada template.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-mono text-xs">{t.kode ?? "-"}</td>
                <td className="px-3 py-2 font-medium">{t.judul}</td>
                <td className="px-3 py-2">{t.opd?.singkatan ?? t.opd?.nama ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{t.target_role} / {t.target_scope}</td>
                <td className="px-3 py-2 text-xs">{t.deadline ? new Date(t.deadline).toLocaleDateString("id-ID") : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.aktif ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{t.aktif ? "Aktif" : "Nonaktif"}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <IconBtn onClick={() => setViewSubs(t.id)} title="Lihat Submission"><Eye className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn onClick={() => onExport(t.id)} title="Ekspor Excel"><FileSpreadsheet className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn onClick={() => onToggle(t.id, t.aktif)} title="Toggle Aktif"><Power className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <TemplateForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {viewSubs && <SubmissionsModal template_id={viewSubs} onClose={() => setViewSubs(null)} onExport={() => onExport(viewSubs)} />}
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button title={title} onClick={onClick} className="rounded-md border border-border bg-background p-1.5 hover:bg-muted">{children}</button>;
}

function TemplateForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [targetRole, setTargetRole] = useState<"asn" | "admin_opd" | "semua">("asn");
  const [targetScope, setTargetScope] = useState<"opd_sendiri" | "lintas_opd" | "spesifik">("opd_sendiri");
  const [deadline, setDeadline] = useState("");
  const [allowMulti, setAllowMulti] = useState(false);
  const [kolom, setKolom] = useState<Kolom[]>([{ key: "kegiatan", label: "Nama Kegiatan", tipe: "text", required: true }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addKolom() { setKolom((p) => [...p, { key: `kol_${p.length + 1}`, label: "Kolom Baru", tipe: "text" }]); }
  function updKolom(i: number, patch: Partial<Kolom>) { setKolom((p) => p.map((k, j) => j === i ? { ...k, ...patch } : k)); }
  function delKolom(i: number) { setKolom((p) => p.filter((_, j) => j !== i)); }

  async function onSave() {
    setBusy(true); setErr(null);
    try {
      await upsertTemplate({
        data: {
          judul, deskripsi, target_role: targetRole, target_scope: targetScope,
          target_opd_ids: [], kolom,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          aktif: true, allow_multiple_submit: allowMulti,
          excel_layout: { sheet_name: "Rangkuman", group_by: "opd" },
        },
      });
      onSaved();
    } catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal menyimpan"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-background shadow-elegant">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">Template Dataset Baru</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Judul"><input className="input" value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={200} /></Field>
          <Field label="Deskripsi"><textarea className="input min-h-[70px]" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} maxLength={2000} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Role Sasaran">
              <select className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value as typeof targetRole)}>
                <option value="asn">ASN</option><option value="admin_opd">Admin OPD</option><option value="semua">Semua</option>
              </select>
            </Field>
            <Field label="Ruang Lingkup">
              <select className="input" value={targetScope} onChange={(e) => setTargetScope(e.target.value as typeof targetScope)}>
                <option value="opd_sendiri">OPD Sendiri</option><option value="lintas_opd">Lintas OPD</option><option value="spesifik">Spesifik</option>
              </select>
            </Field>
            <Field label="Deadline"><input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={allowMulti} onChange={(e) => setAllowMulti(e.target.checked)} /> Izinkan multi-submit per ASN</label>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Kolom Formulir</div>
              <button onClick={addKolom} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">
                <Plus className="h-3 w-3" /> Tambah Kolom
              </button>
            </div>
            <div className="space-y-2">
              {kolom.map((k, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded border border-border p-2 text-xs">
                  <input className="input col-span-3" placeholder="key" value={k.key} onChange={(e) => updKolom(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                  <input className="input col-span-3" placeholder="Label" value={k.label} onChange={(e) => updKolom(i, { label: e.target.value })} />
                  <select className="input col-span-2" value={k.tipe} onChange={(e) => updKolom(i, { tipe: e.target.value as Kolom["tipe"] })}>
                    <option value="text">Text</option><option value="textarea">Textarea</option><option value="number">Number</option><option value="date">Date</option><option value="select">Select</option>
                  </select>
                  {k.tipe === "select"
                    ? <input className="input col-span-3" placeholder="opsi1, opsi2" value={(k.options ?? []).join(", ")} onChange={(e) => updKolom(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    : <span className="col-span-3" />}
                  <label className="col-span-1 inline-flex items-center justify-center"><input type="checkbox" checked={!!k.required} onChange={(e) => updKolom(i, { required: e.target.checked })} title="Wajib" /></label>
                  <button onClick={() => delKolom(i)} className="col-span-12 inline-flex items-center justify-end text-destructive"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {err && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">Batal</button>
            <button onClick={onSave} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
              <Save className="h-4 w-4" /> {busy ? "Menyimpan…" : "Simpan Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmissionsModal({ template_id, onClose, onExport }: { template_id: string; onClose: () => void; onExport: () => void }) {
  const [rows, setRows] = useState<Array<{ id: string; data: Record<string, unknown>; submitted_at: string; user: { nama_lengkap: string | null } | null; opd: { nama: string } | null }>>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    listSubmissions({ data: { template_id } })
      .then((r) => setRows((r as unknown as { rows: typeof rows }).rows))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, [template_id]);

  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.data ?? {}))));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <div className="w-full max-w-5xl rounded-xl bg-background shadow-elegant">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">Submissions ({rows.length})</h3>
          <div className="flex items-center gap-2">
            <button onClick={onExport} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><FileSpreadsheet className="h-3.5 w-3.5" /> Ekspor Excel</button>
            <button onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          {busy && <div className="text-sm text-muted-foreground">Memuat…</div>}
          {!busy && rows.length === 0 && <div className="text-sm text-muted-foreground">Belum ada submission.</div>}
          {!busy && rows.length > 0 && (
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Nama</th><th className="px-2 py-1">OPD</th>
                  {keys.map((k) => <th key={k} className="px-2 py-1">{k}</th>)}
                  <th className="px-2 py-1">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1">{r.user?.nama_lengkap ?? "-"}</td>
                    <td className="px-2 py-1">{r.opd?.nama ?? "-"}</td>
                    {keys.map((k) => <td key={k} className="px-2 py-1">{String((r.data?.[k] as unknown) ?? "")}</td>)}
                    <td className="px-2 py-1">{new Date(r.submitted_at).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
