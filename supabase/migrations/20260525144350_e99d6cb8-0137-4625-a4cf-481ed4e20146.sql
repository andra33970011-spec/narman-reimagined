-- ===== Profile extras =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS jabatan text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

UPDATE public.profiles p
SET username = lower(split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE lower(p2.username) = lower(split_part(u.email, '@', 1)) AND p2.id <> p.id
  );

ALTER TABLE public.pejabat
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS is_pimpinan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level text;
CREATE INDEX IF NOT EXISTS idx_pejabat_user ON public.pejabat(user_id);
CREATE INDEX IF NOT EXISTS idx_pejabat_pimpinan ON public.pejabat(is_pimpinan) WHERE is_pimpinan = true;

CREATE OR REPLACE FUNCTION public.is_pimpinan(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pejabat WHERE user_id = _user_id AND is_pimpinan = true AND aktif = true)
$$;

DO $$ BEGIN CREATE TYPE absensi_tipe AS ENUM ('masuk','pulang'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE aset_status AS ENUM ('aktif','rusak','dihapuskan'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kantor_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid NOT NULL UNIQUE REFERENCES public.opd(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text, lokasi text, lat numeric, lng numeric,
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

CREATE TABLE IF NOT EXISTS public.aset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text NOT NULL UNIQUE,
  nama text NOT NULL,
  kategori text NOT NULL DEFAULT 'lainnya',
  merk text, nomor_seri text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  pemegang_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lokasi_terkini text, lat numeric, lng numeric,
  status aset_status NOT NULL DEFAULT 'aktif',
  foto_url text, catatan text,
  kondisi text NOT NULL DEFAULT 'baik',
  lokasi text, nilai_perolehan numeric DEFAULT 0,
  tanggal_perolehan date, deskripsi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aset_opd_idx ON public.aset(opd_id);
CREATE INDEX IF NOT EXISTS aset_pemegang_idx ON public.aset(pemegang_user_id);
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

CREATE TABLE IF NOT EXISTS public.aset_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aset_id uuid NOT NULL REFERENCES public.aset(id) ON DELETE CASCADE,
  aksi text NOT NULL, catatan text,
  oleh uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data jsonb, lat numeric, lng numeric, lokasi_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aset_riwayat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Riwayat aset baca login" ON public.aset_riwayat;
CREATE POLICY "Riwayat aset baca login" ON public.aset_riwayat FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Tambah riwayat aset" ON public.aset_riwayat;
CREATE POLICY "Tambah riwayat aset" ON public.aset_riwayat FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_opd') OR auth.uid()=oleh);

CREATE TABLE IF NOT EXISTS public.absensi_asn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  tipe text NOT NULL,
  waktu timestamptz NOT NULL DEFAULT now(),
  lokasi text, lat numeric, lng numeric,
  foto_url text, catatan text, device_info text,
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

INSERT INTO storage.buckets (id, name, public) VALUES ('aset-foto', 'aset-foto', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Aset foto baca login" ON storage.objects;
CREATE POLICY "Aset foto baca login" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'aset-foto');
DROP POLICY IF EXISTS "Aset foto upload login" ON storage.objects;
CREATE POLICY "Aset foto upload login" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aset-foto');
DROP POLICY IF EXISTS "Aset foto hapus pemilik" ON storage.objects;
CREATE POLICY "Aset foto hapus pemilik" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'aset-foto' AND (owner = auth.uid() OR has_role(auth.uid(),'super_admin')));

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN RAISE EXCEPTION 'Role super admin tidak dapat dihapus' USING ERRCODE='42501'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Role super admin tidak dapat diubah' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Role super admin tidak dapat ditambahkan via aplikasi' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_super_admin_role_trg ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

CREATE TABLE IF NOT EXISTS public.share_paket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE, judul text NOT NULL, deskripsi text,
  tipe text NOT NULL CHECK (tipe IN ('dokumen','memo','dataset')),
  prioritas text NOT NULL DEFAULT 'normal' CHECK (prioritas IN ('normal','penting','segera','rahasia')),
  sensitivitas text NOT NULL DEFAULT 'publik_internal' CHECK (sensitivitas IN ('publik_internal','terbatas','rahasia')),
  pengirim_user_id uuid NOT NULL, pengirim_opd_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','menunggu_approval','disetujui_kirim','ditolak','terkirim','dibatalkan','arsip')),
  approval_required boolean NOT NULL DEFAULT false,
  approver_id uuid, approved_at timestamptz, approval_note text,
  dataset_template_id uuid, expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.share_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('opd','user','pimpinan')),
  target_opd_id uuid, target_user_id uuid, target_pejabat_id uuid,
  status_baca text NOT NULL DEFAULT 'belum' CHECK (status_baca IN ('belum','dibuka','ditindaklanjuti','ditolak')),
  dibuka_oleh uuid, dibuka_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.share_lampiran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  nama_file text NOT NULL, url text NOT NULL,
  mime_type text, size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.share_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  aksi text NOT NULL, oleh_user_id uuid,
  catatan text, meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.share_komentar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  oleh_user_id uuid NOT NULL, isi text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dataset_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE, judul text NOT NULL, deskripsi text,
  opd_pemilik_id uuid,
  target_role text NOT NULL DEFAULT 'asn' CHECK (target_role IN ('asn','admin_opd','semua')),
  target_scope text NOT NULL DEFAULT 'opd_sendiri' CHECK (target_scope IN ('opd_sendiri','lintas_opd','spesifik')),
  target_opd_ids uuid[] DEFAULT '{}',
  kolom jsonb NOT NULL DEFAULT '[]',
  excel_layout jsonb NOT NULL DEFAULT '{}',
  deadline timestamptz, aktif boolean NOT NULL DEFAULT true,
  allow_multiple_submit boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dataset_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.dataset_template(id) ON DELETE CASCADE,
  oleh_user_id uuid NOT NULL, opd_id uuid,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('draft','final','dikembalikan')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  returned_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_access_paket(_paket_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_paket p
    WHERE p.id = _paket_id AND (
      p.pengirim_user_id = _user_id
      OR public.has_role(_user_id, 'super_admin'::app_role)
      OR (public.has_role(_user_id, 'admin_opd'::app_role) AND p.pengirim_opd_id = public.get_user_opd(_user_id))
      OR EXISTS (SELECT 1 FROM public.share_target t WHERE t.paket_id = p.id AND (
          t.target_user_id = _user_id
          OR (t.target_type='opd' AND t.target_opd_id = public.get_user_opd(_user_id))
          OR (t.target_type='pimpinan' AND public.is_pimpinan(_user_id))
      ))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.gen_share_kode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kode IS NULL OR NEW.kode = '' THEN
    NEW.kode := 'SHR-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*900000)+100000)::text,6,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.gen_dataset_kode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kode IS NULL OR NEW.kode = '' THEN
    NEW.kode := 'DST-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*900000)+100000)::text,6,'0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_share_paket_kode ON public.share_paket;
CREATE TRIGGER trg_share_paket_kode BEFORE INSERT ON public.share_paket FOR EACH ROW EXECUTE FUNCTION public.gen_share_kode();
DROP TRIGGER IF EXISTS trg_share_paket_updated ON public.share_paket;
CREATE TRIGGER trg_share_paket_updated BEFORE UPDATE ON public.share_paket FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_dataset_template_kode ON public.dataset_template;
CREATE TRIGGER trg_dataset_template_kode BEFORE INSERT ON public.dataset_template FOR EACH ROW EXECUTE FUNCTION public.gen_dataset_kode();
DROP TRIGGER IF EXISTS trg_dataset_template_updated ON public.dataset_template;
CREATE TRIGGER trg_dataset_template_updated BEFORE UPDATE ON public.dataset_template FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_dataset_sub_updated ON public.dataset_submission;
CREATE TRIGGER trg_dataset_sub_updated BEFORE UPDATE ON public.dataset_submission FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.share_paket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_target ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_lampiran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_riwayat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_komentar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_submission ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paket select akses" ON public.share_paket;
CREATE POLICY "paket select akses" ON public.share_paket FOR SELECT TO authenticated USING (public.can_access_paket(id, auth.uid()));
DROP POLICY IF EXISTS "paket insert pengirim" ON public.share_paket;
CREATE POLICY "paket insert pengirim" ON public.share_paket FOR INSERT TO authenticated WITH CHECK (auth.uid() = pengirim_user_id);
DROP POLICY IF EXISTS "paket update pengirim" ON public.share_paket;
CREATE POLICY "paket update pengirim" ON public.share_paket FOR UPDATE TO authenticated
  USING (auth.uid() = pengirim_user_id) WITH CHECK (auth.uid() = pengirim_user_id);
DROP POLICY IF EXISTS "paket super admin" ON public.share_paket;
CREATE POLICY "paket super admin" ON public.share_paket FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "target select akses" ON public.share_target;
CREATE POLICY "target select akses" ON public.share_target FOR SELECT TO authenticated USING (public.can_access_paket(paket_id, auth.uid()));
DROP POLICY IF EXISTS "target insert pengirim" ON public.share_target;
CREATE POLICY "target insert pengirim" ON public.share_target FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid()));

DROP POLICY IF EXISTS "lampiran select akses" ON public.share_lampiran;
CREATE POLICY "lampiran select akses" ON public.share_lampiran FOR SELECT TO authenticated USING (public.can_access_paket(paket_id, auth.uid()));
DROP POLICY IF EXISTS "lampiran insert pengirim" ON public.share_lampiran;
CREATE POLICY "lampiran insert pengirim" ON public.share_lampiran FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid()));

DROP POLICY IF EXISTS "riwayat select akses" ON public.share_riwayat;
CREATE POLICY "riwayat select akses" ON public.share_riwayat FOR SELECT TO authenticated USING (public.can_access_paket(paket_id, auth.uid()));
DROP POLICY IF EXISTS "riwayat insert" ON public.share_riwayat;
CREATE POLICY "riwayat insert" ON public.share_riwayat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = oleh_user_id OR has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "komentar select akses" ON public.share_komentar;
CREATE POLICY "komentar select akses" ON public.share_komentar FOR SELECT TO authenticated USING (public.can_access_paket(paket_id, auth.uid()));
DROP POLICY IF EXISTS "komentar insert akses" ON public.share_komentar;
CREATE POLICY "komentar insert akses" ON public.share_komentar FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = oleh_user_id AND public.can_access_paket(paket_id, auth.uid()));

DROP POLICY IF EXISTS "tpl select" ON public.dataset_template;
CREATE POLICY "tpl select" ON public.dataset_template FOR SELECT TO authenticated
  USING (aktif = true OR has_role(auth.uid(),'super_admin')
    OR (has_role(auth.uid(),'admin_opd') AND opd_pemilik_id = get_user_opd(auth.uid()))
    OR public.is_pimpinan(auth.uid()));
DROP POLICY IF EXISTS "tpl admin manage" ON public.dataset_template;
CREATE POLICY "tpl admin manage" ON public.dataset_template FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR (has_role(auth.uid(),'admin_opd') AND opd_pemilik_id = get_user_opd(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR (has_role(auth.uid(),'admin_opd') AND opd_pemilik_id = get_user_opd(auth.uid())));

DROP POLICY IF EXISTS "sub select" ON public.dataset_submission;
CREATE POLICY "sub select" ON public.dataset_submission FOR SELECT TO authenticated
  USING (oleh_user_id = auth.uid() OR has_role(auth.uid(),'super_admin')
    OR (has_role(auth.uid(),'admin_opd') AND opd_id = get_user_opd(auth.uid())));
DROP POLICY IF EXISTS "sub insert sendiri" ON public.dataset_submission;
CREATE POLICY "sub insert sendiri" ON public.dataset_submission FOR INSERT TO authenticated WITH CHECK (oleh_user_id = auth.uid());
DROP POLICY IF EXISTS "sub update sendiri" ON public.dataset_submission;
CREATE POLICY "sub update sendiri" ON public.dataset_submission FOR UPDATE TO authenticated
  USING (oleh_user_id = auth.uid() OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (oleh_user_id = auth.uid() OR has_role(auth.uid(),'super_admin'));