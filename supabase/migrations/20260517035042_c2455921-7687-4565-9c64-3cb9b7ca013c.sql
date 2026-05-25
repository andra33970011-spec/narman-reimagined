
-- =========================================================
-- 1) Public bucket: drop broad SELECT (listing) policy.
--    Public URLs to /storage/v1/object/public/branding/* still work.
-- =========================================================
DROP POLICY IF EXISTS "Branding publik baca" ON storage.objects;

-- =========================================================
-- 2) Private schema for SECURITY DEFINER implementations.
-- =========================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- ---------- RLS helpers (impl in private) ----------
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_desa(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.get_user_opd(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND desa = _desa)
$$;

-- ---------- Aggregations & admin RPCs (impl in private) ----------
CREATE OR REPLACE FUNCTION private.opd_rating_agg()
RETURNS TABLE(opd_id uuid, total_rating bigint, jumlah_rating bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.opd_id, COALESCE(SUM(r.skor),0)::bigint, COUNT(r.id)::bigint
  FROM public.permohonan p JOIN public.permohonan_rating r ON r.permohonan_id = p.id
  WHERE p.opd_id IS NOT NULL GROUP BY p.opd_id;
$$;

CREATE OR REPLACE FUNCTION private.count_permohonan_bulan_ini()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.permohonan WHERE tanggal_masuk >= date_trunc('month', now());
$$;

CREATE OR REPLACE FUNCTION private.opd_kinerja_agg()
RETURNS TABLE(opd_id uuid, status text, total bigint, total_hari_selesai numeric, jumlah_selesai bigint, tepat_waktu bigint, selesai_dengan_sla bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.opd_id, p.status::text, COUNT(*)::bigint,
    COALESCE(SUM(CASE WHEN p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (p.updated_at - p.tanggal_masuk))/86400.0 ELSE 0 END),0)::numeric,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint
  FROM public.permohonan p GROUP BY p.opd_id, p.status;
$$;

CREATE OR REPLACE FUNCTION private.rating_list_admin()
RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamp with time zone, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id,
    pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE public.has_role(auth.uid(),'super_admin') ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION private.riwayat_dengan_petugas(_permohonan_id uuid)
RETURNS TABLE(id uuid, created_at timestamp with time zone, aksi text, catatan text, oleh uuid, nama_petugas text, email_petugas text)
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

-- Grant execute on private impls to roles that need them
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_desa(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_opd(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.user_in_desa(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.opd_rating_agg() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.count_permohonan_bulan_ini() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.opd_kinerja_agg() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.rating_list_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.riwayat_dengan_petugas(uuid) TO authenticated, service_role;

-- =========================================================
-- 3) Replace public functions with SECURITY INVOKER wrappers.
--    Wrapper delegates to private impl which runs as definer.
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_role(_user_id, _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_desa(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.get_user_desa(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_opd(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.get_user_opd(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.user_in_desa(_user_id, _desa)
$$;

CREATE OR REPLACE FUNCTION public.opd_rating_agg()
RETURNS TABLE(opd_id uuid, total_rating bigint, jumlah_rating bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.opd_rating_agg()
$$;

CREATE OR REPLACE FUNCTION public.count_permohonan_bulan_ini()
RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.count_permohonan_bulan_ini()
$$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_agg()
RETURNS TABLE(opd_id uuid, status text, total bigint, total_hari_selesai numeric, jumlah_selesai bigint, tepat_waktu bigint, selesai_dengan_sla bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.opd_kinerja_agg()
$$;

CREATE OR REPLACE FUNCTION public.rating_list_admin()
RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamp with time zone, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.rating_list_admin()
$$;

CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid)
RETURNS TABLE(id uuid, created_at timestamp with time zone, aksi text, catatan text, oleh uuid, nama_petugas text, email_petugas text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM private.riwayat_dengan_petugas(_permohonan_id)
$$;

-- =========================================================
-- 4) Trigger-only functions: revoke EXECUTE from public roles.
--    Triggers fire with table-owner privileges regardless.
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_permohonan_change()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_verified_profile() FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 5) Enable Data Terpadu publicly (no login required).
-- =========================================================
INSERT INTO public.app_setting (key, value)
VALUES ('data_terpadu_visible_public', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
