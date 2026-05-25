// Admin: Master Desa — CRUD desa untuk Super Admin.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertDesa, deleteDesa } from "@/lib/admin-actions.functions";

export const Route = createFileRoute("/admin/desa")({
  head: () => ({ meta: [{ title: "Master Desa — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <DesaPage />
    </AdminGuard>
  ),
});

type Desa = { id: string; nama: string; kecamatan: string | null; aktif: boolean };

function DesaPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<Desa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Desa> | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("desa").select("id,nama,kecamatan,aktif").order("nama");
    setRows((data ?? []) as Desa[]);
    setLoading(false);
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function save() {
    if (!editing?.nama || editing.nama.trim().length < 2) { toast.error("Nama desa wajib"); return; }
    try {
      await upsertDesa({ data: {
        id: editing.id, nama: editing.nama.trim(),
        kecamatan: editing.kecamatan?.trim() || null, aktif: editing.aktif ?? true,
      }});
      toast.success("Tersimpan"); setEditing(null); load();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function hapus(id: string) {
    if (!confirm("Hapus desa? Profil warga yang sudah memilih desa ini tidak akan ikut terhapus.")) return;
    try { await deleteDesa({ data: { id } }); toast.success("Dihapus"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (!isSuperAdmin) {
    return <AdminShell breadcrumb={[{ label: "Desa" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div></AdminShell>;
  }

  return (
    <AdminShell breadcrumb={[{ label: "Master Desa" }]}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Master Desa</h1>
          <p className="text-sm text-muted-foreground">Daftar desa yang dipakai pada pendaftaran warga & manajemen Admin Desa.</p>
        </div>
        <button onClick={() => setEditing({ aktif: true })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Tambah Desa
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nama Desa</th>
              <th className="px-4 py-3 font-medium">Kecamatan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada desa. Tambahkan satu untuk mulai.</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{d.nama}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.kecamatan || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.aktif ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {d.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(d)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => hapus(d.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing.id ? "Edit Desa" : "Tambah Desa"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nama Desa</label>
                <input value={editing.nama ?? ""} onChange={(e) => setEditing({ ...editing, nama: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kecamatan (opsional)</label>
                <input value={editing.kecamatan ?? ""} onChange={(e) => setEditing({ ...editing, kecamatan: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.aktif ?? true} onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })} />
                Aktif
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
              <button onClick={save} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
