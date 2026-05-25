import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { MapPin, Phone, Mail, Clock, MessageSquare, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/kontak")({
  head: () => ({
    meta: [
      { title: "Kontak & LAPOR! — Pemerintah Kabupaten Buton Selatan" },
      { name: "description", content: "Hubungi Pemerintah Kabupaten Buton Selatan atau sampaikan laporan & aspirasi melalui kanal LAPOR!." },
      { property: "og:title", content: "Kontak Pemerintah Kabupaten Buton Selatan" },
      { property: "og:description", content: "Saluran resmi pengaduan dan kontak Pemerintah Kabupaten Buton Selatan." },
    ],
  }),
  component: KontakPage,
});

const KATEGORI = [
  "Infrastruktur & Jalan",
  "Kebersihan & Sampah",
  "Pelayanan Publik",
  "Kesehatan",
  "Pendidikan",
  "Lainnya",
];

function KontakPage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState({
    nama: "", nik: "", email: "", no_hp: "",
    kategori: KATEGORI[0], lokasi: "", uraian: "",
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Silakan masuk terlebih dahulu untuk mengirim laporan");
    if (!form.nama || !form.email || !form.uraian) return toast.error("Lengkapi data wajib");
    setBusy(true);
    try {
      const { error } = await supabase.from("laporan_masyarakat").insert({
        nama: form.nama,
        nik: form.nik || null,
        email: form.email,
        no_hp: form.no_hp || null,
        kategori: form.kategori,
        lokasi: form.lokasi || null,
        uraian: form.uraian,
      });
      if (error) throw error;
      toast.success("Laporan terkirim! Tim kami akan menindaklanjuti.");
      setForm({ nama: "", nik: "", email: "", no_hp: "", kategori: KATEGORI[0], lokasi: "", uraian: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Kontak & Aspirasi"
        title="Kami mendengar. Kami menindaklanjuti."
        description="Sampaikan laporan, pertanyaan, atau aspirasi Anda. Setiap pesan tercatat dan ditindaklanjuti OPD terkait."
      />

      {!loading && !user && (
        <section className="container-page pt-8">
          <div className="mx-auto max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
            <div className="flex items-start gap-3">
              <LogIn className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-400" />
              <div className="flex-1">
                <div className="font-semibold text-foreground">Masuk diperlukan</div>
                <p className="mt-1 text-muted-foreground">
                  Untuk mencegah penyalahgunaan, fitur LAPOR! kini hanya dapat digunakan oleh akun warga yang sudah masuk.
                </p>
                <Link to="/auth" search={{ redirect: "/kontak" } as never} className="mt-3 inline-flex h-9 items-center rounded-md bg-gradient-primary px-4 text-xs font-semibold text-primary-foreground">
                  Masuk Akun
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={`container-page py-14 ${!user && !loading ? "pointer-events-none opacity-50" : ""}`}>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4">
            {[
              { icon: MapPin, title: "Alamat", value: "Balai Kota, Jl. Merdeka No. 1\nKabupaten Buton Selatan 16110" },
              { icon: Phone, title: "Telepon", value: "(021) 555-0100\nHotline: 112" },
              { icon: Mail, title: "Email", value: "info@butonselatan.go.id\npengaduan@butonselatan.go.id" },
              { icon: Clock, title: "Jam Pelayanan", value: "Senin–Jumat: 08.00–16.00\nSabtu: 08.00–12.00" },
            ].map((it) => (
              <div key={it.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <it.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{it.title}</div>
                    <div className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{it.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-8 shadow-elevated lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Kanal LAPOR!</h2>
                <p className="text-sm text-muted-foreground">Layanan Aspirasi dan Pengaduan Online Rakyat</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Nama Lengkap"><input required className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama sesuai KTP" /></Field>
              <Field label="NIK"><input className="input" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} placeholder="16 digit NIK (opsional)" /></Field>
              <Field label="Email"><input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@contoh.com" /></Field>
              <Field label="No. Telepon"><input className="input" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} placeholder="08xx-xxxx-xxxx" /></Field>
              <Field label="Kategori" className="md:col-span-2">
                <select className="input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                  {KATEGORI.map((k) => <option key={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Lokasi Kejadian" className="md:col-span-2">
                <input className="input" value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} placeholder="Kelurahan, kecamatan, atau alamat" />
              </Field>
              <Field label="Uraian Laporan" className="md:col-span-2">
                <textarea required rows={5} className="input resize-none" value={form.uraian} onChange={(e) => setForm({ ...form, uraian: e.target.value })} placeholder="Jelaskan secara rinci…" />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Data Anda dilindungi sesuai UU Perlindungan Data Pribadi.</p>
              <button disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-md bg-gradient-primary px-7 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Mengirim…" : "Kirim Laporan"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          border-radius: 0.625rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: var(--color-foreground);
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px oklch(0.55 0.16 258 / 0.18); }
      `}</style>
    </PageShell>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
