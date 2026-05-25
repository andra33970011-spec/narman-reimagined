import { useState, Suspense, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight, ShieldCheck, Database, Users, Megaphone, Search, Building2,
  GraduationCap, HeartPulse, Landmark, Wallet, Wheat, Hammer, Bus, Briefcase,
  Trees, Shield, Scale, Map as MapIcon, Wrench, Factory, Stethoscope, FileText,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { HomeLayananSkeleton } from "@/components/site/Skeletons";
import { homeStatsQueryOptions, opdListQueryOptions, layananCountByOpdQueryOptions } from "@/lib/queries";
import { getShowOpdDirectory, useSiteBranding } from "@/lib/site-settings";
import heroImg from "@/assets/hero-city.jpg";

// Mapping ikon untuk OPD berdasar kata kunci nama/singkatan.
function iconForOpd(nama: string, singkatan: string): LucideIcon {
  const s = (nama + " " + singkatan).toLowerCase();
  if (/(pendidikan|sekolah|guru|dikbud)/.test(s)) return GraduationCap;
  if (/(kesehatan|dinkes|rumah sakit|puskes)/.test(s)) return HeartPulse;
  if (/(rs|rsud|dokter|klinik)/.test(s)) return Stethoscope;
  if (/(keuangan|pajak|bappeda|anggaran|bpkad)/.test(s)) return Wallet;
  if (/(pertanian|tani|perkebunan|peternakan)/.test(s)) return Wheat;
  if (/(pekerjaan umum|pu |pupr|cipta|bina marga)/.test(s)) return Hammer;
  if (/(perhubungan|dishub|transport)/.test(s)) return Bus;
  if (/(tenaga kerja|disnaker|usaha|ukm|koperasi|perdagangan|perindustri)/.test(s)) return Briefcase;
  if (/(lingkungan|kehutanan|dlh)/.test(s)) return Trees;
  if (/(polisi|satpol|pol pp|trantib|keamanan|damkar)/.test(s)) return Shield;
  if (/(hukum|peradilan|advokat)/.test(s)) return Scale;
  if (/(tata ruang|pertanahan|atr)/.test(s)) return MapIcon;
  if (/(industri|pabrik|esdm|energi)/.test(s)) return Factory;
  if (/(perbaikan|teknis|infrastruktur)/.test(s)) return Wrench;
  if (/(arsip|kependudukan|capil|disduk|catatan sipil)/.test(s)) return FileText;
  if (/(sekretariat|setda|bagian)/.test(s)) return Landmark;
  return Building2;
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pemerintah Kabupaten Buton Selatan — Portal Resmi & Satu Data" },
      { name: "description", content: "Portal resmi pelayanan publik dan satu data Kabupaten Buton Selatan. Ajukan layanan, lihat statistik, dan pantau kinerja pemerintah." },
      { property: "og:title", content: "Pemerintah Kabupaten Buton Selatan — Portal Resmi" },
      { property: "og:description", content: "Sentralisasi data dan pelayanan publik kota dalam satu portal." },
    ],
  }),
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(opdListQueryOptions());
    queryClient.prefetchQuery(layananCountByOpdQueryOptions());
    queryClient.prefetchQuery(homeStatsQueryOptions());
  },
  component: HomePage,
});

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("id-ID");
}

function StatsGrid() {
  const { data } = useSuspenseQuery(homeStatsQueryOptions());
  const stats = [
    { label: "Layanan Online", value: formatNumber(data.layananOnline) },
    { label: "Permohonan/bulan", value: formatNumber(data.permohonanBulanIni) },
    { label: "Dataset Terbuka", value: formatNumber(data.datasetTerbuka) },
    { label: "Kepuasan Warga", value: data.kepuasanPersen !== null ? `${data.kepuasanPersen.toFixed(0)}%` : "—" },
  ];
  return (
    <>
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-white/10 p-4">
          <div className="font-display text-2xl font-bold md:text-3xl">{s.value}</div>
          <div className="mt-1 text-xs text-white/80">{s.label}</div>
        </div>
      ))}
    </>
  );
}

function DirektoriOpdGrid() {
  const { data: opdList } = useSuspenseQuery(opdListQueryOptions());
  const { data: counts } = useSuspenseQuery(layananCountByOpdQueryOptions());

  if (opdList.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Belum ada OPD yang terdaftar.
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {opdList.map((o) => {
        const jml = counts[o.id] ?? 0;
        const Icon = iconForOpd(o.nama, o.singkatan);
        return (
          <motion.div key={o.id} whileHover={{ y: -3 }} className="h-full">
            <Link
              to="/instansi/$singkatan"
              params={{ singkatan: o.singkatan }}
              search={{ page: 1 }}
              className="group flex h-full gap-2.5 rounded-xl border border-border bg-card p-3 shadow-soft transition-shadow hover:shadow-elevated"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-soft">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {o.singkatan}
                </div>
                <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-foreground sm:text-sm">
                  {o.nama}
                </h3>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Building2 className="h-2.5 w-2.5" />
                  {jml} layanan
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function HomePage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const [showOpdDir, setShowOpdDir] = useState(true);
  useEffect(() => { getShowOpdDirectory().then(setShowOpdDir).catch(() => {}); }, []);
  const branding = useSiteBranding();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/layanan", search: { q: q.trim() || undefined } as never });
  };

  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{ backgroundImage: `url(${branding.hero_bg_url || heroImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" aria-hidden />
        <div className="container-page relative grid gap-8 py-12 md:py-16 lg:grid-cols-12 lg:gap-10">
          <motion.div initial={false} className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" /> {branding.hero_eyebrow}
            </span>
            <h1 className="mt-4 text-balance text-3xl font-bold leading-tight md:text-5xl">
              {branding.hero_title_line1}<br />{branding.hero_title_line2}<br /><span className="text-gold">{branding.hero_title_line3}</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-white/85 md:text-base">
              {branding.hero_subtitle}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link to="/layanan" className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-primary shadow-elevated hover:bg-white/95">
                {branding.hero_btn_primary} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/data" className="inline-flex h-11 items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15">
                {branding.hero_btn_secondary}
              </Link>
              
            </div>

            <form onSubmit={submitSearch} className="mt-6 flex max-w-xl items-center gap-2 rounded-xl border border-white/20 bg-white/95 p-1.5 shadow-elevated">
              <Search className="ml-2 h-5 w-5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari layanan: KTP, IMB, beasiswa…"
                className="flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Cari
              </button>
            </form>
          </motion.div>

          <motion.div initial={false} className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
              <Suspense fallback={null}>
                <StatsGrid />
              </Suspense>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DIREKTORI OPD */}
      {showOpdDir && (
        <section className="container-page py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-accent">{branding.direktori_eyebrow}</div>
              <h2 className="mt-1 text-2xl font-bold md:text-3xl">{branding.direktori_title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{branding.direktori_desc}</p>
            </div>
            <Link to="/layanan" className="hidden text-sm font-medium text-primary hover:underline md:inline-flex">
              Lihat semua layanan →
            </Link>
          </div>

          <Suspense fallback={null}>
            <DirektoriOpdGrid />
          </Suspense>

          <div className="mt-6 text-center md:hidden">
            <Link to="/layanan" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Lihat semua layanan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* PILAR */}
      <section className="bg-surface py-10">
        <div className="container-page grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Database, title: branding.pilar_1_title, desc: branding.pilar_1_desc },
            { icon: Users, title: branding.pilar_2_title, desc: branding.pilar_2_desc },
            { icon: Megaphone, title: branding.pilar_3_title, desc: branding.pilar_3_desc },
          ].map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-page py-10">
        <div className="overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elevated md:p-10">
          <div className="grid items-center gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">{branding.cta_title}</h2>
              <p className="mt-2 text-white/85">
                {branding.cta_desc}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/kontak" className="inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-semibold text-primary hover:bg-white/95">
                {branding.cta_btn_primary}
              </Link>
              <Link to="/tentang" className="inline-flex h-11 items-center rounded-md border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">
                {branding.cta_btn_secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
