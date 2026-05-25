-- =====================================================================
-- 03. DATA USER - profil, role, permohonan, audit, aset, dsb.
-- =====================================================================
-- Catatan: baris profiles & user_roles bergantung pada auth.users.
-- Jika project baru belum memiliki user yang sama, baris ini akan gagal
-- foreign key. Untuk DB kosong, lewati file ini dan buat super admin
-- via /auth setelah deploy, lalu naikkan role-nya secara manual.
-- =====================================================================

--
-- PostgreSQL database dump
--




--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.profiles (id, nama_lengkap, nik, no_hp, opd_id, created_at, updated_at, status, desa, verified_at, verified_by, nip, jabatan, username) VALUES ('68b6d1ae-a888-4a45-aba7-1c98787986de', 'Super Admin', NULL, NULL, NULL, '2026-05-23 07:33:31.797069+00', '2026-05-23 07:33:32.111088+00', 'active', NULL, NULL, NULL, NULL, NULL, 'superadmin');


--
-- Data for Name: absensi_asn; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: aset; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: aset_riwayat; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: backup_snapshot; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: job_queue; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: kantor_qr; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: laporan_masyarakat; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permohonan; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permohonan_rating; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permohonan_riwayat; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: push_subscription; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: rate_limit; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('29c433bf-4eba-4ec7-b344-e05e398f0f69', '68b6d1ae-a888-4a45-aba7-1c98787986de', 'warga', '2026-05-23 07:33:31.797069+00');
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES ('1c912919-efc0-4009-aa38-2be1353f9aef', '68b6d1ae-a888-4a45-aba7-1c98787986de', 'super_admin', '2026-05-23 07:33:32.396317+00');


--
-- Data for Name: verification_token; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


