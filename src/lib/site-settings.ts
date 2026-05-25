// Helper klien untuk membaca/menulis app_setting & data desa.
import { supabase } from "@/integrations/supabase/client";

export type Desa = { id: string; nama: string; kecamatan: string | null; aktif: boolean };

export async function fetchDesaList(onlyAktif = true): Promise<Desa[]> {
  let q = supabase.from("desa").select("id,nama,kecamatan,aktif").order("nama");
  if (onlyAktif) q = q.eq("aktif", true);
  const { data } = await q;
  return (data ?? []) as Desa[];
}

export async function getPermohonanVerificationRequired(): Promise<boolean> {
  const { data } = await supabase
    .from("app_setting")
    .select("value")
    .eq("key", "permohonan_require_verification")
    .maybeSingle();
  const v = (data?.value as { required?: boolean } | null) ?? null;
  return !!v?.required;
}

export type SiteBranding = {
  // identitas
  logo_url: string;
  brand_prefix: string;
  brand_name: string;
  admin_brand_name: string;
  top_bar_text: string;
  // SEO
  meta_site_title: string;
  meta_site_description: string;
  // hero
  hero_bg_url: string;
  hero_eyebrow: string;
  hero_title_line1: string;
  hero_title_line2: string;
  hero_title_line3: string;
  hero_subtitle: string;
  hero_btn_primary: string;
  hero_btn_secondary: string;
  // direktori OPD
  direktori_eyebrow: string;
  direktori_title: string;
  direktori_desc: string;
  // 3 pilar
  pilar_1_title: string;
  pilar_1_desc: string;
  pilar_2_title: string;
  pilar_2_desc: string;
  pilar_3_title: string;
  pilar_3_desc: string;
  // CTA
  cta_title: string;
  cta_desc: string;
  cta_btn_primary: string;
  cta_btn_secondary: string;
  // footer
  footer_org: string;
  footer_tagline: string;
  footer_description: string;
  footer_address: string;
  footer_phone: string;
  footer_email: string;
};

export const DEFAULT_BRANDING: SiteBranding = {
  logo_url: "",
  brand_prefix: "PEMERINTAH KABUPATEN",
  brand_name: "Nama Kabupaten",
  admin_brand_name: "Dashboard Admin",
  top_bar_text: "Portal Resmi Pemerintah Kabupaten",
  meta_site_title: "Portal Resmi Pemerintah Kabupaten",
  meta_site_description: "Portal resmi pelayanan publik dan satu data Pemerintah Kabupaten.",
  hero_bg_url: "",
  hero_eyebrow: "Portal Resmi Pemerintah",
  hero_title_line1: "Satu Pintu,",
  hero_title_line2: "Satu Data,",
  hero_title_line3: "Satu Pelayanan.",
  hero_subtitle: "Akses seluruh layanan publik dan data pemerintah terpadu dalam satu tempat — cepat, transparan, dan terverifikasi.",
  hero_btn_primary: "Mulai Layanan",
  hero_btn_secondary: "Lihat Satu Data",
  direktori_eyebrow: "Direktori OPD",
  direktori_title: "Dinas & Perangkat Daerah",
  direktori_desc: "Kenali setiap OPD dan layanan yang dikelolanya.",
  pilar_1_title: "Satu Data Terpadu",
  pilar_1_desc: "Semua dataset pemerintah dalam satu standar — terbuka, terverifikasi, dan dapat diunduh.",
  pilar_2_title: "Pelayanan Sentralistik",
  pilar_2_desc: "Warga cukup satu akun untuk seluruh layanan: adminduk, perizinan, kesehatan, hingga pajak.",
  pilar_3_title: "Transparansi Real-time",
  pilar_3_desc: "Dashboard kinerja, anggaran, dan capaian program publik dapat dipantau langsung.",
  cta_title: "Punya keluhan atau aspirasi?",
  cta_desc: "Sampaikan langsung melalui kanal LAPOR! Setiap laporan dipantau dan ditindaklanjuti oleh OPD terkait.",
  cta_btn_primary: "Lapor Sekarang",
  cta_btn_secondary: "Tentang Pemerintah",
  footer_org: "Pemerintah Kabupaten",
  footer_tagline: "Melayani dengan integritas & data",
  footer_description: "Situs resmi pemusatan pelayanan publik dan data terintegrasi. Transparan, terpadu, dan dapat diakses kapan saja.",
  footer_address: "—",
  footer_phone: "—",
  footer_email: "—",
};

const BRANDING_LS_KEY = "site_branding_cache_v1";

function readBrandingCache(): SiteBranding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRANDING_LS_KEY);
    if (!raw) return null;
    return { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<SiteBranding>) };
  } catch { return null; }
}

function writeBrandingCache(b: SiteBranding) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANDING_LS_KEY, JSON.stringify(b));
    window.dispatchEvent(new CustomEvent("site-branding-updated", { detail: b }));
  } catch {}
}

export async function getSiteBranding(): Promise<SiteBranding> {
  const { data } = await supabase
    .from("app_setting")
    .select("value")
    .eq("key", "site_branding")
    .maybeSingle();
  const v = (data?.value as Partial<SiteBranding> | null) ?? null;
  const merged = { ...DEFAULT_BRANDING, ...(v ?? {}) };
  writeBrandingCache(merged);
  return merged;
}

export async function setSiteBranding(b: SiteBranding): Promise<void> {
  const { error } = await supabase
    .from("app_setting")
    .upsert({ key: "site_branding", value: b as unknown as never }, { onConflict: "key" });
  if (error) throw error;
  writeBrandingCache(b);
}

import { useEffect, useState } from "react";
export function useSiteBranding(): SiteBranding {
  const [b, setB] = useState<SiteBranding>(() => readBrandingCache() ?? DEFAULT_BRANDING);
  useEffect(() => {
    let alive = true;
    getSiteBranding().then((v) => { if (alive) setB(v); }).catch(() => {});
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<SiteBranding>).detail;
      if (detail) setB(detail);
    };
    window.addEventListener("site-branding-updated", onUpdate);
    return () => { alive = false; window.removeEventListener("site-branding-updated", onUpdate); };
  }, []);
  return b;
}

export async function getShowOpdDirectory(): Promise<boolean> {
  const { data } = await supabase
    .from("app_setting")
    .select("value")
    .eq("key", "show_opd_directory")
    .maybeSingle();
  const v = (data?.value as { visible?: boolean } | null) ?? null;
  return v?.visible !== false;
}
