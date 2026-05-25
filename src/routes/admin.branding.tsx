// Super Admin: Kustomisasi tampilan publik (logo, hero bg, nama, hero, pilar, CTA, footer)
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Save, RotateCcw } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_BRANDING,
  getSiteBranding,
  setSiteBranding,
  type SiteBranding,
} from "@/lib/site-settings";

export const Route = createFileRoute("/admin/branding")({
  head: () => ({ meta: [{ title: "Kustomisasi Tampilan — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <BrandingPage />
    </AdminGuard>
  ),
});

function BrandingPage() {
  const { isSuperAdmin } = useAuth();
  const [b, setB] = useState<SiteBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    getSiteBranding().then((v) => setB(v)).finally(() => setLoading(false));
  }, [isSuperAdmin]);

  function update<K extends keyof SiteBranding>(k: K, v: SiteBranding[K]) {
    setB((prev) => ({ ...prev, [k]: v }));
  }

  async function uploadTo(file: File, prefix: "logo" | "hero", setter: (url: string) => void) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, {
      cacheControl: "3600", upsert: true, contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setter(data.publicUrl);
  }

  async function onUploadLogo(file: File) {
    setUploadingLogo(true);
    try {
      await uploadTo(file, "logo", (u) => update("logo_url", u));
      toast.success("Logo diunggah. Jangan lupa klik Simpan.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploadingLogo(false); if (logoRef.current) logoRef.current.value = ""; }
  }
  async function onUploadHero(file: File) {
    setUploadingHero(true);
    try {
      await uploadTo(file, "hero", (u) => update("hero_bg_url", u));
      toast.success("Background hero diunggah. Jangan lupa klik Simpan.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploadingHero(false); if (heroRef.current) heroRef.current.value = ""; }
  }

  async function save() {
    setSaving(true);
    try {
      await setSiteBranding(b);
      toast.success("Pengaturan tampilan disimpan");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  function resetDefault() {
    if (!confirm("Kembalikan semua kolom ke nilai bawaan? Klik Simpan untuk menerapkan.")) return;
    setB(DEFAULT_BRANDING);
  }

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Kustomisasi Tampilan" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Hanya Super Admin.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Kustomisasi Tampilan" }]}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Kustomisasi Tampilan Publik</h1>
          <p className="text-sm text-muted-foreground">
            Atur seluruh teks, logo, gambar, dan identitas kabupaten — berlaku untuk halaman publik & dashboard admin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetDefault}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* LOGO */}
          <section className="lg:col-span-1 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ImageIcon className="h-5 w-5 text-primary" /> Logo Lembaga
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">PNG/SVG transparan, rasio 1:1, min. 256×256.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-20 w-20 place-items-center rounded-lg border border-border bg-surface">
                {b.logo_url ? (
                  <img src={b.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); }} />
                <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
                  <Upload className="h-3.5 w-3.5" /> {uploadingLogo ? "Mengunggah…" : "Unggah Logo"}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs">URL Logo (manual)</Label>
              <Input className="mt-1" value={b.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="Kosongkan untuk pakai bawaan" />
            </div>
          </section>

          {/* HERO BG */}
          <section className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ImageIcon className="h-5 w-5 text-primary" /> Background Hero (Beranda)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Gambar latar di hero halaman beranda. Disarankan 1920×1080 JPG/WebP.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-20 w-32 place-items-center rounded-lg border border-border bg-surface overflow-hidden">
                {b.hero_bg_url ? (
                  <img src={b.hero_bg_url} alt="Hero" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input ref={heroRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadHero(f); }} />
                <button onClick={() => heroRef.current?.click()} disabled={uploadingHero}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60">
                  <Upload className="h-3.5 w-3.5" /> {uploadingHero ? "Mengunggah…" : "Unggah Gambar Hero"}
                </button>
                <Input className="mt-2" value={b.hero_bg_url} onChange={(e) => update("hero_bg_url", e.target.value)} placeholder="atau URL manual" />
              </div>
            </div>
          </section>

          {/* IDENTITAS */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Identitas & Top Bar</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Prefix Nama (atas logo)" value={b.brand_prefix} onChange={(v) => update("brand_prefix", v)} />
              <Field label="Nama Utama (header publik)" value={b.brand_name} onChange={(v) => update("brand_name", v)} />
              <Field label="Nama di Sidebar Admin" value={b.admin_brand_name} onChange={(v) => update("admin_brand_name", v)} />
              <Field label="Teks Top Bar" value={b.top_bar_text} onChange={(v) => update("top_bar_text", v)} />
              <Field label="Meta Title (SEO)" value={b.meta_site_title} onChange={(v) => update("meta_site_title", v)} />
              <Field label="Meta Description (SEO)" value={b.meta_site_description} onChange={(v) => update("meta_site_description", v)} />
            </div>
          </section>

          {/* HERO TEKS */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Hero Beranda — Teks</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Badge / Eyebrow" value={b.hero_eyebrow} onChange={(v) => update("hero_eyebrow", v)} />
              <Field label="Judul Baris 1" value={b.hero_title_line1} onChange={(v) => update("hero_title_line1", v)} />
              <Field label="Judul Baris 2" value={b.hero_title_line2} onChange={(v) => update("hero_title_line2", v)} />
              <Field label="Judul Baris 3 (warna emas)" value={b.hero_title_line3} onChange={(v) => update("hero_title_line3", v)} />
              <div className="sm:col-span-2">
                <Label className="text-xs">Subjudul / Deskripsi</Label>
                <Textarea className="mt-1" rows={3} value={b.hero_subtitle} onChange={(e) => update("hero_subtitle", e.target.value)} />
              </div>
              <Field label="Tombol Utama" value={b.hero_btn_primary} onChange={(v) => update("hero_btn_primary", v)} />
              <Field label="Tombol Sekunder" value={b.hero_btn_secondary} onChange={(v) => update("hero_btn_secondary", v)} />
            </div>
          </section>

          {/* DIREKTORI OPD */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Direktori OPD (Beranda)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Eyebrow" value={b.direktori_eyebrow} onChange={(v) => update("direktori_eyebrow", v)} />
              <Field label="Judul" value={b.direktori_title} onChange={(v) => update("direktori_title", v)} />
              <Field label="Deskripsi" value={b.direktori_desc} onChange={(v) => update("direktori_desc", v)} />
            </div>
          </section>

          {/* PILAR */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Tiga Pilar (Beranda)</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Pilar {i}</div>
                  <div className="mt-2 grid gap-2">
                    <Field label="Judul" value={(b as unknown as Record<string, string>)[`pilar_${i}_title`]} onChange={(v) => update(`pilar_${i}_title` as keyof SiteBranding, v)} />
                    <div>
                      <Label className="text-xs">Deskripsi</Label>
                      <Textarea className="mt-1" rows={3} value={(b as unknown as Record<string, string>)[`pilar_${i}_desc`]} onChange={(e) => update(`pilar_${i}_desc` as keyof SiteBranding, e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Bagian CTA (Beranda)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Judul CTA" value={b.cta_title} onChange={(v) => update("cta_title", v)} />
              <div>
                <Label className="text-xs">Deskripsi</Label>
                <Textarea className="mt-1" rows={2} value={b.cta_desc} onChange={(e) => update("cta_desc", e.target.value)} />
              </div>
              <Field label="Tombol Utama" value={b.cta_btn_primary} onChange={(v) => update("cta_btn_primary", v)} />
              <Field label="Tombol Sekunder" value={b.cta_btn_secondary} onChange={(v) => update("cta_btn_secondary", v)} />
            </div>
          </section>

          {/* FOOTER */}
          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Footer</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nama Organisasi" value={b.footer_org} onChange={(v) => update("footer_org", v)} />
              <Field label="Tagline" value={b.footer_tagline} onChange={(v) => update("footer_tagline", v)} />
              <div className="sm:col-span-2">
                <Label className="text-xs">Deskripsi</Label>
                <Textarea className="mt-1" rows={3} value={b.footer_description} onChange={(e) => update("footer_description", e.target.value)} />
              </div>
              <Field label="Alamat" value={b.footer_address} onChange={(v) => update("footer_address", v)} />
              <Field label="Telepon" value={b.footer_phone} onChange={(v) => update("footer_phone", v)} />
              <div className="sm:col-span-2">
                <Field label="Email" value={b.footer_email} onChange={(v) => update("footer_email", v)} />
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
