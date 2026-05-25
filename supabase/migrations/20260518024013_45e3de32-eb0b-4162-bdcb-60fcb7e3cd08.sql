-- Fix 54001: helper RLS functions harus SECURITY DEFINER agar tidak
-- memicu rekursi RLS saat dipanggil dari policy user_roles/profiles.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_opd(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_desa(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_in_desa(_user_id uuid, _desa text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND desa = _desa)
$$;

-- Pastikan bisa dipanggil oleh user yang sudah login & anon (untuk RLS evaluation)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_desa(uuid, text) TO anon, authenticated;