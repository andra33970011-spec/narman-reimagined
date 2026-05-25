-- 1. Tambah nilai enum 'asn'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'asn';

-- 2. Tambah kolom NIP dan jabatan ke profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS jabatan text;

-- 3. Backfill verified_at untuk admin_opd / admin_desa yang sudah ada
UPDATE public.profiles
SET verified_at = COALESCE(verified_at, now()),
    verified_by = COALESCE(verified_by, id)
WHERE id IN (
  SELECT user_id FROM public.user_roles
  WHERE role IN ('admin_opd', 'admin_desa')
);