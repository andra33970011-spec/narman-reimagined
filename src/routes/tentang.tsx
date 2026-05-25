import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { Target, Eye, Award, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Pejabat = { id: string; nama: string; jabatan: string; foto_url: string | null };


export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: "Tentang — Pemerintah Kabupaten Buton Selatan" },
      { name: "description", content: "Visi, misi, struktur organisasi, dan profil Pemerintah Kabupaten Buton Selatan." },
      { property: "og:title", content: "Tentang Pemerintah Kabupaten Buton Selatan" },
      { property: "og:description", content: "Profil resmi dan visi misi Pemerintah Kabupaten Buton Selatan." },
    ],
  }),
  component: TentangPage,
});

function TentangPage() {
  const [pejabat, setPejabat] = useState<Pejabat[]>([]);
  useEffect(() => {
    supabase.from("pejabat")
      .select("id,nama,jabatan,foto_url")
      .eq("aktif", true)
      .order("urutan")
      .then(({ data }) => setPejabat((data ?? []) as Pejabat[]));
  }, []);

  return (
    <PageShell>
      <PageHero
        eyebrow="Profil"
        title="Tentang Pemerintah Kabupaten Buton Selatan."
        description="Bekerja melayani 1,42 juta warga dengan tata kelola modern, transparan, dan berbasis data."
      />

      <section className="container-page py-10 sm:py-14">
        <div className="rounded-3xl bg-surface p-5 sm:p-8 lg:p-10">
          <h2 className="text-xl sm:text-2xl font-bold">Struktur Pemerintahan</h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">Kabupaten Buton Selatan dipimpin oleh Bupati dan Wakil Bupati dengan dukungan 42 Organisasi Perangkat Daerah (OPD).</p>
          {pejabat.length > 0 && (() => {
            const pimpinan = pejabat.slice(0, 2);
            const lainnya = pejabat.slice(2);
            const renderCard = (p: Pejabat) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6 text-center shadow-soft">
                {p.foto_url ? (
                  <img
                    src={p.foto_url}
                    alt={`Foto ${p.nama}`}
                    className="mx-auto h-28 w-28 sm:h-32 sm:w-32 rounded-2xl object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="mx-auto flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-2xl bg-gradient-primary text-2xl font-bold text-primary-foreground">
                    {p.nama.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="mt-4 font-semibold text-sm sm:text-base">{p.nama}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">{p.jabatan}</div>
              </div>
            );
            return (
              <>
                {pimpinan.length > 0 && (
                  <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-4 sm:gap-6">
                    {pimpinan.map((p) => (
                      <div key={p.id} className="w-full max-w-xs sm:w-72">
                        {renderCard(p)}
                      </div>
                    ))}
                  </div>
                )}
                {lainnya.length > 0 && (
                  <div className="mt-4 sm:mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                    {lainnya.map(renderCard)}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="mt-8 sm:mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><Eye className="h-5 w-5" /></div>
            <h3 className="mt-5 text-xl font-semibold">Visi</h3>
            <p className="mt-3 text-muted-foreground text-justify">
              Mewujudkan Kabupaten Buton Selatan sebagai kota cerdas, inklusif, dan berkelanjutan melalui pemerintahan yang melayani dan berbasis data.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><Target className="h-5 w-5" /></div>
            <h3 className="mt-5 text-xl font-semibold">Misi</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>Mensentralisasi layanan publik dalam satu portal terpadu.</li>
              <li>Membangun tata kelola data terbuka dan akuntabel.</li>
              <li>Meningkatkan kualitas hidup warga lintas sektor.</li>
              <li>Memperluas partisipasi publik dalam pembangunan.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><Award className="h-5 w-5" /></div>
            <h3 className="mt-5 text-xl font-semibold">Penghargaan</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>• WTP — BPK RI (8 tahun berturut-turut)</li>
              <li>• Smart City Award 2025</li>
              <li>• Open Data Index Tertinggi Sulawesi Tenggara</li>
              <li>• Penghargaan Pelayanan Prima — Kemenpan RB</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary"><Users className="h-5 w-5" /></div>
            <h3 className="mt-5 text-xl font-semibold">Aparatur</h3>
            <p className="mt-3 text-muted-foreground text-justify">5.257 ASN melayani warga di 42 Organisasi Perangkat Daerah (OPD) di Kabupaten Buton Selatan yang mencakup berbagai dinas, badan, dan kantor yang tersebar di lingkungan pemerintah daerah, 7 kecamatan, dan 70 desa/kelurahan, didukung sistem manajemen kinerja berbasis digital.</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
