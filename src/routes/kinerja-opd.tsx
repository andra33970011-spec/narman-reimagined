// src/routes/kinerja-opd.tsx
// Akses dikontrol via `app_setting.kinerja_opd_visible_public` (mode: public | auth).
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Building2, CheckCircle2, ThumbsUp, TrendingUp, AlertCircle, Lock } from "lucide-react";
import { fetchAllOpdKinerja } from "@/lib/kinerja-queries";
import { STATUS_TONE } from "@/lib/permohonan";
import { useAuth } from "@/lib/auth-context";
import { getAccessMode, type AccessMode } from "@/lib/access-mode";

export const Route = createFileRoute("/kinerja-opd")({
  head: () => ({
    meta: [
      { title: "Kinerja OPD — Pemerintah Kabupaten Buton Selatan" },
      { name: "description", content: "Dashboard publik kinerja setiap Organisasi Perangkat Daerah (OPD) dalam menangani permohonan layanan." },
    ],
  }),
  component: KinerjaOpdPage,
});

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"];

function KinerjaOpdPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [accessMode, setAccessModeState] = useState<AccessMode | null>(null);

  useEffect(() => {
    getAccessMode("kinerja_opd_visible_public").then(setAccessModeState).catch(() => setAccessModeState("public"));
  }, []);

  useEffect(() => {
    if (accessMode === "auth" && !authLoading && !user) {
      toast.info("Silakan masuk untuk mengakses Kinerja OPD.", {
        description: "Halaman ini hanya tersedia bagi pengguna yang sudah login.",
      });
      navigate({ to: "/auth", search: { redirect: "/kinerja-opd" } });
    }
  }, [accessMode, authLoading, user, navigate]);


  const blocked = accessMode === "auth" && !user;

  const { data, isLoading, error } = useQuery({
    queryKey: ["kinerja-opd"],
    queryFn: fetchAllOpdKinerja,
    staleTime: 5 * 60_000, // 5 menit
    enabled: !blocked && accessMode !== null && !authLoading,
  });

  if (blocked) {
    return (
      <PageShell>
        <div className="container-page py-20">
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold">Perlu Login</h2>
            <p className="mt-2 text-sm text-muted-foreground">Halaman Kinerja OPD hanya dapat diakses setelah Anda masuk.</p>
            <Link to="/auth" search={{ redirect: "/kinerja-opd" }} className="mt-4 inline-flex h-10 items-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground">
              Masuk Akun
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }


  if (accessMode === null || authLoading || isLoading) {
    return (
      <PageShell>
        <PageHero title="Dashboard Kinerja OPD" description="Memuat data kinerja..." />
        <div className="container-page py-12 text-center">Memuat data...</div>
      </PageShell>
    );
  }

  if (error || !data) {
    console.error("[/kinerja-opd] gagal:", error);
    return (
      <PageShell>
        <PageHero title="Dashboard Kinerja OPD" description="Terjadi kesalahan saat memuat data." />
        <div className="container-page py-12 text-center text-destructive">
          Gagal memuat data: {(error as Error | null)?.message ?? "tidak diketahui"}.
        </div>
      </PageShell>
    );
  }

  if (data.length === 0) {
    return (
      <PageShell>
        <PageHero title="Dashboard Kinerja OPD" description="Belum ada OPD terdaftar." />
        <div className="container-page py-12 text-center text-muted-foreground">
          Belum ada OPD terdaftar. Super admin dapat menambahkannya via menu OPD.
        </div>
      </PageShell>
    );
  }

  // Data untuk chart batang (total permohonan per OPD)
  const barData = data.map((opd) => ({
    name: opd.opd_singkatan,
    total: opd.total_permohonan,
    selesai: opd.status_counts.selesai,
    tepat_waktu: opd.tepat_waktu_persen ?? 0,
  }));

  // Data pie untuk komposisi status (agregat semua OPD)
  const aggregateStatus = data.reduce(
    (acc, opd) => {
      acc.baru += opd.status_counts.baru;
      acc.diproses += opd.status_counts.diproses;
      acc.selesai += opd.status_counts.selesai;
      acc.ditolak += opd.status_counts.ditolak;
      return acc;
    },
    { baru: 0, diproses: 0, selesai: 0, ditolak: 0 }
  );

  const pieData = [
    { name: "Baru", value: aggregateStatus.baru, color: COLORS[0] },
    { name: "Diproses", value: aggregateStatus.diproses, color: COLORS[1] },
    { name: "Selesai", value: aggregateStatus.selesai, color: COLORS[2] },
    { name: "Ditolak", value: aggregateStatus.ditolak, color: COLORS[3] },
  ].filter((d) => d.value > 0);

  // OPD dengan rating tertinggi
  const topRated = [...data]
    .filter((o) => o.rata_rating !== null)
    .sort((a, b) => (b.rata_rating ?? 0) - (a.rata_rating ?? 0))
    .slice(0, 5);

  return (
    <PageShell>
      <PageHero
        eyebrow="Transparansi Kinerja"
        title="Dashboard Kinerja OPD"
        description="Pantau capaian layanan setiap Organisasi Perangkat Daerah (OPD) dalam menangani permohonan warga."
      />

      <div className="container-page py-10">
        {/* Ringkasan Umum */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-xs uppercase">OPD Aktif</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{data.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs uppercase">Total Permohonan</span>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {data.reduce((sum, o) => sum + o.total_permohonan, 0)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs uppercase">Rata-rata Tepat Waktu</span>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {Math.round(
                data.reduce((sum, o) => sum + (o.tepat_waktu_persen ?? 0), 0) /
                  (data.filter((o) => o.tepat_waktu_persen !== null).length || 1)
              )}
              %
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-xs uppercase">Rata-rata Rating</span>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {(
                data.reduce((sum, o) => sum + (o.rata_rating ?? 0), 0) /
                (data.filter((o) => o.rata_rating !== null).length || 1)
              ).toFixed(1)}
              <span className="text-sm font-medium text-muted-foreground">/10</span>
            </div>
          </div>
        </div>

        {/* Chart Batang Total Permohonan per OPD */}
        <div className="mt-10 rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Total Permohonan per OPD</h2>
          <p className="text-sm text-muted-foreground">Jumlah permohonan yang masuk ke masing-masing OPD</p>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 50, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="total" fill="oklch(0.55 0.16 258)" name="Total Permohonan" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Pie Chart Komposisi Status */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Komposisi Status Permohonan</h2>
            <p className="text-sm text-muted-foreground">Seluruh OPD</p>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 OPD Rating Tertinggi */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">OPD dengan Rating Tertinggi</h2>
            <p className="text-sm text-muted-foreground">Berdasarkan rating warga</p>
            <div className="mt-4 space-y-3">
              {topRated.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada rating</p>
              ) : (
                topRated.map((opd, idx) => (
                  <div key={opd.opd_id} className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <span className="font-medium">{idx + 1}. {opd.opd_nama}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({opd.opd_singkatan})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold">{opd.rata_rating?.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">/10</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tabel Detail per OPD */}
        <div className="mt-10 overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">OPD</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Baru</th>
                  <th className="px-4 py-3">Diproses</th>
                  <th className="px-4 py-3">Selesai</th>
                  <th className="px-4 py-3">Ditolak</th>
                  <th className="px-4 py-3">Rata-rata Hari Selesai</th>
                  <th className="px-4 py-3">Tepat Waktu (%)</th>
                  <th className="px-4 py-3">Rating (/10)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((opd) => (
                  <tr key={opd.opd_id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {opd.opd_nama}
                      <div className="text-xs text-muted-foreground">{opd.opd_singkatan}</div>
                    </td>
                    <td className="px-4 py-3">{opd.total_permohonan}</td>
                    <td className="px-4 py-3">
                      <span className={STATUS_TONE.baru.split(" ")[0] + " px-2 py-0.5 rounded-full text-xs"}>
                        {opd.status_counts.baru}
                      </span>
                    </td>
                    <td className="px-4 py-3">{opd.status_counts.diproses}</td>
                    <td className="px-4 py-3">{opd.status_counts.selesai}</td>
                    <td className="px-4 py-3">{opd.status_counts.ditolak}</td>
                    <td className="px-4 py-3">
                      {opd.rata_hari_selesai !== null ? `${opd.rata_hari_selesai.toFixed(1)} hari` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {opd.tepat_waktu_persen !== null ? `${opd.tepat_waktu_persen.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {opd.rata_rating !== null ? (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{opd.rata_rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/10</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          Data diperbarui setiap 5 menit. Rating bersumber dari warga setelah permohonan selesai.
        </div>
      </div>
    </PageShell>
  );
}
