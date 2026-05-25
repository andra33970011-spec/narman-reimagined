// Admin CMS: kelola Berita untuk halaman publik /berita.
// (Input layanan dipindah ke halaman /admin/layanan)
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, FileText } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { invalidateBerita } from "@/lib/queries";
import { upsertBerita, deleteBerita } from "@/lib/admin-actions.functions";

export const Route = createFileRoute("/admin/cms")({
  head: () => ({ meta: [{ title: "CMS — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <CmsPage />
    </AdminGuard>
  ),
});

type Berita = { id: string; judul: string; ringkasan: string | null; isi: string; gambar_url: string | null; status: "draft" | "terbit"; published_at: string | null };

function CmsPage() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return <AdminShell breadcrumb={[{ label: "CMS" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div></AdminShell>;

  return (
    <AdminShell breadcrumb={[{ label: "CMS" }]}>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Manajemen Berita</h1>
        <p className="text-sm text-muted-foreground">Editor untuk konten halaman publik /berita. Untuk layanan OPD gunakan menu <strong>Layanan OPD</strong>.</p>
      </div>
      <BeritaTab />
    </AdminShell>
  );
}

function BeritaTab() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Berita[]>([]);
  const [editing, setEditing] = useState<Partial<Berita> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("berita").select("id,judul,ringkasan,isi,gambar_url,status,published_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Berita[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.judul) { toast.error("Judul wajib"); return; }
    try {
      await upsertBerita({ data: {
        id: editing.id, judul: editing.judul,
        ringkasan: editing.ringkasan ?? null, isi: editing.isi ?? "",
        gambar_url: editing.gambar_url ?? null, status: (editing.status ?? "draft") as "draft" | "terbit",
      }});
      await invalidateBerita(qc);
      toast.success("Tersimpan"); setEditing(null); load();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function hapus(id: string) {
    if (!confirm("Hapus berita?")) return;
    try {
      await deleteBerita({ data: { id } });
      await invalidateBerita(qc);
      toast.success("Dihapus"); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setEditing({ status: "draft" })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Berita Baru
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Judul</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Diterbitkan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada berita.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{b.judul}</div>
                  {b.ringkasan && <div className="line-clamp-1 text-xs text-muted-foreground">{b.ringkasan}</div>}
                </td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${b.status === "terbit" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{b.status}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{b.published_at ? new Date(b.published_at).toLocaleDateString("id-ID") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(b)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => hapus(b.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing.id ? "Edit Berita" : "Berita Baru"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Judul"><input value={editing.judul ?? ""} onChange={(e) => setEditing({ ...editing, judul: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" /></Field>
              <Field label="Ringkasan"><input value={editing.ringkasan ?? ""} onChange={(e) => setEditing({ ...editing, ringkasan: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" /></Field>
              <Field label="Isi (mendukung paragraf)"><textarea rows={8} value={editing.isi ?? ""} onChange={(e) => setEditing({ ...editing, isi: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" /></Field>
              <Field label="URL Gambar Sampul"><input value={editing.gambar_url ?? ""} onChange={(e) => setEditing({ ...editing, gambar_url: e.target.value })} placeholder="https://..." className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" /></Field>
              <Field label="Status">
                <select value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as "draft" | "terbit" })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
                  <option value="draft">Draft</option>
                  <option value="terbit">Terbit</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
              <button onClick={save} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
