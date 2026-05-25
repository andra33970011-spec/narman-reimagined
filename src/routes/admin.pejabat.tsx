// Admin: kelola Pejabat (Bupati, Wakil Bupati, dst.) di halaman Tentang.
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Upload, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertPejabat, deletePejabat } from "@/lib/admin-actions.functions";

export const Route = createFileRoute("/admin/pejabat")({
  head: () => ({ meta: [{ title: "Pejabat — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <PejabatPage />
    </AdminGuard>
  ),
});

type Pejabat = {
  id: string;
  nama: string;
  jabatan: string;
  foto_url: string | null;
  urutan: number;
  aktif: boolean;
};

function PejabatPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Pejabat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Pejabat> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("pejabat")
      .select("id,nama,jabatan,foto_url,urutan,aktif")
      .order("urutan");
    setRows((data ?? []) as Pejabat[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function uploadFoto(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran maksimal 5 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pejabat-foto").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("pejabat-foto").getPublicUrl(path);
      setEditing((prev) => ({ ...prev, foto_url: pub.publicUrl }));
      toast.success("Foto terunggah");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!editing?.nama || !editing?.jabatan) { toast.error("Nama & jabatan wajib"); return; }
    try {
      await upsertPejabat({ data: {
        id: editing.id,
        nama: editing.nama,
        jabatan: editing.jabatan,
        foto_url: editing.foto_url ?? null,
        urutan: editing.urutan ?? 0,
        aktif: editing.aktif ?? true,
      }});
      qc.invalidateQueries({ queryKey: ["pejabat"] });
      toast.success("Tersimpan");
      setEditing(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggleAktif(p: Pejabat) {
    try {
      await upsertPejabat({ data: {
        id: p.id, nama: p.nama, jabatan: p.jabatan, foto_url: p.foto_url,
        urutan: p.urutan, aktif: !p.aktif,
      }});
      qc.invalidateQueries({ queryKey: ["pejabat"] });
      toast.success(!p.aktif ? "Diaktifkan" : "Dinonaktifkan");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus pejabat ini?")) return;
    try {
      await deletePejabat({ data: { id } });
      qc.invalidateQueries({ queryKey: ["pejabat"] });
      toast.success("Dihapus");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Pejabat" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Hanya Super Admin.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Pejabat" }]}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Struktur Pemerintahan</h1>
          <p className="text-sm text-muted-foreground">
            Kelola pejabat yang tampil di halaman <span className="font-medium">Tentang</span>. Nonaktifkan untuk menyembunyikan tanpa menghapus data.
          </p>
        </div>
        <button
          onClick={() => setEditing({ aktif: true, urutan: rows.length + 1 })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Pejabat Baru
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Foto</th>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Jabatan</th>
              <th className="px-4 py-3 font-medium">Urutan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Belum ada pejabat.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nama} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                      {p.nama.split(" ").map(s => s[0]).slice(0, 2).join("")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{p.nama}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.jabatan}</td>
                <td className="px-4 py-3 font-mono">{p.urutan}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleAktif(p)}
                    className={`rounded-full px-2 py-0.5 text-xs ${p.aktif ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                    title="Klik untuk toggle"
                  >
                    {p.aktif ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => hapus(p.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10">
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
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing.id ? "Edit Pejabat" : "Pejabat Baru"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {editing.foto_url ? (
                  <img src={editing.foto_url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground">
                    {(editing.nama || "?").split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Mengunggah…" : "Unggah Foto"}
                  </button>
                  {editing.foto_url && (
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, foto_url: null })}
                      className="block text-xs text-destructive hover:underline"
                    >
                      Hapus foto
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">JPG/PNG, maks 5 MB. Disarankan rasio 1:1.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Nama lengkap</label>
                <input value={editing.nama ?? ""} onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Jabatan</label>
                <input value={editing.jabatan ?? ""} onChange={(e) => setEditing({ ...editing, jabatan: e.target.value })}
                  placeholder="Contoh: Bupati"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Urutan tampil</label>
                  <input type="number" value={editing.urutan ?? 0}
                    onChange={(e) => setEditing({ ...editing, urutan: Number(e.target.value) })}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
                </div>
                <label className="flex items-end gap-2 pb-1 text-sm">
                  <input type="checkbox" checked={editing.aktif ?? true}
                    onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })} />
                  Tampilkan di halaman Tentang
                </label>
              </div>
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
