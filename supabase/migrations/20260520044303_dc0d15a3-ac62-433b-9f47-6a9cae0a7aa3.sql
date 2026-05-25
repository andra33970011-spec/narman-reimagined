
-- profile status
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'));
ALTER TABLE public.profiles ADD COLUMN desa text;
ALTER TABLE public.profiles ADD COLUMN verified_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN verified_by uuid;

CREATE OR REPLACE FUNCTION public.get_user_desa(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, no_hp, nik, desa) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', ''),
    NEW.raw_user_meta_data->>'no_hp',
    NEW.raw_user_meta_data->>'nik',
    NEW.raw_user_meta_data->>'desa'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'warga') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.kategori_layanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE, slug text NOT NULL UNIQUE,
  sla_hari integer NOT NULL DEFAULT 7 CHECK (sla_hari>0 AND sla_hari<=365),
  deskripsi text, aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kategori_layanan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kategori publik baca" ON public.kategori_layanan FOR SELECT USING (true);
CREATE POLICY "Super admin kelola kategori" ON public.kategori_layanan FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_kategori_updated BEFORE UPDATE ON public.kategori_layanan FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.berita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL, slug text NOT NULL UNIQUE,
  ringkasan text, isi text NOT NULL DEFAULT '', gambar_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','terbit')),
  published_at timestamptz, penulis_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.berita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berita terbit publik" ON public.berita FOR SELECT USING (status='terbit');
CREATE POLICY "Super admin kelola berita" ON public.berita FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_berita_updated BEFORE UPDATE ON public.berita FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_berita_status_pub ON public.berita(status, published_at DESC);

CREATE TABLE public.layanan_publik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL, slug text NOT NULL UNIQUE,
  deskripsi text, ikon text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  persyaratan text, alur text,
  aktif boolean NOT NULL DEFAULT true, urutan integer NOT NULL DEFAULT 0,
  sla_hari integer NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.layanan_publik ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Layanan aktif publik" ON public.layanan_publik FOR SELECT USING (aktif=true);
CREATE POLICY "Super admin kelola layanan" ON public.layanan_publik FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admin OPD kelola layanan" ON public.layanan_publik FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid()));
CREATE TRIGGER trg_layanan_updated BEFORE UPDATE ON public.layanan_publik FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.app_setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App setting publik baca" ON public.app_setting FOR SELECT TO public USING (true);
CREATE POLICY "Super admin kelola app setting" ON public.app_setting FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_app_setting_updated_at BEFORE UPDATE ON public.app_setting FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.data_terpadu_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kategori text NOT NULL CHECK (kategori IN ('kpi','chart_layanan','penduduk','anggaran','dataset')),
  label text NOT NULL, nilai_teks text, nilai_num numeric, nilai_num2 numeric,
  satuan text, trend text, ikon text, format text, ukuran text, url text, opd text,
  aktif boolean NOT NULL DEFAULT true, urutan integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_data_terpadu_kat_urut ON public.data_terpadu_item (kategori, urutan);
ALTER TABLE public.data_terpadu_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Item aktif publik baca" ON public.data_terpadu_item FOR SELECT TO public
  USING (aktif=true OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin kelola item" ON public.data_terpadu_item FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_data_terpadu_updated_at BEFORE UPDATE ON public.data_terpadu_item FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pejabat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL, jabatan TEXT NOT NULL,
  foto_url TEXT, urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pejabat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pejabat aktif publik baca" ON public.pejabat FOR SELECT TO public
  USING (aktif = true OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin kelola pejabat" ON public.pejabat FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER pejabat_set_updated_at BEFORE UPDATE ON public.pejabat FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permohonan_rating (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permohonan_id uuid NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skor integer NOT NULL CHECK (skor BETWEEN 1 AND 10),
  komentar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(permohonan_id, user_id)
);
ALTER TABLE public.permohonan_rating ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rating publik baca" ON public.permohonan_rating FOR SELECT USING (true);
CREATE POLICY "User insert rating sendiri" ON public.permohonan_rating FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "User update rating sendiri" ON public.permohonan_rating FOR UPDATE TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Super admin hapus rating" ON public.permohonan_rating FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.laporan_masyarakat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL, nik text, email text NOT NULL, no_hp text,
  kategori text NOT NULL, lokasi text, uraian text NOT NULL,
  status text NOT NULL DEFAULT 'baru',
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  tindak_lanjut text, ditangani_oleh uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_laporan_status ON public.laporan_masyarakat (status);
CREATE INDEX idx_laporan_opd ON public.laporan_masyarakat (opd_id);
CREATE INDEX idx_laporan_created ON public.laporan_masyarakat (created_at DESC);
CREATE TRIGGER trg_laporan_updated BEFORE UPDATE ON public.laporan_masyarakat FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.laporan_masyarakat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publik kirim laporan" ON public.laporan_masyarakat FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admin kelola laporan" ON public.laporan_masyarakat FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admin OPD lihat laporan" ON public.laporan_masyarakat FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin_opd'));
CREATE POLICY "Admin OPD update laporan" ON public.laporan_masyarakat FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin_opd') AND (opd_id IS NULL OR opd_id = public.get_user_opd(auth.uid())));

CREATE TABLE public.backup_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL, tipe text NOT NULL DEFAULT 'manual',
  size_bytes bigint NOT NULL DEFAULT 0,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
);
CREATE INDEX idx_backup_snapshot_created_at ON public.backup_snapshot (created_at DESC);
ALTER TABLE public.backup_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin kelola snapshot" ON public.backup_snapshot FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

CREATE TABLE public.push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subscription_user ON public.push_subscription(user_id);
ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user can read own push subs" ON public.push_subscription FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "user can insert own push subs" ON public.push_subscription FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can update own push subs" ON public.push_subscription FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user can delete own push subs" ON public.push_subscription FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_push_sub_updated_at BEFORE UPDATE ON public.push_subscription FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.verification_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE, token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz, used_by uuid
);
CREATE INDEX idx_verification_token_token ON public.verification_token(token);
ALTER TABLE public.verification_token ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warga lihat token sendiri" ON public.verification_token FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_desa'));
CREATE POLICY "warga insert token sendiri" ON public.verification_token FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin desa lihat profil sedesa" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin_desa') AND desa IS NOT NULL AND desa = public.get_user_desa(auth.uid()));
CREATE POLICY "Admin desa update verifikasi sedesa" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin_desa') AND desa IS NOT NULL AND desa = public.get_user_desa(auth.uid()));

CREATE TABLE IF NOT EXISTS public.desa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE, kecamatan text, aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.desa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Desa publik baca" ON public.desa FOR SELECT TO public USING (true);
CREATE POLICY "Super admin kelola desa" ON public.desa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_desa_updated BEFORE UPDATE ON public.desa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND desa = _desa) $$;

CREATE POLICY "Admin desa lihat permohonan warga" ON public.permohonan FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin_desa'::app_role) AND public.user_in_desa(pemohon_id, public.get_user_desa(auth.uid())));

CREATE OR REPLACE FUNCTION public.protect_verified_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _caller uuid := auth.uid(); _is_super boolean := false; _is_desa boolean := false; _caller_desa text;
BEGIN
  IF OLD.verified_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.nama_lengkap IS NOT DISTINCT FROM OLD.nama_lengkap
     AND NEW.nik IS NOT DISTINCT FROM OLD.nik AND NEW.no_hp IS NOT DISTINCT FROM OLD.no_hp
     AND NEW.desa IS NOT DISTINCT FROM OLD.desa THEN RETURN NEW; END IF;
  IF _caller IS NULL THEN RETURN NEW; END IF;
  _is_super := public.has_role(_caller, 'super_admin');
  _is_desa := public.has_role(_caller, 'admin_desa');
  IF _is_super THEN RETURN NEW; END IF;
  IF _is_desa THEN
    SELECT desa INTO _caller_desa FROM public.profiles WHERE id = _caller;
    IF _caller_desa IS NOT NULL AND _caller_desa = OLD.desa THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Akun terverifikasi: data Nama, NIK, No. HP, dan Desa hanya dapat diubah oleh Admin Desa.' USING ERRCODE = '42501';
END; $$;
CREATE TRIGGER protect_verified_profile_trg BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_verified_profile();

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('berkas-permohonan','berkas-permohonan',false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public) VALUES ('pejabat-foto','pejabat-foto',false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Berkas: user upload ke folder sendiri" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='berkas-permohonan' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Berkas: user baca berkas sendiri" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='berkas-permohonan' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "Berkas: user hapus berkas sendiri" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='berkas-permohonan' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Super admin kelola branding" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin kelola pejabat-foto" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'pejabat-foto' AND public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.opd (id, nama, singkatan, kategori) VALUES
  ('c8bbce05-b8b2-4b3b-8146-3421c6e97e28', 'Dinas Kependudukan dan Pencatatan Sipil', 'Disdukcapil', ARRAY['Kependudukan']),
  ('a5f3e57d-0354-411f-8f8d-2c83a5b6d8b4', 'Dinas Kesehatan', 'Dinkes', ARRAY['Kesehatan']),
  ('77de9e98-4f44-4a9c-bbbd-00cd76b86de6', 'Dinas Penanaman Modal dan PTSP', 'DPMPTSP', ARRAY['Perizinan']),
  ('ee2bc5b7-3ccc-4487-bb49-9e1b2cfef475', 'Dinas Perhubungan', 'Dishub', ARRAY['Perhubungan']),
  ('12d270cc-ecb1-44e5-b603-90b8c382e8c6', 'Dinas Pariwisata', 'Dispar', ARRAY['Pariwisata']);

CREATE OR REPLACE FUNCTION public.count_permohonan_bulan_ini()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.permohonan WHERE tanggal_masuk >= date_trunc('month', now()); $$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_agg()
RETURNS TABLE (opd_id uuid, status text, total bigint, total_hari_selesai numeric, jumlah_selesai bigint, tepat_waktu bigint, selesai_dengan_sla bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.opd_id, p.status::text, COUNT(*)::bigint,
    COALESCE(SUM(CASE WHEN p.status='selesai' THEN EXTRACT(EPOCH FROM (p.updated_at - p.tanggal_masuk))/86400.0 ELSE 0 END),0)::numeric,
    COUNT(*) FILTER (WHERE p.status='selesai')::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint
  FROM public.permohonan p GROUP BY p.opd_id, p.status; $$;

CREATE OR REPLACE FUNCTION public.opd_rating_agg()
RETURNS TABLE(opd_id uuid, total_rating bigint, jumlah_rating bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.opd_id, COALESCE(SUM(r.skor),0)::bigint, COUNT(r.id)::bigint
  FROM public.permohonan p JOIN public.permohonan_rating r ON r.permohonan_id = p.id
  WHERE p.opd_id IS NOT NULL GROUP BY p.opd_id; $$;

CREATE OR REPLACE FUNCTION public.rating_list_admin()
RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamptz, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id, pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE public.has_role(auth.uid(),'super_admin') ORDER BY r.created_at DESC; $$;

CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid)
RETURNS TABLE (id uuid, created_at timestamptz, aksi text, catatan text, oleh uuid, nama_petugas text, email_petugas text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _opd uuid; _pemohon uuid;
BEGIN
  SELECT opd_id, pemohon_id INTO _opd, _pemohon FROM public.permohonan WHERE id = _permohonan_id;
  IF _opd IS NULL THEN RETURN; END IF;
  IF NOT (auth.uid() = _pemohon OR public.has_role(auth.uid(),'super_admin')
      OR (public.has_role(auth.uid(),'admin_opd') AND _opd = public.get_user_opd(auth.uid()))) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT r.id, r.created_at, r.aksi, r.catatan, r.oleh,
      COALESCE(p.nama_lengkap,''), COALESCE(u.email,'')
    FROM public.permohonan_riwayat r
    LEFT JOIN public.profiles p ON p.id = r.oleh
    LEFT JOIN auth.users u ON u.id = r.oleh
    WHERE r.permohonan_id = _permohonan_id ORDER BY r.created_at ASC;
END $$;
