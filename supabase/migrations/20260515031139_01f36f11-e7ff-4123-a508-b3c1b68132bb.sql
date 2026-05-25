
-- Security definer untuk membandingkan desa user lain tanpa memicu RLS profiles
CREATE OR REPLACE FUNCTION public.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND desa = _desa)
$$;

-- Ganti policy admin_desa pada permohonan agar tidak melakukan subquery ke profiles (yang punya policy balik ke permohonan -> rekursi)
DROP POLICY IF EXISTS "Admin desa lihat permohonan warga" ON public.permohonan;

CREATE POLICY "Admin desa lihat permohonan warga"
ON public.permohonan
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_desa'::app_role)
  AND public.user_in_desa(pemohon_id, public.get_user_desa(auth.uid()))
);
