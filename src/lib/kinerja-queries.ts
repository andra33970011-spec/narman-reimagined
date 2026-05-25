// src/lib/kinerja-queries.ts
import { supabase } from "@/integrations/supabase/client";
import type { StatusPermohonan } from "./permohonan";

export type OpdKinerja = {
  opd_id: string;
  opd_nama: string;
  opd_singkatan: string;
  total_permohonan: number;
  status_counts: Record<StatusPermohonan, number>;
  rata_hari_selesai: number | null;
  rata_rating: number | null;
  tepat_waktu_persen: number | null;
};

export async function fetchAllOpdKinerja(): Promise<OpdKinerja[]> {
  // 1. Ambil semua OPD
  const { data: opds, error: opdError } = await supabase
    .from("opd")
    .select("id, nama, singkatan");
  if (opdError) throw opdError;

  // 2. Ambil agregat permohonan via RPC (bypass RLS, dapat diakses publik)
  const { data: aggRows, error: pError } = await supabase.rpc("opd_kinerja_agg");
  if (pError) throw pError;

  // 3. Ambil agregat rating per OPD via RPC publik
  const { data: ratingRows } = await supabase.rpc("opd_rating_agg");
  const ratingByOpd = new Map<string, { total: number; count: number }>();
  ((ratingRows ?? []) as Array<{ opd_id: string; total_rating: number; jumlah_rating: number }>).forEach((r) => {
    if (!r.opd_id) return;
    ratingByOpd.set(r.opd_id, { total: Number(r.total_rating) || 0, count: Number(r.jumlah_rating) || 0 });
  });

  // 4. Aggregate rows per OPD
  type Agg = {
    total: number;
    status_counts: Record<StatusPermohonan, number>;
    totalHariSelesai: number;
    jumlahSelesai: number;
    tepatWaktu: number;
    selesaiDenganSLA: number;
  };
  const aggByOpd = new Map<string, Agg>();
  for (const row of (aggRows ?? []) as Array<{
    opd_id: string;
    status: string;
    total: number;
    total_hari_selesai: number;
    jumlah_selesai: number;
    tepat_waktu: number;
    selesai_dengan_sla: number;
  }>) {
    if (!row.opd_id) continue;
    const cur: Agg = aggByOpd.get(row.opd_id) ?? {
      total: 0,
      status_counts: { baru: 0, diproses: 0, selesai: 0, ditolak: 0 },
      totalHariSelesai: 0,
      jumlahSelesai: 0,
      tepatWaktu: 0,
      selesaiDenganSLA: 0,
    };
    cur.total += Number(row.total) || 0;
    if (row.status in cur.status_counts) {
      cur.status_counts[row.status as StatusPermohonan] += Number(row.total) || 0;
    }
    cur.totalHariSelesai += Number(row.total_hari_selesai) || 0;
    cur.jumlahSelesai += Number(row.jumlah_selesai) || 0;
    cur.tepatWaktu += Number(row.tepat_waktu) || 0;
    cur.selesaiDenganSLA += Number(row.selesai_dengan_sla) || 0;
    aggByOpd.set(row.opd_id, cur);
  }

  const result: OpdKinerja[] = opds.map((opd) => {
    const a = aggByOpd.get(opd.id) ?? {
      total: 0,
      status_counts: { baru: 0, diproses: 0, selesai: 0, ditolak: 0 } as Record<StatusPermohonan, number>,
      totalHariSelesai: 0,
      jumlahSelesai: 0,
      tepatWaktu: 0,
      selesaiDenganSLA: 0,
    };
    const r = ratingByOpd.get(opd.id);
    return {
      opd_id: opd.id,
      opd_nama: opd.nama,
      opd_singkatan: opd.singkatan,
      total_permohonan: a.total,
      status_counts: a.status_counts,
      rata_hari_selesai: a.jumlahSelesai > 0 ? a.totalHariSelesai / a.jumlahSelesai : null,
      rata_rating: r && r.count > 0 ? r.total / r.count : null,
      tepat_waktu_persen: a.selesaiDenganSLA > 0 ? (a.tepatWaktu / a.selesaiDenganSLA) * 100 : null,
    };
  });

  return result;
}
