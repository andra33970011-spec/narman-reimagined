-- =====================================================================
-- 02. DATA PUBLIK - master & konten yang ditampilkan di website
-- =====================================================================
-- OPD, Desa, Kategori Layanan, Layanan Publik, Pejabat, Berita,
-- Data Terpadu, App Setting (branding, dll).
-- Aman dijalankan ulang: gunakan ON CONFLICT DO NOTHING jika perlu re-seed.
-- =====================================================================

--
-- PostgreSQL database dump
--




--
-- Data for Name: app_setting; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_setting (key, value, updated_at) VALUES ('data_terpadu_visible_public', 'true', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('kinerja_opd_visible_public', 'true', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('storage_cleanup_enabled', 'false', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('storage_cleanup_months', '6', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('village_verification', '{"mode": "badge_only", "enabled": false}', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('gdrive_backup_config', '{"enabled": false, "last_run": null, "schedule": "daily", "folder_id": "", "last_file": null, "last_status": null}', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('permohonan_require_verification', '{"required": false}', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.app_setting (key, value, updated_at) VALUES ('show_opd_directory', '{"visible": true}', '2026-05-23 07:23:14.968284+00');


--
-- Data for Name: berita; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: data_terpadu_item; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('91164520-b971-4ee2-b088-143c07fa4153', 'kpi', 'Total Penduduk', '1.42 Juta', NULL, NULL, NULL, '+1.2% YoY', 'Users', NULL, NULL, NULL, NULL, true, 1, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('3be7aa23-7744-4cb4-a8c6-a3ab5a82108c', 'kpi', 'Dataset Publik', '312', NULL, NULL, NULL, '+18 bulan ini', 'Database', NULL, NULL, NULL, NULL, true, 2, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('17eef424-8bda-4ac7-9e7b-6428ceceb801', 'kpi', 'Realisasi APBD', '67.8%', NULL, NULL, NULL, 'Triwulan II', 'Wallet', NULL, NULL, NULL, NULL, true, 3, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('26686258-6ab8-440c-9d7f-e6051d3d5df5', 'kpi', 'Pertumbuhan Ekonomi', '5.4%', NULL, NULL, NULL, '+0.3% QoQ', 'TrendingUp', NULL, NULL, NULL, NULL, true, 4, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('2da627c8-86e3-477f-abd0-e115f5d8aa17', 'chart_layanan', 'Jan', NULL, 32500, 30100, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 1, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('febac05f-9604-4557-88c0-c90ad01a404e', 'chart_layanan', 'Feb', NULL, 35200, 33700, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 2, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('e7aba896-dcb4-4523-a467-daa203270c14', 'chart_layanan', 'Mar', NULL, 41200, 39800, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 3, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('7c824f15-f12e-4544-b6a2-886bb1cdb273', 'chart_layanan', 'Apr', NULL, 38900, 37200, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 4, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('63c6a3f3-0698-4aa7-8f57-e0ad502e2fd9', 'chart_layanan', 'Mei', NULL, 44100, 42500, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 5, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('639b48be-39d0-4892-8838-80de0900e31d', 'chart_layanan', 'Jun', NULL, 48200, 46900, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 6, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('a6e725b0-a10c-4b22-b6da-548cee194d0a', 'penduduk', '0-17', NULL, 28, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 1, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('04269fbd-4fe2-4585-87d9-a7872aa530f8', 'penduduk', '18-35', NULL, 32, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 2, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('59c6c34c-fefe-409d-b3f3-df1c9f7f5730', 'penduduk', '36-55', NULL, 26, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 3, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('2e7ce925-1a0a-4b70-ba55-7f856c2a934d', 'penduduk', '56+', NULL, 14, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 4, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('f00a5139-698a-4797-b3bf-c6a75241ec93', 'anggaran', 'Pendidikan', NULL, 1240, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 1, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('f9b8f972-162a-458f-995c-cbdd71cc652b', 'anggaran', 'Kesehatan', NULL, 980, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 2, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('67bbef18-7620-4f56-9306-9761ba43e394', 'anggaran', 'Infrastruktur', NULL, 1530, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 3, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('4715e786-f6ea-46fe-9677-297af010dba0', 'anggaran', 'Sosial', NULL, 720, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 4, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('ea078868-cccb-4a4d-a5ce-612bfe73b14b', 'anggaran', 'Ekonomi', NULL, 640, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 5, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');
INSERT INTO public.data_terpadu_item (id, kategori, label, nilai_teks, nilai_num, nilai_num2, satuan, trend, ikon, format, ukuran, url, opd, aktif, urutan, created_at, updated_at) VALUES ('2b8802b9-bce1-4748-9e30-5b61eebe4756', 'anggaran', 'Lingkungan', NULL, 410, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 6, '2026-05-23 07:21:23.888178+00', '2026-05-23 07:21:23.888178+00');


--
-- Data for Name: desa; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: kategori_layanan; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: opd; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.opd (id, nama, singkatan, kategori, created_at) VALUES ('c8bbce05-b8b2-4b3b-8146-3421c6e97e28', 'Dinas Kependudukan dan Pencatatan Sipil', 'Disdukcapil', '{Kependudukan}', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.opd (id, nama, singkatan, kategori, created_at) VALUES ('a5f3e57d-0354-411f-8f8d-2c83a5b6d8b4', 'Dinas Kesehatan', 'Dinkes', '{Kesehatan}', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.opd (id, nama, singkatan, kategori, created_at) VALUES ('77de9e98-4f44-4a9c-bbbd-00cd76b86de6', 'Dinas Penanaman Modal dan PTSP', 'DPMPTSP', '{Perizinan}', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.opd (id, nama, singkatan, kategori, created_at) VALUES ('ee2bc5b7-3ccc-4487-bb49-9e1b2cfef475', 'Dinas Perhubungan', 'Dishub', '{Perhubungan}', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.opd (id, nama, singkatan, kategori, created_at) VALUES ('12d270cc-ecb1-44e5-b603-90b8c382e8c6', 'Dinas Pariwisata', 'Dispar', '{Pariwisata}', '2026-05-23 07:23:14.968284+00');


--
-- Data for Name: layanan_publik; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('141c336f-e980-4d65-b967-b2a115d3377b', 'Penerbitan Kartu Keluarga (KK)', 'penerbitan-kartu-keluarga', 'Penerbitan atau perubahan Kartu Keluarga karena pernikahan, kelahiran, kematian, perpindahan, atau pisah KK.', 'Users', 'c8bbce05-b8b2-4b3b-8146-3421c6e97e28', 'Surat Pengantar RT/RW
KK lama (asli)
Fotokopi KTP-el seluruh anggota keluarga
Dokumen pendukung perubahan', 'Pemohon mengajukan berkas
Verifikasi berkas
Perekaman & pencetakan KK
Penyerahan KK', true, 1, 7, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('429fdfd8-5637-4595-8203-fd0169c3f892', 'Penerbitan KTP Elektronik (KTP-el)', 'penerbitan-ktp-elektronik', 'Perekaman dan pencetakan KTP elektronik untuk WNI berusia 17 tahun ke atas.', 'IdCard', 'c8bbce05-b8b2-4b3b-8146-3421c6e97e28', 'Fotokopi KK
Surat pengantar dari kelurahan/desa
KTP lama (jika perpanjangan)
Pas foto 3x4', 'Pengambilan nomor antrian
Perekaman biometrik
Verifikasi data
Pencetakan dan penyerahan KTP-el', true, 2, 14, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('ae12cbce-40fa-42a1-952b-36623fdd6ad1', 'Penerbitan Akta Kelahiran', 'penerbitan-akta-kelahiran', 'Pencatatan kelahiran dan penerbitan kutipan akta kelahiran.', 'Baby', 'c8bbce05-b8b2-4b3b-8146-3421c6e97e28', 'Surat keterangan lahir
Fotokopi KK orang tua
Fotokopi KTP-el orang tua
Fotokopi buku nikah', 'Pengajuan berkas
Verifikasi data
Penerbitan kutipan akta
Penyerahan akta', true, 3, 5, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('9b546cd1-4b2a-445d-80fe-bd24a8e1b2e9', 'Surat Keterangan Sehat', 'surat-keterangan-sehat', 'Pemeriksaan kesehatan dasar dan penerbitan surat keterangan sehat.', 'Stethoscope', 'a5f3e57d-0354-411f-8f8d-2c83a5b6d8b4', 'Fotokopi KTP-el
Pas foto 3x4
Bukti pembayaran retribusi', 'Pendaftaran di puskesmas/RS
Pemeriksaan dokter
Penerbitan surat keterangan', true, 5, 1, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('0ce83144-d513-4916-a028-58401c969962', 'Nomor Induk Berusaha (NIB) UMKM', 'nomor-induk-berusaha-umkm', 'Pendampingan penerbitan NIB melalui sistem OSS-RBA untuk pelaku UMKM.', 'Briefcase', '77de9e98-4f44-4a9c-bbbd-00cd76b86de6', 'Fotokopi KTP-el
NPWP (jika ada)
Nomor HP & email aktif
Data usaha', 'Konsultasi di MPP
Pengisian data OSS-RBA
Penerbitan NIB elektronik', true, 7, 3, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('e4ddd77d-579c-45df-bba2-5d69b334a421', 'Uji KIR Kendaraan Bermotor', 'uji-kir-kendaraan', 'Pengujian berkala kendaraan bermotor wajib uji untuk memastikan laik jalan.', 'Truck', 'ee2bc5b7-3ccc-4487-bb49-9e1b2cfef475', 'Fotokopi STNK & BPKB
Fotokopi KTP pemilik
Buku uji lama
Kendaraan dibawa ke lokasi', 'Pendaftaran & pembayaran retribusi
Pemeriksaan administrasi
Pengujian teknis
Penerbitan buku uji', true, 9, 2, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');
INSERT INTO public.layanan_publik (id, judul, slug, deskripsi, ikon, opd_id, persyaratan, alur, aktif, urutan, sla_hari, created_at, updated_at) VALUES ('b8845b73-1fa7-4fa7-b294-0c21c6aaaf63', 'Pendaftaran Usaha Pariwisata (TDUP)', 'pendaftaran-usaha-pariwisata', 'Pendaftaran TDUP untuk hotel, homestay, restoran, agen wisata.', 'Palmtree', '12d270cc-ecb1-44e5-b603-90b8c382e8c6', 'Fotokopi KTP-el
NIB dari OSS
Dokumen legalitas usaha
Foto lokasi usaha', 'Pengajuan berkas
Verifikasi & survey lokasi
Penerbitan TDUP', true, 10, 14, '2026-05-23 07:23:14.968284+00', '2026-05-23 07:23:14.968284+00');


--
-- Data for Name: pejabat; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


