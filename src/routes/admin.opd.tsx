// Admin: CRUD OPD (Organisasi Perangkat Daerah).
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertOpd, deleteOpd } from "@/lib/admin-actions.functions";
import { invalidateOpd } from "@/lib/queries";

export const Route = createFileRoute("/admin/opd")({
  head: () => ({ meta: [{ title: "Manajemen OPD — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <OpdPage />
    </AdminGuard>
  ),
});

type Opd = { id: string; nama: string; singkatan: string; kategori: string[] };

function OpdPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Opd[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Opd> | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("opd").select("id,nama,singkatan,kategori").order("nama");
    setRows((data ?? []) as Opd[]);
    setLoading(false);
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function save() {
    if (!editing?.nama || !editing?.singkatan) { toast.error("Nama dan singkatan wajib"); return; }
    try {
      await upsertOpd({ data: {
        id: editing.id, nama: editing.nama, singkatan: editing.singkatan,
        kategori: editing.kategori ?? [],
      }});
      await invalidateOpd(qc);
      toast.success("OPD tersimpan");
      setEditing(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus OPD ini?")) return;
    try {
      await deleteOpd({ data: { id } });
      await invalidateOpd(qc);
      toast.success("Dihapus"); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!isSuperAdmin) {
    return <AdminShell breadcrumb={[{ label: "OPD" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya untuk Super Admin.</div></AdminShell>;
  }

  return (
    <AdminShell breadcrumb={[{ label: "OPD" }]}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Manajemen OPD</h1>
          <p className="text-sm text-muted-foreground">Kelola Organisasi Perangkat Daerah dan kategori layanannya.</p>
        </div>
        <button onClick={() => setEditing({ kategori: [] })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Tambah OPD
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Singkatan</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada OPD.</td></tr>}
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{o.nama}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.singkatan}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(o.kategori ?? []).map((k) => (
                      <span key={k} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{k}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(o)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => hapus(o.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing.id ? "Edit OPD" : "Tambah OPD"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nama lengkap</label>
                <input value={editing.nama ?? ""} onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Singkatan</label>
                <input value={editing.singkatan ?? ""} onChange={(e) => setEditing({ ...editing, singkatan: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kategori (pisah dengan koma)</label>
                <input
                  value={(editing.kategori ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, kategori: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="adminduk, perizinan, kesehatan"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
              <button onClick={save} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">
                <Loader2 className="hidden h-3.5 w-3.5 animate-spin" /> Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
