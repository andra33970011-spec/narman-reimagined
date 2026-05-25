
-- ============= USERNAME =============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Backfill: gunakan local part email sebagai username awal jika kosong
UPDATE public.profiles p
SET username = lower(split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE lower(p2.username) = lower(split_part(u.email, '@', 1))
      AND p2.id <> p.id
  );

-- ============= KANTOR QR =============
CREATE TABLE IF NOT EXISTS public.kantor_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid NOT NULL UNIQUE REFERENCES public.opd(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  lokasi text,
  lat numeric,
  lng numeric,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kantor_qr_token_idx ON public.kantor_qr(token);
ALTER TABLE public.kantor_qr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin kelola kantor_qr" ON public.kantor_qr;
CREATE POLICY "Super admin kelola kantor_qr" ON public.kantor_qr
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin OPD baca kantor_qr sendiri" ON public.kantor_qr;
CREATE POLICY "Admin OPD baca kantor_qr sendiri" ON public.kantor_qr
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_opd') AND opd_id = public.get_user_opd(auth.uid()));

DROP POLICY IF EXISTS "ASN baca kantor_qr OPD sendiri" ON public.kantor_qr;
CREATE POLICY "ASN baca kantor_qr OPD sendiri" ON public.kantor_qr
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'asn') AND opd_id = public.get_user_opd(auth.uid()));

CREATE TRIGGER kantor_qr_set_updated_at
  BEFORE UPDATE ON public.kantor_qr
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ABSENSI ASN =============
DO $$ BEGIN
  CREATE TYPE absensi_tipe AS ENUM ('masuk', 'pulang');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.absensi_asn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opd_id uuid NOT NULL REFERENCES public.opd(id) ON DELETE CASCADE,
  tipe absensi_tipe NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now(),
  lat numeric,
  lng numeric,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS absensi_user_waktu_idx ON public.absensi_asn(user_id, waktu DESC);
CREATE INDEX IF NOT EXISTS absensi_opd_waktu_idx ON public.absensi_asn(opd_id, waktu DESC);
ALTER TABLE public.absensi_asn ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ASN lihat absensi sendiri" ON public.absensi_asn;
CREATE POLICY "ASN lihat absensi sendiri" ON public.absensi_asn
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'admin_opd') AND opd_id = public.get_user_opd(auth.uid())));

DROP POLICY IF EXISTS "Super admin kelola absensi" ON public.absensi_asn;
CREATE POLICY "Super admin kelola absensi" ON public.absensi_asn
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============= ASET =============
DO $$ BEGIN
  CREATE TYPE aset_status AS ENUM ('aktif', 'rusak', 'dihapuskan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.aset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL UNIQUE,
  nama text NOT NULL,
  kategori text NOT NULL DEFAULT 'lainnya',
  merk text,
  nomor_seri text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  pemegang_user_id uuid,
  lokasi_terkini text,
  lat numeric,
  lng numeric,
  status aset_status NOT NULL DEFAULT 'aktif',
  foto_url text,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aset_opd_idx ON public.aset(opd_id);
CREATE INDEX IF NOT EXISTS aset_pemegang_idx ON public.aset(pemegang_user_id);
CREATE INDEX IF NOT EXISTS aset_kategori_idx ON public.aset(kategori);
ALTER TABLE public.aset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin kelola aset" ON public.aset;
CREATE POLICY "Super admin kelola aset" ON public.aset
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin OPD kelola aset OPD" ON public.aset;
CREATE POLICY "Admin OPD kelola aset OPD" ON public.aset
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_opd') AND opd_id = public.get_user_opd(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin_opd') AND opd_id = public.get_user_opd(auth.uid()));

DROP POLICY IF EXISTS "Pemegang baca aset" ON public.aset;
CREATE POLICY "Pemegang baca aset" ON public.aset
  FOR SELECT TO authenticated
  USING (pemegang_user_id = auth.uid());

DROP POLICY IF EXISTS "ASN baca aset OPD" ON public.aset;
CREATE POLICY "ASN baca aset OPD" ON public.aset
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'asn') AND opd_id = public.get_user_opd(auth.uid()));

CREATE TRIGGER aset_set_updated_at
  BEFORE UPDATE ON public.aset
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= ASET RIWAYAT =============
CREATE TABLE IF NOT EXISTS public.aset_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aset_id uuid NOT NULL REFERENCES public.aset(id) ON DELETE CASCADE,
  oleh uuid,
  aksi text NOT NULL,
  catatan text,
  lat numeric,
  lng numeric,
  lokasi_text text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aset_riwayat_aset_idx ON public.aset_riwayat(aset_id, created_at DESC);
ALTER TABLE public.aset_riwayat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin lihat riwayat aset" ON public.aset_riwayat;
CREATE POLICY "Super admin lihat riwayat aset" ON public.aset_riwayat
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admin OPD lihat riwayat aset OPD" ON public.aset_riwayat;
CREATE POLICY "Admin OPD lihat riwayat aset OPD" ON public.aset_riwayat
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin_opd') AND aset_id IN (
    SELECT id FROM public.aset WHERE opd_id = public.get_user_opd(auth.uid())
  ));

DROP POLICY IF EXISTS "Pemegang lihat riwayat aset sendiri" ON public.aset_riwayat;
CREATE POLICY "Pemegang lihat riwayat aset sendiri" ON public.aset_riwayat
  FOR SELECT TO authenticated
  USING (aset_id IN (SELECT id FROM public.aset WHERE pemegang_user_id = auth.uid()));

-- ============= PROTECT SUPER ADMIN ROLE =============
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'Role super admin tidak dapat dihapus' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Role super admin tidak dapat diubah' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Role super admin tidak dapat ditambahkan via aplikasi' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_super_admin_role_trg ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();
