-- =====================================================================
-- 05. PG-CRON - jadwal otomatis (backup snapshot & storage cleanup)
-- =====================================================================
-- Wajib di project Supabase pribadi yang sudah mengaktifkan extension
-- `pg_cron` dan `pg_net` (Database > Extensions). Lovable Cloud internal
-- tidak menjalankan file ini secara otomatis.
--
-- GANTI placeholder berikut sebelum dijalankan:
--   <PROJECT_URL>   contoh: https://abcd1234.supabase.co
--   <CRON_SECRET>   string acak panjang (samakan dgn secret CRON_SECRET
--                   di Cloudflare Pages / Workers).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Bersihkan jadwal lama (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('narman-backup-snapshot');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('narman-storage-cleanup');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Snapshot backup harian jam 02:00 UTC
SELECT cron.schedule(
  'narman-backup-snapshot',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := '<PROJECT_URL>/api/public/hooks/backup-snapshot',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pembersihan storage harian jam 03:00 UTC
SELECT cron.schedule(
  'narman-storage-cleanup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := '<PROJECT_URL>/api/public/hooks/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cek jadwal:
-- SELECT jobid, jobname, schedule FROM cron.job;
