-- Aktifkan REPLICA IDENTITY FULL agar payload realtime menyertakan kolom lama
ALTER TABLE public.permohonan REPLICA IDENTITY FULL;
ALTER TABLE public.permohonan_riwayat REPLICA IDENTITY FULL;

-- Tambahkan ke publication realtime (idempotent)
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.permohonan; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.permohonan_riwayat; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;