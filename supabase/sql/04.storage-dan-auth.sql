-- =====================================================================
-- 04. STORAGE & AUTH - buckets, policies storage, trigger user baru
-- =====================================================================
-- Jalankan setelah 01.schema.sql. Membuat 3 bucket + RLS objects
-- dan trigger handle_new_user() yang mengisi profiles + role 'warga'
-- otomatis saat user mendaftar.
-- =====================================================================

-- ---------- BUCKETS ----------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('berkas-permohonan', 'berkas-permohonan', false),
  ('pejabat-foto',      'pejabat-foto',      true),
  ('aset-foto',         'aset-foto',         false)
ON CONFLICT (id) DO NOTHING;

-- ---------- POLICIES storage.objects ----------
-- Berkas permohonan: scoped per user (folder pertama = auth.uid())
DROP POLICY IF EXISTS "Berkas: user upload ke folder sendiri" ON storage.objects;
CREATE POLICY "Berkas: user upload ke folder sendiri"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'berkas-permohonan'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(COALESCE(metadata->>'mimetype','')) = ANY (ARRAY[
    'application/pdf','image/jpeg','image/png','image/webp'
  ])
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
);

DROP POLICY IF EXISTS "Berkas: user baca berkas sendiri" ON storage.objects;
CREATE POLICY "Berkas: user baca berkas sendiri"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'berkas-permohonan'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'super_admin')
    OR (
      public.has_role(auth.uid(), 'admin_opd')
      AND (storage.foldername(name))[1] IN (
        SELECT (p.pemohon_id)::text FROM public.permohonan p
        WHERE p.opd_id = public.get_user_opd(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Berkas: user update berkas sendiri" ON storage.objects;
CREATE POLICY "Berkas: user update berkas sendiri"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'berkas-permohonan'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR public.has_role(auth.uid(),'super_admin'))
)
WITH CHECK (
  bucket_id = 'berkas-permohonan'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR public.has_role(auth.uid(),'super_admin'))
);

DROP POLICY IF EXISTS "Berkas: user hapus berkas sendiri" ON storage.objects;
CREATE POLICY "Berkas: user hapus berkas sendiri"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'berkas-permohonan'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Foto pejabat (public bucket)
DROP POLICY IF EXISTS "Foto pejabat publik baca" ON storage.objects;
CREATE POLICY "Foto pejabat publik baca"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'pejabat-foto');

DROP POLICY IF EXISTS "Super admin upload foto pejabat" ON storage.objects;
CREATE POLICY "Super admin upload foto pejabat"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Super admin update foto pejabat" ON storage.objects;
CREATE POLICY "Super admin update foto pejabat"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Super admin hapus foto pejabat" ON storage.objects;
CREATE POLICY "Super admin hapus foto pejabat"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(),'super_admin'));

-- Aset foto (private, login)
DROP POLICY IF EXISTS "Aset foto baca login" ON storage.objects;
CREATE POLICY "Aset foto baca login"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'aset-foto');

DROP POLICY IF EXISTS "Aset foto upload login" ON storage.objects;
CREATE POLICY "Aset foto upload login"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'aset-foto');

DROP POLICY IF EXISTS "Aset foto hapus pemilik" ON storage.objects;
CREATE POLICY "Aset foto hapus pemilik"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'aset-foto'
  AND (owner = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
);

-- ---------- AUTH TRIGGER ----------
-- Trigger ini WAJIB dipasang manual di Supabase project pribadi,
-- karena trigger pada schema auth tidak bisa dibuat lewat migration
-- biasa di Lovable Cloud. Jalankan blok ini sekali.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
