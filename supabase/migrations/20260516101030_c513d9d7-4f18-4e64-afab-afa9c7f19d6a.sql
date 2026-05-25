-- Branding storage bucket (public) for site logo & images
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public can read branding files
DROP POLICY IF EXISTS "Branding publik baca" ON storage.objects;
CREATE POLICY "Branding publik baca"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Only super_admin can upload/update/delete branding files
DROP POLICY IF EXISTS "Super admin kelola branding" ON storage.objects;
CREATE POLICY "Super admin kelola branding"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'super_admin'));

-- Seed default branding setting if absent
INSERT INTO public.app_setting (key, value)
VALUES ('site_branding', jsonb_build_object(
  'logo_url', '',
  'brand_prefix', 'PEMERINTAH KABUPATEN',
  'brand_name', 'BUTON SELATAN',
  'top_bar_text', 'Portal Resmi Pemerintah Kabupaten Buton Selatan',
  'hero_eyebrow', 'Portal Resmi Pemerintah',
  'hero_title_line1', 'Satu Pintu,',
  'hero_title_line2', 'Satu Data,',
  'hero_title_line3', 'Satu Pelayanan.',
  'hero_subtitle', 'Akses seluruh layanan publik Kabupaten Buton Selatan dan data pemerintah terpadu dalam satu tempat — cepat, transparan, dan terverifikasi.',
  'footer_org', 'Pemerintah Kabupaten Buton Selatan',
  'footer_tagline', 'Melayani dengan integritas & data',
  'footer_description', 'Situs resmi pemusatan pelayanan publik dan data terintegrasi Kabupaten Buton Selatan. Transparan, terpadu, dan dapat diakses kapan saja.',
  'footer_address', 'Jl. Gajah Mada, Kabupaten Buton Selatan',
  'footer_phone', '(021) 555-0100',
  'footer_email', 'info@butonselatankab.go.id'
))
ON CONFLICT (key) DO NOTHING;