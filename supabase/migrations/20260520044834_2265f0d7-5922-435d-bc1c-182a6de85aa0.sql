
ALTER TABLE public.aset
  ADD CONSTRAINT aset_opd_fk FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL,
  ADD CONSTRAINT aset_pemegang_fk FOREIGN KEY (pemegang_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.aset_riwayat
  ADD CONSTRAINT aset_riwayat_aset_fk FOREIGN KEY (aset_id) REFERENCES public.aset(id) ON DELETE CASCADE,
  ADD CONSTRAINT aset_riwayat_oleh_fk FOREIGN KEY (oleh) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.absensi_asn
  ADD CONSTRAINT absensi_asn_opd_fk FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL,
  ADD CONSTRAINT absensi_asn_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.kantor_qr
  ADD CONSTRAINT kantor_qr_opd_fk FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE CASCADE;
