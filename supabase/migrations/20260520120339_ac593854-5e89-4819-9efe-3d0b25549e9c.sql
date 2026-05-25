-- Seed Data Terpadu items (KPI, chart layanan, penduduk, anggaran)
INSERT INTO public.data_terpadu_item (kategori,label,nilai_teks,trend,ikon,urutan) VALUES
('kpi','Total Penduduk','1.42 Juta','+1.2% YoY','Users',1),
('kpi','Dataset Publik','312','+18 bulan ini','Database',2),
('kpi','Realisasi APBD','67.8%','Triwulan II','Wallet',3),
('kpi','Pertumbuhan Ekonomi','5.4%','+0.3% QoQ','TrendingUp',4)
ON CONFLICT DO NOTHING;

INSERT INTO public.data_terpadu_item (kategori, label, nilai_num, nilai_num2, urutan) VALUES
  ('chart_layanan', 'Jan', 32500, 30100, 1),
  ('chart_layanan', 'Feb', 35200, 33700, 2),
  ('chart_layanan', 'Mar', 41200, 39800, 3),
  ('chart_layanan', 'Apr', 38900, 37200, 4),
  ('chart_layanan', 'Mei', 44100, 42500, 5),
  ('chart_layanan', 'Jun', 48200, 46900, 6)
ON CONFLICT DO NOTHING;

INSERT INTO public.data_terpadu_item (kategori, label, nilai_num, urutan) VALUES
  ('penduduk', '0-17', 28, 1),('penduduk', '18-35', 32, 2),
  ('penduduk', '36-55', 26, 3),('penduduk', '56+', 14, 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.data_terpadu_item (kategori, label, nilai_num, urutan) VALUES
  ('anggaran', 'Pendidikan', 1240, 1),('anggaran', 'Kesehatan', 980, 2),
  ('anggaran', 'Infrastruktur', 1530, 3),('anggaran', 'Sosial', 720, 4),
  ('anggaran', 'Ekonomi', 640, 5),('anggaran', 'Lingkungan', 410, 6)
ON CONFLICT DO NOTHING;