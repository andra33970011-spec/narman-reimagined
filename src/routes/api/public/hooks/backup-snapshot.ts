// Cron hook untuk auto-snapshot. Dipanggil oleh pg_cron.
// Membaca app_setting `auto_backup_config` untuk cek apakah aktif.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SNAPSHOT_TABLES = [
  "profiles", "user_roles", "opd", "kategori_layanan", "layanan_publik",
  "berita", "pejabat", "data_terpadu_item", "app_setting",
  "permohonan", "permohonan_riwayat", "permohonan_rating",
  "laporan_masyarakat", "audit_log", "job_queue",
] as const;

export const Route = createFileRoute("/api/public/hooks/backup-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Otentikasi dengan anon key (pola standar pg_cron)
        const apikey = request.headers.get("apikey");
        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !service) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!apikey || apikey !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const admin = createClient(url, service, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Cek config auto backup
        const { data: cfgRow } = await admin
          .from("app_setting").select("value").eq("key", "auto_backup_config").maybeSingle();
        const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; retention?: number };
        if (!cfg.enabled) {
          return Response.json({ skipped: true, reason: "auto_backup_disabled" });
        }
        const retention = Math.max(1, Math.min(90, cfg.retention ?? 14));

        // Bangun payload
        const tables: Record<string, unknown[]> = {};
        const counts: Record<string, number> = {};
        for (const t of SNAPSHOT_TABLES) {
          const { data: rows } = await admin.from(t).select("*").limit(50000);
          tables[t] = rows ?? [];
          counts[t] = (rows ?? []).length;
        }
        const payloadStr = JSON.stringify(tables);
        const size = new TextEncoder().encode(payloadStr).length;

        const label = `Auto · ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}`;
        const { data: inserted, error } = await admin.from("backup_snapshot").insert({
          label, tipe: "auto", size_bytes: size, table_counts: counts, data: { tables },
        }).select("id, created_at").single();
        if (error) {
          return new Response(`Insert failed: ${error.message}`, { status: 500 });
        }

        // Retention auto-snapshot
        const { data: autoList } = await admin
          .from("backup_snapshot").select("id")
          .eq("tipe", "auto").order("created_at", { ascending: false });
        if (autoList && autoList.length > retention) {
          const drop = autoList.slice(retention).map((x) => x.id);
          await admin.from("backup_snapshot").delete().in("id", drop);
        }

        return Response.json({
          ok: true,
          id: inserted.id,
          created_at: inserted.created_at,
          size_bytes: size,
          tables: counts,
        });
      },
    },
  },
});
