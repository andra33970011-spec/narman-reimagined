-- Lock fields nama_lengkap, nik, no_hp, desa untuk warga setelah verifikasi.
-- Hanya super_admin atau admin_desa (di desa yang sama) yang dapat mengubahnya.
CREATE OR REPLACE FUNCTION public.protect_verified_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_super boolean := false;
  _is_desa boolean := false;
  _caller_desa text;
BEGIN
  -- Hanya berlaku bila profil sudah terverifikasi (sebelumnya).
  IF OLD.verified_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cek apakah ada perubahan field yang dikunci.
  IF NEW.nama_lengkap IS NOT DISTINCT FROM OLD.nama_lengkap
     AND NEW.nik IS NOT DISTINCT FROM OLD.nik
     AND NEW.no_hp IS NOT DISTINCT FROM OLD.no_hp
     AND NEW.desa IS NOT DISTINCT FROM OLD.desa THEN
    RETURN NEW;
  END IF;

  IF _caller IS NULL THEN
    -- Update via service role (server function admin) → izinkan.
    RETURN NEW;
  END IF;

  _is_super := public.has_role(_caller, 'super_admin');
  _is_desa := public.has_role(_caller, 'admin_desa');
  IF _is_super THEN
    RETURN NEW;
  END IF;
  IF _is_desa THEN
    SELECT desa INTO _caller_desa FROM public.profiles WHERE id = _caller;
    IF _caller_desa IS NOT NULL AND _caller_desa = OLD.desa THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Akun terverifikasi: data Nama, NIK, No. HP, dan Desa hanya dapat diubah oleh Admin Desa.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS protect_verified_profile_trg ON public.profiles;
CREATE TRIGGER protect_verified_profile_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_verified_profile();