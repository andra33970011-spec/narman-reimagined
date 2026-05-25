-- Migration 1: initial schema
-- (Sourced from project repo)
-- Enums
CREATE TYPE public.app_role AS ENUM ('warga', 'admin_opd', 'super_admin', 'admin_desa');
CREATE TYPE public.status_permohonan AS ENUM ('baru', 'diproses', 'selesai', 'ditolak');

CREATE TABLE public.opd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  singkatan TEXT NOT NULL,
  kategori TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opd ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap TEXT NOT NULL DEFAULT '',
  nik TEXT,
  no_hp TEXT,
  opd_id UUID REFERENCES public.opd(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.permohonan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT NOT NULL UNIQUE,
  pemohon_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opd_id UUID NOT NULL REFERENCES public.opd(id) ON DELETE RESTRICT,
  judul TEXT NOT NULL,
  kategori TEXT NOT NULL,
  deskripsi TEXT,
  status public.status_permohonan NOT NULL DEFAULT 'baru',
  petugas_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tanggal_masuk TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prioritas text NOT NULL DEFAULT 'normal' CHECK (prioritas IN ('rendah','normal','tinggi')),
  tenggat timestamptz,
  ringkasan text,
  untuk_orang_lain boolean NOT NULL DEFAULT false,
  atas_nama_nama text,
  atas_nama_nik text,
  atas_nama_hp text,
  wakil_ambil_nama text,
  wakil_ambil_nik text
);
ALTER TABLE public.permohonan ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_permohonan_opd ON public.permohonan(opd_id);
CREATE INDEX idx_permohonan_pemohon ON public.permohonan(pemohon_id);
CREATE INDEX idx_permohonan_status ON public.permohonan(status);

CREATE TABLE public.permohonan_riwayat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permohonan_id UUID NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  oleh UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aksi TEXT NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.permohonan_riwayat ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_riwayat_permohonan ON public.permohonan_riwayat(permohonan_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_permohonan_updated BEFORE UPDATE ON public.permohonan FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_user_opd(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admin lihat profil pemohon" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin_opd') AND id IN (SELECT pemohon_id FROM public.permohonan WHERE opd_id = public.get_user_opd(auth.uid())));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') AND user_id <> auth.uid());
CREATE POLICY "Super admin update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') AND user_id <> auth.uid());
CREATE POLICY "Super admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') AND user_id <> auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Pengguna tidak diizinkan mengubah perannya sendiri';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_prevent_self_role_change BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

CREATE POLICY "OPD readable by all" ON public.opd FOR SELECT USING (true);
CREATE POLICY "Super admin manage OPD" ON public.opd FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Warga lihat permohonan sendiri" ON public.permohonan FOR SELECT TO authenticated
  USING (auth.uid()=pemohon_id OR has_role(auth.uid(),'super_admin') OR (has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid())));
CREATE POLICY "Warga buat permohonan" ON public.permohonan FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = pemohon_id);
CREATE POLICY "Admin update permohonan" ON public.permohonan FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR (has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid())));
CREATE POLICY "Super admin hapus permohonan" ON public.permohonan FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin'));

CREATE POLICY "Lihat riwayat sesuai permohonan" ON public.permohonan_riwayat FOR SELECT TO authenticated
  USING (permohonan_id IN (SELECT id FROM public.permohonan WHERE auth.uid()=pemohon_id OR has_role(auth.uid(),'super_admin') OR (has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid()))));
CREATE POLICY "Admin tambah riwayat" ON public.permohonan_riwayat FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_opd') OR auth.uid() = oleh);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, user_email text, aksi text NOT NULL, entitas text NOT NULL, entitas_id text,
  data_sebelum jsonb, data_sesudah jsonb, ip_address text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_entitas ON public.audit_log(entitas, entitas_id);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin lihat audit log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "User insert own audit log" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_permohonan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah)
    VALUES (auth.uid(),'permohonan.status_changed','permohonan',NEW.id::text,
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_permohonan_audit AFTER UPDATE ON public.permohonan FOR EACH ROW EXECUTE FUNCTION public.log_permohonan_change();

CREATE TYPE public.job_status AS ENUM ('pending','running','success','failed','dead');
CREATE TABLE public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0, max_attempts int NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz, finished_at timestamptz, error text, result jsonb,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_queue_status_scheduled ON public.job_queue(status, scheduled_at) WHERE status IN ('pending','failed');
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin lihat semua job" ON public.job_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, bucket text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(), count int NOT NULL DEFAULT 1
);
CREATE INDEX idx_rate_limit_lookup ON public.rate_limit(identifier, bucket, window_start DESC);
ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all rate_limit" ON public.rate_limit FOR ALL USING (false) WITH CHECK (false);