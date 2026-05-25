// Halaman /data dinamis: konten diambil dari tabel `data_terpadu_item`.
// Akses dikontrol via `app_setting.data_terpadu_visible_public` (mode: public | auth).
// Jika mode `auth` & user belum login → tampilkan pemberitahuan + arahkan ke /auth.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Database, TrendingUp, Users, Wallet, Download, Lock, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getAccessMode, type AccessMode } from "@/lib/access-mode";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Satu Data — Pemerintah Kabupaten Buton Selatan" },
      { name: "description", content: "Dashboard data terpadu Kabupaten Buton Selatan: penduduk, anggaran, kinerja layanan, dan ekonomi." },
      { property: "og:title", content: "Satu Data Kabupaten Buton Selatan" },
      { property: "og:description", content: "Visualisasi data publik dan kinerja pemerintah kota." },
    ],
  }),
  component: DataPage,
});

type Item = {
  id: string;
  kategori: "kpi" | "chart_layanan" | "penduduk" | "anggaran" | "dataset";
  label: string;
  nilai_teks: string | null;
  nilai_num: number | null;
  nilai_num2: number | null;
  trend: string | null;
  ikon: string | null;
  format: string | null;
  ukuran: string | null;
  url: string | null;
  opd: string | null;
  urutan: number;
};

const PIE_COLORS = ["oklch(0.42 0.16 258)", "oklch(0.62 0.16 235)", "oklch(0.78 0.13 80)", "oklch(0.62 0.14 155)"];

const ICON_MAP: Record<string, LucideIcon> = {
  Users, Database, Wallet, TrendingUp,
};

function DataPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [accessMode, setAccessModeState] = useState<AccessMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(null);
      const [itemsRes, modeRes] = await Promise.all([
        supabase
          .from("data_terpadu_item")
          .select("id,kategori,label,nilai_teks,nilai_num,nilai_num2,trend,ikon,format,ukuran,url,opd,urutan")
          .eq("aktif", true)
          .order("urutan", { ascending: true }),
        getAccessMode("data_terpadu_visible_public").catch(() => "public" as AccessMode),
      ]);
      if (cancelled) return;
      if (itemsRes.error) {
        console.error("[/data] gagal memuat items:", itemsRes.error);
        setLoadError(itemsRes.error.message);
      }
      setItems((itemsRes.data ?? []) as Item[]);
      setAccessModeState(modeRes);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Mode `auth`: arahkan tamu ke /auth dengan toast pemberitahuan.
  useEffect(() => {
    if (loading || authLoading || accessMode === null) return;
    if (accessMode === "auth" && !user) {
      toast.info("Silakan masuk untuk mengakses Satu Data.", {
        description: "Halaman ini hanya tersedia bagi pengguna yang sudah login.",
      });
      navigate({ to: "/auth", search: { redirect: "/data" } });
    }
  }, [loading, authLoading, accessMode, user, navigate]);

  const kpis = useMemo(() => items.filter((i) => i.kategori === "kpi"), [items]);
  const layananBulanan = useMemo(
    () => items
      .filter((i) => i.kategori === "chart_layanan")
      .map((i) => ({ bulan: i.label, permohonan: Number(i.nilai_num ?? 0), selesai: Number(i.nilai_num2 ?? 0) })),
    [items],
  );
  const penduduk = useMemo(
    () => items
      .filter((i) => i.kategori === "penduduk")
      .map((i) => ({ name: i.label, value: Number(i.nilai_num ?? 0) })),
    [items],
  );
  const anggaran = useMemo(
    () => items
      .filter((i) => i.kategori === "anggaran")
      .map((i) => ({ sektor: i.label, nilai: Number(i.nilai_num ?? 0) })),
    [items],
  );
  const datasets = useMemo(() => items.filter((i) => i.kategori === "dataset"), [items]);

  if (loading || authLoading) {
    return (
      <PageShell>
        <div className="container-page py-20 text-center text-muted-foreground">Memuat data…</div>
      </PageShell>
    );
  }

  if (accessMode === "auth" && !user) {
    return (
      <PageShell>
        <div className="container-page py-20">
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold">Perlu Login</h2>
            <p className="mt-2 text-sm text-muted-foreground">Halaman Satu Data hanya dapat diakses setelah Anda masuk.</p>
            <Link to="/auth" search={{ redirect: "/data" }} className="mt-4 inline-flex h-10 items-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground">
              Masuk Akun
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Satu Data Indonesia"
        title="Data terpadu, terbuka, dan terverifikasi."
        description="Pantau capaian pembangunan, anggaran, dan layanan publik Kabupaten Buton Selatan secara real-time."
      />

      {loadError && (
        <div className="container-page mt-6">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            Gagal memuat data: {loadError}
          </div>
        </div>
      )}
      {items.length === 0 && !loadError && (
        <div className="container-page mt-6">
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum ada item data terpadu yang aktif. Super admin dapat menambahkan via menu <strong>Konfigurasi Sistem</strong>.
          </div>
        </div>
      )}

      {accessMode === "auth" && isSuperAdmin && (
        <div className="container-page mt-6">
          <div className="rounded-lg border border-gold/40 bg-gold/15 p-3 text-xs text-gold-foreground">
            Halaman ini diatur <strong>perlu login</strong>. Pengunjung anonim akan diarahkan ke halaman masuk.
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <section className="container-page -mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => {
            const Icon = (k.ikon && ICON_MAP[k.ikon]) || Database;
            return (
              <div key={k.id} className="rounded-2xl border border-border bg-card p-5 shadow-elevated">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                </div>
                <div className="mt-4 font-display text-2xl font-bold">{k.nilai_teks ?? "-"}</div>
                {k.trend && <div className="mt-1 text-xs text-success">{k.trend}</div>}
              </div>
            );
          })}
        </section>
      )}

      <section className="container-page mt-10 grid gap-6 lg:grid-cols-3">
        {layananBulanan.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
            <h3 className="font-semibold">Permohonan Layanan Publik</h3>
            <p className="text-sm text-muted-foreground">{layananBulanan.length} periode terakhir</p>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={layananBulanan}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.42 0.16 258)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.42 0.16 258)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.16 235)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.62 0.16 235)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 250)" />
                  <XAxis dataKey="bulan" stroke="oklch(0.48 0.03 255)" fontSize={12} />
                  <YAxis stroke="oklch(0.48 0.03 255)" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 250)" }} />
                  <Area type="monotone" dataKey="permohonan" stroke="oklch(0.42 0.16 258)" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="selesai" stroke="oklch(0.62 0.16 235)" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {penduduk.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-semibold">Komposisi Penduduk</h3>
            <p className="text-sm text-muted-foreground">Berdasarkan kelompok usia</p>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={penduduk} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {penduduk.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {anggaran.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-3">
            <h3 className="font-semibold">Alokasi Anggaran per Sektor</h3>
            <p className="text-sm text-muted-foreground">Dalam miliar rupiah, tahun anggaran berjalan</p>
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={anggaran}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 250)" />
                  <XAxis dataKey="sektor" stroke="oklch(0.48 0.03 255)" fontSize={12} />
                  <YAxis stroke="oklch(0.48 0.03 255)" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.012 250)" }} />
                  <Bar dataKey="nilai" fill="oklch(0.42 0.16 258)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {datasets.length > 0 && (
        <section className="container-page mt-12">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold sm:text-2xl">Dataset Terbuka</h2>
            <a href="#" className="text-sm font-medium text-primary hover:underline">Jelajahi katalog →</a>
          </div>

          {/* Card list (mobile) */}
          <ul className="mt-4 grid gap-3 sm:hidden">
            {datasets.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="font-semibold">{d.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{d.opd ?? "-"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-primary-soft px-2 py-0.5 font-medium text-primary">{d.format ?? "-"}</span>
                  <span className="text-muted-foreground">{d.ukuran ?? "-"}</span>
                </div>
                <a href={d.url ?? "#"} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <Download className="h-4 w-4" /> Unduh
                </a>
              </li>
            ))}
          </ul>

          {/* Table (sm+) */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-soft sm:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Dataset</th>
                  <th className="px-5 py-3">OPD</th>
                  <th className="px-5 py-3">Format</th>
                  <th className="px-5 py-3">Ukuran</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/60">
                    <td className="px-5 py-3 font-medium">{d.label}</td>
                    <td className="px-5 py-3 text-muted-foreground">{d.opd ?? "-"}</td>
                    <td className="px-5 py-3"><span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{d.format ?? "-"}</span></td>
                    <td className="px-5 py-3 text-muted-foreground">{d.ukuran ?? "-"}</td>
                    <td className="px-5 py-3 text-right">
                      <a href={d.url ?? "#"} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download className="h-4 w-4" /> Unduh
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </PageShell>
  );
}
