
-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS jabatan text,
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Add asn role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'asn';

-- Aset
CREATE TABLE IF NOT EXISTS public.aset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL UNIQUE,
  nama text NOT NULL,
  kategori text,
  kondisi text NOT NULL DEFAULT 'baik',
  lokasi text,
  opd_id uuid,
  nilai_perolehan numeric DEFAULT 0,
  tanggal_perolehan date,
  deskripsi text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aset ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aset baca login" ON public.aset FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin kelola aset" ON public.aset FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admin opd kelola aset opd" ON public.aset FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()));
CREATE TRIGGER aset_updated_at BEFORE UPDATE ON public.aset
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.aset_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aset_id uuid NOT NULL,
  aksi text NOT NULL,
  catatan text,
  oleh uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aset_riwayat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riwayat aset baca login" ON public.aset_riwayat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin tambah riwayat aset" ON public.aset_riwayat FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_opd') OR auth.uid()=oleh);

-- Absensi ASN
CREATE TABLE IF NOT EXISTS public.absensi_asn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipe text NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now(),
  lokasi text,
  lat numeric,
  lng numeric,
  foto_url text,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.absensi_asn ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ASN lihat absensi sendiri" ON public.absensi_asn FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "ASN tambah absensi sendiri" ON public.absensi_asn FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Super admin kelola absensi" ON public.absensi_asn FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
