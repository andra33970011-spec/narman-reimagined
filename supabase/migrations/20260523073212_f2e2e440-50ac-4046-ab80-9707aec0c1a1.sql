
-- Add asn role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'asn';

-- Profile extra columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS jabatan text;

-- username column + unique lower index (handled in earlier file too)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='username') THEN
    ALTER TABLE public.profiles ADD COLUMN username text;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- ============ ASET ============
CREATE TABLE IF NOT EXISTS public.aset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL UNIQUE,
  nama text NOT NULL,
  kategori text,
  kondisi text NOT NULL DEFAULT 'baik',
  lokasi text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  pemegang_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nilai_perolehan numeric DEFAULT 0,
  tanggal_perolehan date,
  deskripsi text,
  foto_url text,
  merk text,
  nomor_seri text,
  lokasi_terkini text,
  lat numeric,
  lng numeric,
  status text NOT NULL DEFAULT 'aktif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aset baca login" ON public.aset;
CREATE POLICY "Aset baca login" ON public.aset FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin kelola aset" ON public.aset;
CREATE POLICY "Super admin kelola aset" ON public.aset FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admin opd kelola aset opd" ON public.aset;
CREATE POLICY "Admin opd kelola aset opd" ON public.aset FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()));

DROP TRIGGER IF EXISTS aset_updated_at ON public.aset;
CREATE TRIGGER aset_updated_at BEFORE UPDATE ON public.aset
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ASET RIWAYAT ============
CREATE TABLE IF NOT EXISTS public.aset_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aset_id uuid NOT NULL REFERENCES public.aset(id) ON DELETE CASCADE,
  aksi text NOT NULL,
  catatan text,
  oleh uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data jsonb,
  lat numeric,
  lng numeric,
  lokasi_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aset_riwayat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riwayat aset baca login" ON public.aset_riwayat;
CREATE POLICY "Riwayat aset baca login" ON public.aset_riwayat FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Tambah riwayat aset" ON public.aset_riwayat;
CREATE POLICY "Tambah riwayat aset" ON public.aset_riwayat FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_opd') OR auth.uid()=oleh);

-- ============ ABSENSI ASN ============
CREATE TABLE IF NOT EXISTS public.absensi_asn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  tipe text NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now(),
  lokasi text,
  lat numeric,
  lng numeric,
  foto_url text,
  catatan text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.absensi_asn ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ASN lihat absensi sendiri" ON public.absensi_asn;
CREATE POLICY "ASN lihat absensi sendiri" ON public.absensi_asn FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR has_role(auth.uid(),'super_admin')
    OR (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid())));
DROP POLICY IF EXISTS "ASN tambah absensi sendiri" ON public.absensi_asn;
CREATE POLICY "ASN tambah absensi sendiri" ON public.absensi_asn FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=user_id);
DROP POLICY IF EXISTS "Super admin kelola absensi" ON public.absensi_asn;
CREATE POLICY "Super admin kelola absensi" ON public.absensi_asn FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- ============ KANTOR QR ============
CREATE TABLE IF NOT EXISTS public.kantor_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid NOT NULL UNIQUE REFERENCES public.opd(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  lokasi text,
  lat numeric,
  lng numeric,
  radius_m integer NOT NULL DEFAULT 100,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kantor_qr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kantor QR baca login" ON public.kantor_qr;
CREATE POLICY "Kantor QR baca login" ON public.kantor_qr FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin kelola kantor qr" ON public.kantor_qr;
CREATE POLICY "Super admin kelola kantor qr" ON public.kantor_qr FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admin opd kelola qr opd" ON public.kantor_qr;
CREATE POLICY "Admin opd kelola qr opd" ON public.kantor_qr FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid()));

DROP TRIGGER IF EXISTS kantor_qr_updated_at ON public.kantor_qr;
CREATE TRIGGER kantor_qr_updated_at BEFORE UPDATE ON public.kantor_qr
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('aset-foto', 'aset-foto', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Aset foto baca login" ON storage.objects;
CREATE POLICY "Aset foto baca login" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'aset-foto');
DROP POLICY IF EXISTS "Aset foto upload login" ON storage.objects;
CREATE POLICY "Aset foto upload login" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'aset-foto');
DROP POLICY IF EXISTS "Aset foto hapus pemilik" ON storage.objects;
CREATE POLICY "Aset foto hapus pemilik" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'aset-foto' AND (owner = auth.uid() OR public.has_role(auth.uid(),'super_admin')));
