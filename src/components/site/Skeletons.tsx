import { PageShell, PageHero } from "./PageShell";

/**
 * Skeleton yang menyerupai bentuk konten asli.
 * Tujuan: hilangkan flash spinner & layout shift saat data dimuat.
 */
function Box({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <div className="flex items-center gap-3">
            <Box className="h-11 w-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Box className="h-3 w-1/3" />
              <Box className="h-4 w-2/3" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <Box className="h-3 w-full" />
            <Box className="h-3 w-4/5" />
          </div>
          <div className="mt-6 flex justify-between">
            <Box className="h-3 w-20" />
            <Box className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeaturedArticleSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-soft md:p-12">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <Box className="h-5 w-32" />
          <Box className="h-8 w-full" />
          <Box className="h-8 w-3/4" />
          <Box className="h-4 w-full" />
          <Box className="h-4 w-5/6" />
        </div>
        <Box className="hidden h-56 w-full rounded-2xl md:block" />
      </div>
    </div>
  );
}

export function BeritaPageSkeleton() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Pusat Informasi"
        title="Berita & pengumuman resmi."
        description="Sumber tunggal informasi terverifikasi dari seluruh OPD Pemerintah Kabupaten Buton Selatan."
      />
      <section className="container-page py-14">
        <FeaturedArticleSkeleton />
        <div className="mt-10">
          <CardGridSkeleton count={6} />
        </div>
      </section>
    </PageShell>
  );
}

export function LayananOpdPageSkeleton() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Organisasi Perangkat Daerah"
        title="Jelajahi layanan berdasarkan OPD."
        description="Pilih OPD untuk melihat profil singkat dan seluruh layanan publik yang dikelolanya."
      />
      <section className="container-page py-12">
        <CardGridSkeleton count={9} />
      </section>
    </PageShell>
  );
}

export function InstansiPageSkeleton() {
  return (
    <PageShell>
      <PageHero eyebrow="Memuat" title="Memuat profil OPD…" />
      <section className="container-page py-12">
        <CardGridSkeleton count={6} />
      </section>
    </PageShell>
  );
}

export function LayananDetailSkeleton() {
  return (
    <PageShell>
      <PageHero eyebrow="Layanan" title="Memuat layanan…" />
      <section className="container-page py-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Box className="h-6 w-1/3" />
          <Box className="h-4 w-full" />
          <Box className="h-4 w-5/6" />
          <Box className="h-4 w-4/6" />
          <div className="mt-6 space-y-3">
            <Box className="h-32 w-full rounded-2xl" />
            <Box className="h-32 w-full rounded-2xl" />
          </div>
        </div>
        <div className="space-y-3">
          <Box className="h-40 w-full rounded-2xl" />
          <Box className="h-24 w-full rounded-2xl" />
        </div>
      </section>
    </PageShell>
  );
}

export function HomeLayananSkeleton() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <Box className="h-12 w-12 rounded-xl" />
          <div className="mt-5 space-y-2">
            <Box className="h-5 w-2/3" />
            <Box className="h-3 w-full" />
            <Box className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
