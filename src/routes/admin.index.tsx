// Admin dashboard — DB real.
// - Super admin: lihat semua OPD; bisa filter by OPD; widget SLA, backlog OPD, status sistem
// - Admin OPD: otomatis terbatas ke OPD-nya (RLS yang menjamin)
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, Loader2, CheckCircle2, XCircle, Search, Filter, ArrowUpRight, Clock, Building2, Database as DbIcon, AlertTriangle, ShieldCheck, Users as UsersIcon, FileClock, Newspaper, Settings, FolderOpen, BarChart3, Trash2 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { deletePermohonan } from "@/lib/admin-actions.functions";
import { STATUS_LABEL, STATUS_TONE, fmtTanggal, type StatusPermohonan } from "@/lib/permohonan";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — Kabupaten Buton Selatan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  ),
});

type Permohonan = {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: StatusPermohonan;
  tanggal_masuk: string;
  tenggat: string | null;
  updated_at: string;
  opd_id: string;
  pemohon_id: string;
  petugas_id: string | null;
};
type Opd = { id: string; nama: string; singkatan: string; kategori: string[] };

const STATUS_OPTIONS: ("semua" | StatusPermohonan)[] = ["semua", "baru", "diproses", "selesai", "ditolak"];

function AdminDashboard() {
  const { isSuperAdmin, isAdminDesa, isVerified, profile, roles, user } = useAuth();
  const isAdminOpd = roles.includes("admin_opd");
  const needsVerification = isAdminOpd && !isSuperAdmin && !isVerified;
  const [opdList, setOpdList] = useState<Opd[]>([]);
  const [opdAktifId, setOpdAktifId] = useState<string>("");
  const [items, setItems] = useState<Permohonan[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"semua" | StatusPermohonan>("semua");
  const [kategori, setKategori] = useState<string>("semua");
  const [q, setQ] = useState("");
  const [sysStat, setSysStat] = useState<{ jobs: { pending: number; failed: number; running: number }; users: number; berita: number; layanan: number } | null>(null);
  const [slaMap, setSlaMap] = useState<Map<string, number>>(new Map());

  // Resolve OPD admin
  useEffect(() => {
    supabase.from("opd").select("id,nama,singkatan,kategori").order("nama").then(({ data }) => {
      setOpdList((data ?? []) as Opd[]);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isSuperAdmin) {
      // Admin OPD: ambil opd_id dari profil
      supabase.from("profiles").select("opd_id").eq("id", user.id).maybeSingle().then(({ data }) => {
        setOpdAktifId(data?.opd_id ?? "");
      });
    }
  }, [user, isSuperAdmin]);

  // Load permohonan (RLS membatasi otomatis)
  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("permohonan")
      .select("id,kode,judul,kategori,status,tanggal_masuk,tenggat,updated_at,opd_id,pemohon_id,petugas_id")
      .order("tanggal_masuk", { ascending: false })
      .limit(500);
    if (opdAktifId) q = q.eq("opd_id", opdAktifId);
    q.then(({ data }) => {
      setItems((data ?? []) as Permohonan[]);
      setLoading(false);
    });
  }, [opdAktifId]);

  const opd = opdList.find((o) => o.id === opdAktifId);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (status !== "semua" && p.status !== status) return false;
      if (kategori !== "semua" && p.kategori !== kategori) return false;
      if (q.trim()) {
        const n = q.toLowerCase();
        if (!p.kode.toLowerCase().includes(n) && !p.judul.toLowerCase().includes(n)) return false;
      }
      return true;
    });
  }, [items, status, kategori, q]);

  const kpi = useMemo(() => {
    const c = { baru: 0, diproses: 0, selesai: 0, ditolak: 0 };
    items.forEach((p) => { c[p.status]++; });
    return c;
  }, [items]);

  const trend = useMemo(() => {
    const days: { label: string; key: string; masuk: number; selesai: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), key, masuk: 0, selesai: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    items.forEach((p) => {
      const k = p.tanggal_masuk.slice(0, 10);
      const row = map.get(k);
      if (row) row.masuk++;
      if (p.status === "selesai" && row) row.selesai++;
    });
    return days;
  }, [items]);

  const distribusiKategori = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((p) => m.set(p.kategori, (m.get(p.kategori) ?? 0) + 1));
    return Array.from(m, ([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 8);
  }, [items]);

  // ===== Super Admin only widgets =====
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const [kat, jobs, usrCount, berCount, layCount] = await Promise.all([
        supabase.from("kategori_layanan").select("nama,sla_hari"),
        supabase.from("job_queue").select("status").limit(1000),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("berita").select("id", { count: "exact", head: true }),
        supabase.from("layanan_publik").select("id", { count: "exact", head: true }),
      ]);
      const m = new Map<string, number>();
      (kat.data ?? []).forEach((k) => m.set(k.nama, k.sla_hari));
      setSlaMap(m);
      const counts = { pending: 0, failed: 0, running: 0 };
      (jobs.data ?? []).forEach((j) => {
        if (j.status === "pending") counts.pending++;
        else if (j.status === "failed" || j.status === "dead") counts.failed++;
        else if (j.status === "running") counts.running++;
      });
      setSysStat({
        jobs: counts,
        users: usrCount.count ?? 0,
        berita: berCount.count ?? 0,
        layanan: layCount.count ?? 0,
      });
    })().catch(() => { /* silent */ });
  }, [isSuperAdmin]);

  const slaPerformance = useMemo(() => {
    if (!isSuperAdmin) return [];
    // Hitung kinerja SLA berbasis field `tenggat` & `updated_at` pada permohonan.
    // Fallback ke kategori_layanan.sla_hari bila tenggat null.
    const buckets = new Map<string, { total: number; on: number; targetDays: number | null }>();
    items.forEach((p) => {
      if (p.status !== "selesai") return;
      const masuk = new Date(p.tanggal_masuk).getTime();
      const selesaiTs = new Date(p.updated_at).getTime();
      let onTime = false;
      let targetDays: number | null = null;
      if (p.tenggat) {
        onTime = selesaiTs <= new Date(p.tenggat).getTime();
        targetDays = Math.round((new Date(p.tenggat).getTime() - masuk) / 86400000);
      } else {
        const sla = slaMap.get(p.kategori);
        if (sla == null) return;
        const lamaHari = (selesaiTs - masuk) / 86400000;
        onTime = lamaHari <= sla;
        targetDays = sla;
      }
      const b = buckets.get(p.kategori) ?? { total: 0, on: 0, targetDays };
      b.total++;
      if (onTime) b.on++;
      if (b.targetDays == null) b.targetDays = targetDays;
      buckets.set(p.kategori, b);
    });
    return Array.from(buckets, ([nama, v]) => ({
      nama, persen: v.total ? Math.round((v.on / v.total) * 100) : 0, total: v.total, targetDays: v.targetDays,
    })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [items, slaMap, isSuperAdmin]);

  const opdBacklog = useMemo(() => {
    if (!isSuperAdmin) return [];
    const map = new Map<string, { baru: number; diproses: number }>();
    items.forEach((p) => {
      if (p.status !== "baru" && p.status !== "diproses") return;
      const o = opdList.find((x) => x.id === p.opd_id);
      const key = o?.singkatan ?? "—";
      const cur = map.get(key) ?? { baru: 0, diproses: 0 };
      cur[p.status]++;
      map.set(key, cur);
    });
    return Array.from(map, ([nama, v]) => ({ nama, ...v, total: v.baru + v.diproses }))
      .sort((a, b) => b.total - a.total).slice(0, 6);
  }, [items, opdList, isSuperAdmin]);

  const statusPie = useMemo(() => ([
    { name: "Baru", value: kpi.baru, fill: "oklch(0.55 0.16 258)" },
    { name: "Diproses", value: kpi.diproses, fill: "oklch(0.78 0.14 85)" },
    { name: "Selesai", value: kpi.selesai, fill: "oklch(0.62 0.14 155)" },
    { name: "Ditolak", value: kpi.ditolak, fill: "oklch(0.62 0.20 25)" },
  ].filter((s) => s.value > 0)), [kpi]);

  if (needsVerification) {
    return (
      <AdminShell>
        <div className="mx-auto max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/5 p-8 text-center shadow-soft">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" />
          <h1 className="mt-3 font-display text-xl font-bold">Akun Anda Menunggu Verifikasi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sebagai Admin OPD, akun Anda perlu diverifikasi terlebih dahulu oleh Super Admin sebelum dapat mengakses dashboard. Silakan hubungi Super Admin.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Email: <span className="font-medium text-foreground">{user?.email}</span></p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      opdAktifId={opdAktifId}
      onChangeOpd={isSuperAdmin ? setOpdAktifId : undefined}
    >
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{opd?.singkatan ?? (isAdminDesa && profile?.desa ? `Desa ${profile.desa}` : "Semua OPD")}</div>
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">Dashboard Permohonan Warga</h1>
        <p className="text-sm text-muted-foreground">Pantau & proses pengajuan layanan publik secara terpusat.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Baru" value={kpi.baru} delta="Menunggu verifikasi" tone="accent" icon={Inbox} />
        <StatCard label="Diproses" value={kpi.diproses} delta="Sedang dikerjakan" tone="gold" icon={Loader2} />
        <StatCard label="Selesai" value={kpi.selesai} delta="Total" tone="success" icon={CheckCircle2} />
        <StatCard label="Ditolak" value={kpi.ditolak} delta="Berkas tidak lengkap" tone="destructive" icon={XCircle} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft lg:col-span-2">
          <h2 className="font-display text-base font-semibold">Tren 14 hari terakhir</h2>
          <p className="text-xs text-muted-foreground">Permohonan masuk vs diselesaikan</p>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gMasuk" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.16 258)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.55 0.16 258)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSelesai" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.14 155)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.14 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 250)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.012 250)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="masuk" name="Masuk" stroke="oklch(0.42 0.16 258)" fill="url(#gMasuk)" strokeWidth={2} />
                <Area type="monotone" dataKey="selesai" name="Selesai" stroke="oklch(0.62 0.14 155)" fill="url(#gSelesai)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <h2 className="font-display text-base font-semibold">Distribusi kategori</h2>
          <p className="text-xs text-muted-foreground">Top 8 layanan</p>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribusiKategori} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.012 250)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nama" width={110} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.012 250)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="jumlah" fill="oklch(0.55 0.16 258)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Status Sistem</h2>
                <ShieldCheck className="h-4 w-4 text-success" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-surface p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Pending</div><div className="font-display text-xl font-bold">{sysStat?.jobs.pending ?? "—"}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Failed</div><div className={`font-display text-xl font-bold ${sysStat && sysStat.jobs.failed > 0 ? "text-destructive" : ""}`}>{sysStat?.jobs.failed ?? "—"}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total User</div><div className="font-display text-xl font-bold">{sysStat?.users ?? "—"}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Berita / Layanan</div><div className="font-display text-xl font-bold">{sysStat ? `${sysStat.berita}/${sysStat.layanan}` : "—"}</div></div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <h2 className="font-display text-base font-semibold">Komposisi Status</h2>
              <p className="text-xs text-muted-foreground">Sebaran permohonan</p>
              <div className="mt-2 h-56 w-full">
                {statusPie.length === 0 ? (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">Belum ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                        {statusPie.map((e, i) => (<Cell key={i} fill={e.fill} />))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.012 250)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Top OPD Backlog</h2>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <ul className="mt-3 space-y-1.5">
                {opdBacklog.length === 0 && <li className="rounded-md bg-surface px-3 py-6 text-center text-xs text-muted-foreground">Tidak ada backlog 🎉</li>}
                {opdBacklog.map((o) => (
                  <li key={o.nama} className="flex items-center justify-between rounded-md bg-surface px-3 py-2">
                    <div>
                      <div className="text-sm font-semibold">{o.nama}</div>
                      <div className="text-[10px] text-muted-foreground">{o.baru} baru · {o.diproses} diproses</div>
                    </div>
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{o.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div><h2 className="font-display text-base font-semibold">Kinerja SLA</h2><p className="text-xs text-muted-foreground">% selesai dalam batas SLA per kategori</p></div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            {slaPerformance.length === 0 ? (
              <div className="mt-3 rounded-md bg-surface px-3 py-8 text-center text-xs text-muted-foreground">
                Belum ada permohonan selesai untuk dihitung SLA-nya.
              </div>
            ) : (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {slaPerformance.map((s) => {
                  const tone = s.persen >= 80 ? "bg-success" : s.persen >= 50 ? "bg-gold" : "bg-destructive";
                  return (
                    <li key={s.nama} className="rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{s.nama}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.persen >= 80 ? "bg-success/15 text-success" : s.persen >= 50 ? "bg-gold/20 text-gold-foreground" : "bg-destructive/15 text-destructive"}`}>{s.persen}%</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-border"><div className={`h-full rounded-full ${tone}`} style={{ width: `${s.persen}%` }} /></div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{s.total} selesai{s.targetDays != null ? ` · target ${s.targetDays} hari` : ""}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {sysStat && sysStat.jobs.failed > 0 && (
            <div className="mt-4 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <div className="font-semibold text-foreground">Ada {sysStat.jobs.failed} job gagal</div>
                <p className="text-xs text-muted-foreground">Periksa dari halaman audit / backup.</p>
              </div>
              <Link to="/admin/audit" className="self-center rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">Lihat</Link>
            </div>
          )}
        </>
      )}

      {!(isAdminDesa && !isSuperAdmin) && (
      <section id="tabel" className="mt-6 rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Daftar Permohonan</h2>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{filtered.length}</span>
          </div>
          <div className="md:ml-auto flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kode / judul…"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm sm:w-64"
              />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as "semua" | StatusPermohonan)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === "semua" ? "Semua status" : STATUS_LABEL[s]}</option>
              ))}
            </select>
            {opd && (
              <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="semua">Semua kategori</option>
                {opd.kategori.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Judul</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Memuat…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Tidak ada permohonan.</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-surface/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.kode}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.judul}</td>
                  <td className="px-4 py-3">{p.kategori}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtTanggal(p.tanggal_masuk)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link to="/permohonan/$id" params={{ id: p.id }} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Detail <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      {isSuperAdmin && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Hapus permohonan ${p.kode}? Riwayat, rating & berkas terkait ikut terhapus.`)) return;
                            try {
                              await deletePermohonan({ data: { id: p.id } });
                              setItems((prev) => prev.filter((x) => x.id !== p.id));
                              toast.success("Permohonan dihapus");
                            } catch (e) { toast.error((e as Error).message); }
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          title="Hapus permohonan"
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
      </section>
      )}
    </AdminShell>
  );
}
