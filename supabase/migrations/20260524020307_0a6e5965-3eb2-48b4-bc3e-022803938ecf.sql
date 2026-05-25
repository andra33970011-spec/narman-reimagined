
-- Fix infinite recursion between profiles and permohonan policies
-- Use SECURITY DEFINER helpers to bypass RLS in cross-table lookups.

CREATE OR REPLACE FUNCTION public.is_pemohon_of_opd(_profile_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permohonan
    WHERE pemohon_id = _profile_id
      AND opd_id = public.get_user_opd(_user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_warga_in_admin_desa(_pemohon_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _pemohon_id
      AND desa IS NOT NULL
      AND desa = public.get_user_desa(_user_id)
  )
$$;

DROP POLICY IF EXISTS "Admin lihat profil pemohon" ON public.profiles;
CREATE POLICY "Admin lihat profil pemohon" ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin_opd'::app_role)
    AND public.is_pemohon_of_opd(id, auth.uid())
  );

DROP POLICY IF EXISTS "Admin desa lihat permohonan warga" ON public.permohonan;
CREATE POLICY "Admin desa lihat permohonan warga" ON public.permohonan FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin_desa'::app_role)
    AND public.is_warga_in_admin_desa(pemohon_id, auth.uid())
  );
