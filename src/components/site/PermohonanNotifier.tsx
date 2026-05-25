// Notifier realtime untuk permohonan milik user yang sedang login.
// Saat status berubah atau ada riwayat baru, tampilkan:
//   - toast in-app, dan
//   - Notification sistem (via service worker) yang berisi kode, status,
//     dan catatan admin agar tetap muncul ketika PWA terpasang/minimize.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  diproses: "Diproses",
  menunggu_dokumen: "Menunggu Dokumen",
  ditolak: "Ditolak",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

async function showSystemNotification(title: string, body: string, url: string, tag: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    } as NotificationOptions);
  } catch {
    // ignore
  }
}

export function PermohonanNotifier() {
  const { user } = useAuth();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe perubahan status permohonan milik user
    const ch1 = supabase
      .channel(`permohonan-self-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "permohonan", filter: `pemohon_id=eq.${user.id}` },
        (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { id?: string; kode?: string; status?: string; judul?: string } | null;
          if (!newRow?.id) return;
          if (oldRow?.status && oldRow.status === newRow.status) return;
          const key = `status:${newRow.id}:${newRow.status}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);

          const statusLabel = STATUS_LABEL[newRow.status || ""] || newRow.status || "-";
          const title = `Status: ${statusLabel}`;
          const body = `${newRow.kode || "Permohonan"} — ${newRow.judul || ""}`.trim();
          const url = `/permohonan/${newRow.id}`;
          toast(title, { description: body });
          showSystemNotification(title, body, url, `permohonan-${newRow.id}-status`);
        },
      )
      .subscribe();

    // Subscribe riwayat baru (catatan admin)
    const ch2 = supabase
      .channel(`riwayat-self-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "permohonan_riwayat" },
        async (payload) => {
          const row = payload.new as { id?: string; permohonan_id?: string; aksi?: string; catatan?: string | null; oleh?: string | null } | null;
          if (!row?.id || !row.permohonan_id) return;
          // Hanya untuk permohonan milik user (verifikasi via RLS-aware fetch)
          const { data: perm } = await supabase
            .from("permohonan")
            .select("id,kode,judul,status,pemohon_id")
            .eq("id", row.permohonan_id)
            .maybeSingle();
          if (!perm || perm.pemohon_id !== user.id) return;
          // Hindari double dengan event status change
          if (row.oleh === user.id) return;
          const key = `riwayat:${row.id}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);

          const title = `${perm.kode || "Permohonan"} — ${row.aksi || "Pembaruan"}`;
          const body = (row.catatan && row.catatan.trim()) || `Status saat ini: ${STATUS_LABEL[perm.status || ""] || perm.status || "-"}`;
          const url = `/permohonan/${perm.id}`;
          toast(title, { description: body });
          showSystemNotification(title, body, url, `permohonan-${perm.id}-riwayat`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [user?.id]);

  return null;
}
