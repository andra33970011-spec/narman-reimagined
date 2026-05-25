
ALTER TABLE public.aset
  ADD COLUMN IF NOT EXISTS merk text,
  ADD COLUMN IF NOT EXISTS nomor_seri text,
  ADD COLUMN IF NOT EXISTS pemegang_user_id uuid,
  ADD COLUMN IF NOT EXISTS lokasi_terkini text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktif';

ALTER TABLE public.aset_riwayat
  ADD COLUMN IF NOT EXISTS data jsonb,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS lokasi_text text;

ALTER TABLE public.absensi_asn
  ADD COLUMN IF NOT EXISTS opd_id uuid,
  ADD COLUMN IF NOT EXISTS device_info text;

CREATE TABLE IF NOT EXISTS public.kantor_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  label text,
  lokasi text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kantor_qr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kantor QR baca login" ON public.kantor_qr FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin kelola kantor qr" ON public.kantor_qr FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admin opd kelola qr opd" ON public.kantor_qr FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()));
CREATE TRIGGER kantor_qr_updated_at BEFORE UPDATE ON public.kantor_qr
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
