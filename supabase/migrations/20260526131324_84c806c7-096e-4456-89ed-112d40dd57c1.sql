
INSERT INTO storage.buckets (id, name, public) VALUES ('share-files', 'share-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "share-files: pengirim upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'share-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "share-files: pemilik baca"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'share-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "share-files: penerima baca via lampiran"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'share-files' AND EXISTS (
    SELECT 1 FROM public.share_lampiran l
    WHERE l.path = storage.objects.name
      AND public.can_access_paket(l.paket_id, auth.uid())
  )
);

CREATE POLICY "share-files: pengirim hapus"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'share-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "share-files: super admin kelola"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'share-files' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'share-files' AND public.has_role(auth.uid(), 'super_admin'));
