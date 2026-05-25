// Admin: kelola Laporan Masyarakat (kanal LAPOR! dari /kontak).
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, MessageSquare, Search, X, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteLaporan } from "@/lib/admin-actions.functions";

export const Route = createFileRoute("/admin/laporan")({
  head: () => ({ meta: [{ title: "Laporan Masyarakat — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <LaporanPage />
    </AdminGuard>
  ),
});

type Opd = { id: string; nama: string; singkatan: string };
type Laporan = {
  id: string;
  nama: string;
  nik: string | null;
  email: string;
  no_hp: string | null;
  kategori: string;
  lokasi: string | null;
  uraian: string;
  status: string;
  opd_id: string | null;
  tindak_lanjut: string | null;
  created_at: string;
};

const STATUSES = ["baru", "diproses", "selesai", "ditolak"] as const;
const STATUS_TONE: Record<string, string> = {
  baru: "bg-primary-soft text-primary",
  diproses: "bg-amber-100 text-amber-800",
  selesai: "bg-success/15 text-success",
  ditolak: "bg-destructive/15 text-destructive",
};

function LaporanPage() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<Laporan[]>([]);
  const [opds, setOpds] = useState<Opd[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [open, setOpen] = useState<Laporan | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: o }] = await Promise.all([
      supabase.from("laporan_masyarakat").select("*").order("created_at", { ascending: false }),
      supabase.from("opd").select("id,nama,singkatan").order("nama"),
    ]);
    setRows((l ?? []) as Laporan[]);
    setOpds((o ?? []) as Opd[]);
    setLoading(false);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!r.nama.toLowerCase().includes(s) && !r.uraian.toLowerCase().includes(s) && !r.kategori.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, filterStatus, q]);

  async function simpan() {
    if (!open) return;
    const { error } = await supabase
      .from("laporan_masyarakat")
      .update({
        status: open.status,
        opd_id: open.opd_id,
        tindak_lanjut: open.tindak_lanjut,
      })
      .eq("id", open.id);
    if (error) return toast.error(error.message);
    toast.success("Laporan diperbarui");
    setOpen(null);
    load();
  }

  if (!isAdmin) {
    return <AdminShell breadcrumb={[{ label: "Laporan Masyarakat" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Akses ditolak.</div></AdminShell>;
  }

  return (
    <AdminShell breadcrumb={[{ label: "Laporan Masyarakat" }]}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Laporan Masyarakat</h1>
          <p className="text-sm text-muted-foreground">Pengaduan dan aspirasi dari kanal LAPOR! pada halaman /kontak.</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/uraian/kategori…" className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">Semua Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="self-center text-xs text-muted-foreground">{filtered.length} laporan</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Pelapor</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Uraian</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Belum ada laporan.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.nama}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="px-4 py-3"><span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{r.kategori}</span></td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{r.uraian}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_TONE[r.status] ?? "bg-muted"}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => setOpen(r)} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">Detail</button>
                    {isSuperAdmin && (
                      <button
                        onClick={async () => {
                          if (!confirm("Hapus laporan ini? Tindakan tidak dapat dibatalkan.")) return;
                          try {
                            await deleteLaporan({ data: { id: r.id } });
                            setRows((prev) => prev.filter((x) => x.id !== r.id));
                            toast.success("Laporan dihapus");
                          } catch (e) { toast.error((e as Error).message); }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                        title="Hapus laporan"
                      >
                        <Trash2 className="h-3 w-3" /> Hapus
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Detail Laporan</h2>
              <button onClick={() => setOpen(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Nama">{open.nama}</Info>
                <Info label="NIK">{open.nik || "—"}</Info>
                <Info label="Email">{open.email}</Info>
                <Info label="No. HP">{open.no_hp || "—"}</Info>
                <Info label="Kategori">{open.kategori}</Info>
                <Info label="Lokasi">{open.lokasi || "—"}</Info>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Uraian</label>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">{open.uraian}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select value={open.status} onChange={(e) => setOpen({ ...open, status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">OPD penanggung jawab</label>
                  <select value={open.opd_id ?? ""} onChange={(e) => setOpen({ ...open, opd_id: e.target.value || null })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
                    <option value="">— Belum ditentukan —</option>
                    {opds.map((o) => <option key={o.id} value={o.id}>{o.singkatan} — {o.nama}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tindak lanjut</label>
                <textarea rows={4} value={open.tindak_lanjut ?? ""} onChange={(e) => setOpen({ ...open, tindak_lanjut: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Catatan respons / tindak lanjut…" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(null)} className="h-9 rounded-md border border-border px-3 text-sm">Tutup</button>
              <button onClick={simpan} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
