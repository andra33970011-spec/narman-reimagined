
-- ============================================================
-- 1. FIX: Admin OPD scope laporan_masyarakat hanya OPD-nya
-- ============================================================
DROP POLICY IF EXISTS "Admin OPD lihat laporan" ON public.laporan_masyarakat;
CREATE POLICY "Admin OPD lihat laporan OPD sendiri"
ON public.laporan_masyarakat
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_opd'::app_role)
  AND (opd_id IS NULL OR opd_id = public.get_user_opd(auth.uid()))
);

-- ============================================================
-- 2. FIX: Rating tidak lagi publik. Sediakan agregat publik aman.
-- ============================================================
DROP POLICY IF EXISTS "Rating publik baca" ON public.permohonan_rating;

CREATE POLICY "Rating: user lihat sendiri / super admin lihat semua"
ON public.permohonan_rating
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.rating_public_stats()
RETURNS TABLE(total bigint, avg_skor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint, AVG(skor)::numeric
  FROM public.permohonan_rating;
$$;
REVOKE EXECUTE ON FUNCTION public.rating_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rating_public_stats() TO anon, authenticated;

-- ============================================================
-- 3. FIX: app_setting publik hanya untuk kunci yang ditandai publik
-- ============================================================
DROP POLICY IF EXISTS "App setting publik baca" ON public.app_setting;
CREATE POLICY "App setting publik: hanya kunci publik"
ON public.app_setting
FOR SELECT TO anon, authenticated
USING (
  key IN (
    'site_branding',
    'permohonan_require_verification',
    'show_opd_directory',
    'data_terpadu_visible_public',
    'kinerja_opd_visible_public'
  )
);
-- Super admin dapat membaca semua (sudah ada policy ALL super_admin)

-- ============================================================
-- 4. FIX: permohonan_riwayat insert harus pemilik permohonan
-- ============================================================
DROP POLICY IF EXISTS "Admin tambah riwayat" ON public.permohonan_riwayat;
CREATE POLICY "Riwayat: insert oleh pihak berwenang"
ON public.permohonan_riwayat
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = oleh
  AND EXISTS (
    SELECT 1 FROM public.permohonan p
    WHERE p.id = permohonan_riwayat.permohonan_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR (public.has_role(auth.uid(), 'admin_opd'::app_role) AND p.opd_id = public.get_user_opd(auth.uid()))
        OR p.pemohon_id = auth.uid()
      )
  )
);

-- ============================================================
-- 5. FIX: verification_token — admin_desa tidak melihat token raw
-- ============================================================
DROP POLICY IF EXISTS "warga lihat token sendiri" ON public.verification_token;
CREATE POLICY "Token: warga & super admin"
ON public.verification_token
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- ============================================================
-- 6. FIX: Realtime — keluarkan tabel sensitif dari publikasi
-- ============================================================
DO $rt$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_log; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.verification_token; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.app_setting; EXCEPTION WHEN OTHERS THEN NULL; END;
END $rt$;

-- ============================================================
-- 7. FIX: Storage policy untuk pejabat-foto (foto publik di situs)
-- ============================================================
DROP POLICY IF EXISTS "Pejabat foto publik baca" ON storage.objects;
CREATE POLICY "Pejabat foto publik baca"
ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'pejabat-foto');

-- ============================================================
-- 8. HARDENING: Pindahkan helper RLS ke SECURITY INVOKER
--    Aman karena selalu dipanggil dengan auth.uid() dan RLS
--    mengizinkan user melihat baris miliknya sendiri.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_opd(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_desa(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND desa = _desa)
$$;

-- ============================================================
-- 9. HARDENING: Cabut EXECUTE publik dari trigger functions
--    Trigger tetap jalan karena trigger memanggil fungsi
--    bypass permission check.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_permohonan_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_verified_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 10. HARDENING: Batasi EXECUTE fungsi admin self-checked
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rating_list_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rating_list_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.riwayat_dengan_petugas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.riwayat_dengan_petugas(uuid) TO authenticated;
