
ALTER TABLE public.absensi_asn
  ADD CONSTRAINT absensi_asn_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.absensi_asn
  ADD CONSTRAINT absensi_asn_opd_id_fkey
  FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL;

ALTER TABLE public.aset
  ADD CONSTRAINT aset_pemegang_user_id_profiles_fkey
  FOREIGN KEY (pemegang_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.aset
  ADD CONSTRAINT aset_opd_id_fkey
  FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL;

ALTER TABLE public.aset_riwayat
  ADD CONSTRAINT aset_riwayat_oleh_profiles_fkey
  FOREIGN KEY (oleh) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.aset_riwayat
  ADD CONSTRAINT aset_riwayat_aset_id_fkey
  FOREIGN KEY (aset_id) REFERENCES public.aset(id) ON DELETE CASCADE;

ALTER TABLE public.kantor_qr
  ADD CONSTRAINT kantor_qr_opd_id_fkey
  FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE CASCADE;
