-- =========================================================
-- 1. Cabut EXECUTE dari anon untuk semua SECURITY DEFINER public funcs
-- =========================================================
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT (p.oid::regprocedure)::text AS sig
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Cabut juga dari authenticated untuk function yang hanya dipakai trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_permohonan_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_verified_profile() FROM PUBLIC, anon, authenticated;

-- Pastikan fungsi yang dipakai RLS / RPC tetap bisa dipanggil oleh authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_desa(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_permohonan_bulan_ini() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opd_kinerja_agg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opd_rating_agg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rating_list_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.riwayat_dengan_petugas(uuid) TO authenticated;

-- =========================================================
-- 2. Ketatkan policy INSERT publik di laporan_masyarakat
-- =========================================================
DROP POLICY IF EXISTS "Publik kirim laporan" ON public.laporan_masyarakat;
CREATE POLICY "Publik kirim laporan"
  ON public.laporan_masyarakat
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(nama,'')) BETWEEN 2 AND 200
    AND length(coalesce(email,'')) BETWEEN 5 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(coalesce(kategori,'')) BETWEEN 2 AND 80
    AND length(coalesce(uraian,'')) BETWEEN 10 AND 4000
    AND status = 'baru'
    AND ditangani_oleh IS NULL
    AND tindak_lanjut IS NULL
  );

-- =========================================================
-- 3. Storage bucket pejabat-foto: hanya baca per-objek, tanpa listing
-- =========================================================
DROP POLICY IF EXISTS "Pejabat foto publik baca" ON storage.objects;
DROP POLICY IF EXISTS "Public read pejabat-foto" ON storage.objects;
DROP POLICY IF EXISTS "pejabat-foto public read" ON storage.objects;

-- Set bucket jadi private supaya listing tidak terbuka.
UPDATE storage.buckets SET public = false WHERE id = 'pejabat-foto';

-- Read via signed URL hanya untuk super_admin (admin upload/lihat). Publik
-- mengakses lewat signed URL yang dibuat aplikasi.
CREATE POLICY "Super admin baca pejabat-foto"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin tulis pejabat-foto"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin update pejabat-foto"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin hapus pejabat-foto"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 4. Admin Desa boleh baca audit_log terkait warga di desanya
-- =========================================================
CREATE POLICY "Admin desa lihat audit warga sedesa"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_desa')
    AND aksi IN ('warga.verified','warga.updated','warga.deleted')
    AND entitas_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = entitas_id
        AND pr.desa = public.get_user_desa(auth.uid())
    )
  );
