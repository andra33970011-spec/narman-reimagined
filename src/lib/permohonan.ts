// Helper konstanta dan tipe untuk permohonan, dipakai bersama oleh halaman warga & admin.
import type { Database } from "@/integrations/supabase/types";

export type StatusPermohonan = Database["public"]["Enums"]["status_permohonan"];

export const STATUS_LABEL: Record<StatusPermohonan, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export const STATUS_TONE: Record<StatusPermohonan, string> = {
  baru: "bg-accent/15 text-accent border-accent/30",
  diproses: "bg-gold/20 text-gold-foreground border-gold/40",
  selesai: "bg-success/15 text-success border-success/30",
  ditolak: "bg-destructive/15 text-destructive border-destructive/30",
};

export const PRIORITAS_LABEL = {
  rendah: "Rendah",
  normal: "Normal",
  tinggi: "Tinggi",
} as const;

// Hasilkan kode permohonan unik human-readable: PRM-2026-XXXXXX
export function generateKodePermohonan() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PRM-${year}-${rand}`;
}

export function fmtTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
