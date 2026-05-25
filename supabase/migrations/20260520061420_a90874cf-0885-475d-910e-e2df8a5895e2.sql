ALTER TABLE public.kantor_qr DROP CONSTRAINT IF EXISTS kantor_qr_opd_fk;
ALTER TABLE public.absensi_asn DROP CONSTRAINT IF EXISTS absensi_asn_opd_fk;
ALTER TABLE public.absensi_asn DROP CONSTRAINT IF EXISTS absensi_asn_user_fk;
ALTER TABLE public.aset DROP CONSTRAINT IF EXISTS aset_opd_fk;
ALTER TABLE public.aset DROP CONSTRAINT IF EXISTS aset_pemegang_fk;
ALTER TABLE public.aset_riwayat DROP CONSTRAINT IF EXISTS aset_riwayat_aset_fk;
ALTER TABLE public.aset_riwayat DROP CONSTRAINT IF EXISTS aset_riwayat_oleh_fk;