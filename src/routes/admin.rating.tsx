// Halaman super admin: lihat & moderasi rating + komentar pemohon.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Star, Trash2, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/rating")({
  head: () => ({ meta: [{ title: "Rating & Komentar — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <RatingPage />
    </AdminGuard>
  ),
});

type RatingRow = {
  rating_id: string;
  skor: number;
  komentar: string | null;
  created_at: string;
  user_id: string | null;
  pemohon_nama: string | null;
  permohonan_id: string | null;
  permohonan_kode: string | null;
  permohonan_judul: string | null;
  opd_id: string | null;
  opd_singkatan: string | null;
  opd_nama: string | null;
};

function RatingPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [opdFilter, setOpdFilter] = useState<string>("__all__");
  const [skorFilter, setSkorFilter] = useState<string>("__all__");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("rating_list_admin");
    if (error) toast.error(error.message);
    setRows((data ?? []) as RatingRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const opdOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.opd_id) map.set(r.opd_id, r.opd_singkatan ?? r.opd_nama ?? r.opd_id);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (opdFilter !== "__all__" && r.opd_id !== opdFilter) return false;
      if (skorFilter !== "__all__" && String(r.skor) !== skorFilter) return false;
      if (!kw) return true;
      return `${r.komentar ?? ""} ${r.pemohon_nama ?? ""} ${r.permohonan_kode ?? ""} ${r.permohonan_judul ?? ""}`
        .toLowerCase()
        .includes(kw);
    });
  }, [rows, q, opdFilter, skorFilter]);

  const stats = useMemo(() => {
    const n = filtered.length;
    const avg = n > 0 ? filtered.reduce((s, r) => s + r.skor, 0) / n : 0;
    const dgnKomen = filtered.filter((r) => r.komentar && r.komentar.trim().length > 0).length;
    return { n, avg, dgnKomen };
  }, [filtered]);

  async function hapus(id: string) {
    if (!confirm("Hapus rating & komentar ini? Tindakan tidak dapat dibatalkan.")) return;
    const { error } = await supabase.from("permohonan_rating").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.rating_id !== id));
    toast.success("Rating dihapus");
  }

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Rating" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Hanya Super Admin.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Rating & Komentar" }]}>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold">Rating & Komentar Pemohon</h1>
        <p className="text-sm text-muted-foreground">Lihat dan moderasi seluruh rating yang diberikan warga atas permohonan mereka.</p>
      </div>

      {/* Stat ringkas */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Total Rating</div>
          <div className="mt-1 text-2xl font-bold">{stats.n}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Rata-rata</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-bold">
            {stats.avg.toFixed(2)}
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Dengan Komentar</div>
          <div className="mt-1 text-2xl font-bold">{stats.dgnKomen}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari komentar / pemohon / kode permohonan..."
            className="h-9 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={opdFilter}
            onChange={(e) => setOpdFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="__all__">Semua OPD</option>
            {opdOptions.map(([id, nama]) => (
              <option key={id} value={id}>{nama}</option>
            ))}
          </select>
          <select
            value={skorFilter}
            onChange={(e) => setSkorFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="__all__">Semua skor</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
              <option key={s} value={String(s)}>{s} bintang</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Belum ada rating.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.rating_id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < r.skor ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{r.skor}/10</span>
                    {r.opd_singkatan && (
                      <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {r.opd_singkatan}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">{r.pemohon_nama || "(Pemohon)"}</span>
                    {r.permohonan_kode && (
                      <span className="text-muted-foreground"> · #{r.permohonan_kode}</span>
                    )}
                    {r.permohonan_judul && (
                      <span className="text-muted-foreground"> · {r.permohonan_judul}</span>
                    )}
                  </div>
                  {r.komentar ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-foreground">
                      {r.komentar}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs italic text-muted-foreground">Tanpa komentar.</p>
                  )}
                </div>
                <button
                  onClick={() => hapus(r.rating_id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                  title="Hapus rating"
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
