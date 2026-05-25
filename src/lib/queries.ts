import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Invalidasi cache untuk halaman publik setelah mutasi CMS.
 * Dipanggil dari admin (CMS, OPD) agar pengunjung melihat data terbaru
 * tanpa perlu reload paksa.
 */
export const invalidateBerita = (qc: QueryClient) =>
  qc.invalidateQueries({ queryKey: ["berita"] });

export const invalidateLayanan = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ["layanan"] }),
    // count per OPD ikut berubah saat layanan di-CRUD
    qc.invalidateQueries({ queryKey: ["layanan", "count-by-opd"] }),
  ]);

export const invalidateOpd = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ["opd"] }),
    // detail layanan menyertakan info OPD pengelola
    qc.invalidateQueries({ queryKey: ["layanan"] }),
  ]);


export type Berita = {
  id: string;
  judul: string;
  ringkasan: string | null;
  isi: string;
  gambar_url: string | null;
  published_at: string | null;
};

export type Opd = {
  id: string;
  singkatan: string;
  nama: string;
  kategori: string[];
};

export type LayananRingkas = {
  id: string;
  judul: string;
  slug: string;
  deskripsi: string | null;
  persyaratan?: string | null;
};

export type HomeStats = {
  layananOnline: number;
  permohonanBulanIni: number;
  datasetTerbuka: number;
  kepuasanPersen: number | null;
};

export const homeStatsQueryOptions = () =>
  queryOptions({
    queryKey: ["home", "stats"],
    queryFn: async (): Promise<HomeStats> => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [layananRes, permohonanRes, datasetRes, ratingRes] = await Promise.all([
        supabase.from("layanan_publik").select("*", { count: "exact", head: true }).eq("aktif", true),
        supabase.rpc("count_permohonan_bulan_ini"),
        supabase.from("data_terpadu_item").select("*", { count: "exact", head: true }).eq("aktif", true),
        supabase.from("permohonan_rating").select("skor"),
      ]);

      const ratings = (ratingRes.data ?? []) as { skor: number }[];
      const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.skor, 0) / ratings.length : null;
      const kepuasanPersen = avg !== null ? (avg / 10) * 100 : null;

      return {
        layananOnline: layananRes.count ?? 0,
        permohonanBulanIni: (permohonanRes.data as number | null) ?? 0,
        datasetTerbuka: datasetRes.count ?? 0,
        kepuasanPersen,
      };
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });

export type LayananWithOpd = {
  id: string;
  judul: string;
  slug: string;
  deskripsi: string | null;
  sla_hari: number;
  urutan: number;
  opd: { id: string; singkatan: string; nama: string; kategori: string[] } | null;
};

export const layananAllWithOpdQueryOptions = () =>
  queryOptions({
    queryKey: ["layanan", "all-with-opd"],
    queryFn: async (): Promise<LayananWithOpd[]> => {
      const { data, error } = await supabase
        .from("layanan_publik")
        .select("id,judul,slug,deskripsi,sla_hari,urutan,opd:opd!opd_id(id,singkatan,nama,kategori)")
        .eq("aktif", true)
        .order("urutan");
      if (error) throw error;
      return (data ?? []) as unknown as LayananWithOpd[];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

export const layananHomeQueryOptions = () =>
  queryOptions({
    queryKey: ["layanan", "home-top"],
    queryFn: async (): Promise<LayananRingkas[]> => {
      const { data, error } = await supabase
        .from("layanan_publik")
        .select("id,judul,slug,deskripsi")
        .eq("aktif", true)
        .order("urutan")
        .limit(6);
      if (error) throw error;
      return (data ?? []) as LayananRingkas[];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

export type LayananDetail = {
  id: string;
  judul: string;
  slug: string;
  deskripsi: string | null;
  persyaratan: string | null;
  alur: string | null;
  opd_id: string | null;
  sla_hari: number;
};

const FIVE_MIN = 5 * 60_000;
const TEN_MIN = 10 * 60_000;

export const beritaListQueryOptions = () =>
  queryOptions({
    queryKey: ["berita", "list"],
    queryFn: async (): Promise<Berita[]> => {
      const { data, error } = await supabase
        .from("berita")
        .select("id,judul,ringkasan,isi,gambar_url,published_at")
        .eq("status", "terbit")
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Berita[];
    },
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

export const opdListQueryOptions = () =>
  queryOptions({
    queryKey: ["opd", "list"],
    queryFn: async (): Promise<Opd[]> => {
      const { data, error } = await supabase
        .from("opd")
        .select("id,singkatan,nama,kategori")
        .order("singkatan");
      if (error) throw error;
      return (data ?? []) as Opd[];
    },
    staleTime: TEN_MIN,
    gcTime: TEN_MIN * 2,
  });

export const layananCountByOpdQueryOptions = () =>
  queryOptions({
    queryKey: ["layanan", "count-by-opd"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("layanan_publik")
        .select("opd_id")
        .eq("aktif", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      ((data ?? []) as { opd_id: string | null }[]).forEach((x) => {
        if (x.opd_id) counts[x.opd_id] = (counts[x.opd_id] ?? 0) + 1;
      });
      return counts;
    },
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

export const opdBySingkatanQueryOptions = (singkatan: string) =>
  queryOptions({
    queryKey: ["opd", "by-singkatan", singkatan],
    queryFn: async (): Promise<Opd | null> => {
      const { data, error } = await supabase
        .from("opd")
        .select("id,singkatan,nama,kategori")
        .eq("singkatan", singkatan)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Opd | null;
    },
    staleTime: TEN_MIN,
    gcTime: TEN_MIN * 2,
  });

export const layananByOpdIdQueryOptions = (opdId: string) =>
  queryOptions({
    queryKey: ["layanan", "by-opd", opdId],
    queryFn: async (): Promise<LayananRingkas[]> => {
      const { data, error } = await supabase
        .from("layanan_publik")
        .select("id,judul,slug,deskripsi,persyaratan")
        .eq("aktif", true)
        .eq("opd_id", opdId)
        .order("urutan");
      if (error) throw error;
      return (data ?? []) as LayananRingkas[];
    },
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

export const layananBySlugQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["layanan", "by-slug", slug],
    queryFn: async (): Promise<LayananDetail | null> => {
      const { data, error } = await supabase
        .from("layanan_publik")
        .select("id,judul,slug,deskripsi,persyaratan,alur,opd_id,sla_hari")
        .eq("slug", slug)
        .eq("aktif", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LayananDetail | null;
    },
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

export const opdByIdQueryOptions = (opdId: string) =>
  queryOptions({
    queryKey: ["opd", "by-id", opdId],
    queryFn: async (): Promise<Opd | null> => {
      const { data, error } = await supabase
        .from("opd")
        .select("id,singkatan,nama,kategori")
        .eq("id", opdId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Opd | null;
    },
    staleTime: TEN_MIN,
    gcTime: TEN_MIN * 2,
  });
