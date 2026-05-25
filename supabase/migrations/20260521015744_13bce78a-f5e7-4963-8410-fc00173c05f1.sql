
ALTER TABLE public.kantor_qr
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS radius_m integer NOT NULL DEFAULT 100;

INSERT INTO storage.buckets (id, name, public)
VALUES ('aset-foto', 'aset-foto', false)
ON CONFLICT (id) DO NOTHING;

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
USING (bucket_id = 'aset-foto' AND (owner = auth.uid() OR public.has_role(auth.uid(),'super_admin')));
