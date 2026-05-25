-- 1. Master desa
CREATE TABLE IF NOT EXISTS public.desa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  kecamatan text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.desa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Desa publik baca" ON public.desa FOR SELECT TO public USING (true);
CREATE POLICY "Super admin kelola desa" ON public.desa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_desa_updated BEFORE UPDATE ON public.desa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Admin desa lihat permohonan warga sedesa
CREATE POLICY "Admin desa lihat permohonan warga"
ON public.permohonan FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_desa')
  AND pemohon_id IN (
    SELECT id FROM public.profiles WHERE desa = public.get_user_desa(auth.uid())
  )
);

-- 3. Seed app_setting defaults
INSERT INTO public.app_setting (key, value) VALUES
  ('permohonan_require_verification', '{"required": false}'::jsonb),
  ('show_opd_directory', '{"visible": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
