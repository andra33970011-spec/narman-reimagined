// Admin: kelola Layanan Publik per OPD.
// Super admin: lihat semua. Admin OPD: hanya layanan milik OPD-nya.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ListChecks } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertLayanan, deleteLayanan } from "@/lib/admin-actions.functions";
import { invalidateLayanan } from "@/lib/queries";

export const Route = createFileRoute("/admin/layanan")({
  head: () => ({ meta: [{ title: "Layanan OPD — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <LayananPage />
    </AdminGuard>
  ),
});

type Opd = { id: string; nama: string; singkatan: string };
type Layanan = {
  id: string; judul: string; deskripsi: string | null; ikon: string | null;
  opd_id: string | null; persyaratan: string | null; alur: string | null;
  aktif: boolean; urutan: number; sla_hari: number;
};

function LayananPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Layanan[]>([]);
  const [opds, setOpds] = useState<Opd[]>([]);
  const [myOpdId, setMyOpdId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Layanan> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data: l }, { data: o }, { data: prof }] = await Promise.all([
      supabase.from("layanan_publik").select("*").order("urutan"),
      supabase.from("opd").select("id,nama,singkatan").order("nama"),
      supabase.from("profiles").select("opd_id").eq("id", user.id).maybeSingle(),
    ]);
    setRows((l ?? []) as Layanan[]);
    setOpds((o ?? []) as Opd[]);
    setMyOpdId(((prof as { opd_id: string | null } | null)?.opd_id) ?? null);
    setLoading(false);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, user?.id]);

  const visible = useMemo(() => {
    if (isSuperAdmin) return rows;
    return rows.filter((r) => r.opd_id === myOpdId);
  }, [rows, isSuperAdmin, myOpdId]);

  async function save() {
    if (!editing?.judul) { toast.error("Judul wajib"); return; }
    const opdIdToUse = isSuperAdmin ? (editing.opd_id ?? null) : myOpdId;
    if (!isSuperAdmin && !opdIdToUse) { toast.error("Akun Anda belum memiliki OPD."); return; }
    try {
      await upsertLayanan({ data: {
        id: editing.id, judul: editing.judul,
        deskripsi: editing.deskripsi ?? null, ikon: editing.ikon ?? null,
        opd_id: opdIdToUse, persyaratan: editing.persyaratan ?? null,
        alur: editing.alur ?? null, aktif: editing.aktif ?? true,
        urutan: editing.urutan ?? 0, sla_hari: editing.sla_hari ?? 14,
      }});
      await invalidateLayanan(qc);
      toast.success("Layanan tersimpan"); setEditing(null); load();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function hapus(id: string) {
    if (!confirm("Hapus layanan?")) return;
    try {
      await deleteLayanan({ data: { id } });
      await invalidateLayanan(qc);
      toast.success("Dihapus"); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!isAdmin) return <AdminShell breadcrumb={[{ label: "Layanan" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Akses ditolak.</div></AdminShell>;

  const opdLabel = (id: string | null) => opds.find((o) => o.id === id)?.singkatan ?? "—";

  return (
    <AdminShell breadcrumb={[{ label: "Layanan OPD" }]}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /> Layanan OPD</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? "Kelola seluruh layanan publik antar OPD." : `Kelola layanan milik OPD Anda (${opdLabel(myOpdId)}).`}
          </p>
        </div>
        <button onClick={() => setEditing({ aktif: true, urutan: 0, sla_hari: 14, opd_id: isSuperAdmin ? null : myOpdId })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Layanan Baru
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Judul</th>
              <th className="px-4 py-3 font-medium">OPD</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium">Urutan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Belum ada layanan.</td></tr>}
            {visible.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{l.judul}</td>
                <td className="px-4 py-3 text-muted-foreground">{opdLabel(l.opd_id)}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.sla_hari} hari</td>
                <td className="px-4 py-3 font-mono">{l.urutan}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${l.aktif ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{l.aktif ? "Aktif" : "Nonaktif"}</span></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(l)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => hapus(l.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing.id ? "Edit Layanan" : "Layanan Baru"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Judul"><input value={editing.judul ?? ""} onChange={(e) => setEditing({ ...editing, judul: e.target.value })} className="input" /></Field>
              <Field label="Deskripsi"><textarea rows={2} value={editing.deskripsi ?? ""} onChange={(e) => setEditing({ ...editing, deskripsi: e.target.value })} className="input" /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="OPD penanggung jawab">
                  {isSuperAdmin ? (
                    <select value={editing.opd_id ?? ""} onChange={(e) => setEditing({ ...editing, opd_id: e.target.value || null })} className="input">
                      <option value="">— Pilih OPD —</option>
                      {opds.map((o) => <option key={o.id} value={o.id}>{o.singkatan} — {o.nama}</option>)}
                    </select>
                  ) : (
                    <input value={opdLabel(myOpdId)} disabled className="input opacity-70" />
                  )}
                </Field>
                <Field label="Urutan tampil"><input type="number" value={editing.urutan ?? 0} onChange={(e) => setEditing({ ...editing, urutan: Number(e.target.value) })} className="input" /></Field>
              </div>
              <Field label="SLA / Tenggat penyelesaian (hari)"><input type="number" min={1} max={365} value={editing.sla_hari ?? 14} onChange={(e) => setEditing({ ...editing, sla_hari: Number(e.target.value) })} className="input" /></Field>
              <Field label="Ikon (lucide opsional, mis. IdCard)"><input value={editing.ikon ?? ""} onChange={(e) => setEditing({ ...editing, ikon: e.target.value })} className="input" /></Field>
              <Field label="Persyaratan"><textarea rows={4} value={editing.persyaratan ?? ""} onChange={(e) => setEditing({ ...editing, persyaratan: e.target.value })} className="input" /></Field>
              <Field label="Alur layanan"><textarea rows={4} value={editing.alur ?? ""} onChange={(e) => setEditing({ ...editing, alur: e.target.value })} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.aktif ?? true} onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })} />
                Tampilkan di halaman publik
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
              <button onClick={save} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Simpan</button>
            </div>
          </div>
        </div>
      )}
      <style>{`.input{width:100%;border:1px solid var(--color-border);background:var(--color-background);border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;}`}</style>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
