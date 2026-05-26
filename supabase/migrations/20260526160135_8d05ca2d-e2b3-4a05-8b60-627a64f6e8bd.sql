
-- Enum baru
DO $$ BEGIN
  CREATE TYPE public.asn_type AS ENUM ('pns','pppk_penuh_waktu','pppk_paruh_waktu','honorer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.system_position AS ENUM (
    'kepala_opd','sekretaris','kepala_bidang','kepala_sekolah',
    'operator','verifikator','staff','guru','tenaga_teknis','lainnya'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- unit_kerja
CREATE TABLE IF NOT EXISTS public.unit_kerja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid NOT NULL,
  parent_id uuid REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
  nama text NOT NULL,
  kode text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.unit_kerja TO anon, authenticated;
GRANT ALL ON public.unit_kerja TO service_role;
ALTER TABLE public.unit_kerja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit_kerja baca publik" ON public.unit_kerja;
CREATE POLICY "unit_kerja baca publik" ON public.unit_kerja FOR SELECT USING (true);
DROP POLICY IF EXISTS "unit_kerja kelola super_admin" ON public.unit_kerja;
CREATE POLICY "unit_kerja kelola super_admin" ON public.unit_kerja FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_unit_kerja_opd ON public.unit_kerja(opd_id);

-- profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asn_type public.asn_type,
  ADD COLUMN IF NOT EXISTS system_position public.system_position,
  ADD COLUMN IF NOT EXISTS unit_kerja_id uuid REFERENCES public.unit_kerja(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_opd ON public.profiles(opd_id);
CREATE INDEX IF NOT EXISTS idx_profiles_system_position ON public.profiles(system_position);
CREATE INDEX IF NOT EXISTS idx_profiles_asn_type ON public.profiles(asn_type);

-- permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  code text PRIMARY KEY,
  label text NOT NULL,
  kategori text NOT NULL DEFAULT 'umum',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions baca authenticated" ON public.permissions;
CREATE POLICY "permissions baca authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permissions kelola super_admin" ON public.permissions;
CREATE POLICY "permissions kelola super_admin" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_code)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions baca authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions baca authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_permissions kelola super_admin" ON public.role_permissions;
CREATE POLICY "role_permissions kelola super_admin" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid,
  reason text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_code)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_permissions lihat sendiri" ON public.user_permissions;
CREATE POLICY "user_permissions lihat sendiri" ON public.user_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "user_permissions kelola super_admin" ON public.user_permissions;
CREATE POLICY "user_permissions kelola super_admin" ON public.user_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id, permission_code);

-- rbac_audit
CREATE TABLE IF NOT EXISTS public.rbac_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  target_user_id uuid,
  aksi text NOT NULL,
  entitas text NOT NULL,
  data_sebelum jsonb,
  data_sesudah jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rbac_audit TO authenticated;
GRANT ALL ON public.rbac_audit TO service_role;
ALTER TABLE public.rbac_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_audit lihat admin" ON public.rbac_audit;
CREATE POLICY "rbac_audit lihat admin" ON public.rbac_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda'));
DROP POLICY IF EXISTS "rbac_audit insert authenticated" ON public.rbac_audit;
CREATE POLICY "rbac_audit insert authenticated" ON public.rbac_audit FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON public.rbac_audit(target_user_id, created_at DESC);

-- Helpers
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_permissions up
                 WHERE up.user_id = _user_id AND up.permission_code = _code
                   AND (up.expires_at IS NULL OR up.expires_at > now()))
    THEN (SELECT granted FROM public.user_permissions
          WHERE user_id = _user_id AND permission_code = _code LIMIT 1)
    ELSE EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.permission_code = _code
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS TABLE(permission_code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH role_perms AS (
    SELECT DISTINCT rp.permission_code AS code
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
  ),
  overrides AS (
    SELECT permission_code AS code, granted FROM public.user_permissions
    WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now())
  )
  SELECT code FROM (
    SELECT code FROM role_perms
    WHERE code NOT IN (SELECT code FROM overrides WHERE granted = false)
    UNION
    SELECT code FROM overrides WHERE granted = true
  ) x
$$;

CREATE OR REPLACE FUNCTION public.get_user_asn_type(_user_id uuid)
RETURNS public.asn_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT asn_type FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_position(_user_id uuid)
RETURNS public.system_position LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT system_position FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Trigger audit RBAC
CREATE OR REPLACE FUNCTION public.log_rbac_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target uuid; _before jsonb; _after jsonb;
BEGIN
  IF TG_OP='DELETE' THEN _target := OLD.user_id; _before := to_jsonb(OLD); _after := NULL;
  ELSIF TG_OP='INSERT' THEN _target := NEW.user_id; _before := NULL; _after := to_jsonb(NEW);
  ELSE _target := NEW.user_id; _before := to_jsonb(OLD); _after := to_jsonb(NEW);
  END IF;
  INSERT INTO public.rbac_audit(user_id, target_user_id, aksi, entitas, data_sebelum, data_sesudah)
  VALUES (auth.uid(), _target, lower(TG_OP), TG_TABLE_NAME, _before, _after);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_rbac_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_rbac_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_rbac_change();

DROP TRIGGER IF EXISTS trg_user_permissions_rbac_audit ON public.user_permissions;
CREATE TRIGGER trg_user_permissions_rbac_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_rbac_change();

-- Seed permissions
INSERT INTO public.permissions(code,label,kategori,description) VALUES
  ('can_create_form','Buat Form','form','Membuat template form/dataset'),
  ('can_edit_form','Ubah Form','form','Mengubah template form'),
  ('can_publish_form','Terbitkan Form','form','Menerbitkan form ke target'),
  ('can_assign_form','Tugaskan Form','form','Menugaskan form ke user/OPD'),
  ('can_verify_submission','Verifikasi Submisi','submission','Verifikasi data submisi'),
  ('can_approve_submission','Setujui Submisi','submission','Approval submisi'),
  ('can_reject_submission','Tolak Submisi','submission','Menolak submisi'),
  ('can_request_revision','Minta Revisi','submission','Meminta revisi submisi'),
  ('can_view_sensitive_document','Lihat Dokumen Sensitif','document','Akses dokumen sensitif'),
  ('can_download_document','Unduh Dokumen','document','Mengunduh lampiran'),
  ('can_share_document','Bagikan Dokumen','document','Membagikan paket data'),
  ('can_request_document','Minta Dokumen','document','Meminta dokumen dari OPD lain'),
  ('can_manage_users','Kelola Pengguna','admin','Mengelola akun pengguna'),
  ('can_manage_opd','Kelola OPD','admin','Mengelola data OPD'),
  ('can_view_audit_logs','Lihat Audit Log','admin','Melihat catatan audit'),
  ('can_export_data','Ekspor Data','admin','Ekspor data ke file'),
  ('can_manage_roles','Kelola Role','admin','Mengelola role & permission')
ON CONFLICT (code) DO NOTHING;

-- Seed role_permissions
INSERT INTO public.role_permissions(role, permission_code)
SELECT 'super_admin'::app_role, code FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, permission_code) VALUES
  ('admin_pemda','can_manage_opd'),
  ('admin_pemda','can_view_audit_logs'),
  ('admin_pemda','can_export_data'),
  ('admin_pemda','can_approve_submission'),
  ('admin_pemda','can_view_sensitive_document'),
  ('admin_pemda','can_download_document'),
  ('admin_pemda','can_share_document'),
  ('admin_opd','can_create_form'),
  ('admin_opd','can_edit_form'),
  ('admin_opd','can_publish_form'),
  ('admin_opd','can_assign_form'),
  ('admin_opd','can_verify_submission'),
  ('admin_opd','can_approve_submission'),
  ('admin_opd','can_reject_submission'),
  ('admin_opd','can_request_revision'),
  ('admin_opd','can_view_sensitive_document'),
  ('admin_opd','can_download_document'),
  ('admin_opd','can_share_document'),
  ('admin_opd','can_request_document'),
  ('admin_opd','can_export_data'),
  ('admin_desa','can_verify_submission'),
  ('admin_desa','can_download_document'),
  ('admin_desa','can_export_data'),
  ('asn','can_share_document'),
  ('asn','can_request_document'),
  ('asn','can_download_document')
ON CONFLICT DO NOTHING;
