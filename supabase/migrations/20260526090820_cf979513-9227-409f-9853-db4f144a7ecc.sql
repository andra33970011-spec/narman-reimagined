DO $$
DECLARE _pid uuid;
BEGIN
  INSERT INTO share_paket (judul, deskripsi, tipe, prioritas, sensitivitas, pengirim_user_id, pengirim_opd_id, status)
  VALUES ('Uji E2E: Permintaan data layanan Disdukcapil',
          'Mohon kirim data layanan publik bulan ini untuk verifikasi lintas OPD.',
          'dokumen','normal','publik_internal',
          'cc7a84e3-16ef-4d78-bdaf-cd63b9527a7c',
          'a5f3e57d-0354-411f-8f8d-2c83a5b6d8b4',
          'terkirim')
  RETURNING id INTO _pid;

  INSERT INTO share_target (paket_id, target_type, target_user_id)
  VALUES (_pid, 'user', '23ab1595-424a-47c9-b1bf-ffaceedada17');

  INSERT INTO share_riwayat (paket_id, aksi, oleh_user_id, catatan)
  VALUES (_pid, 'dikirim', 'cc7a84e3-16ef-4d78-bdaf-cd63b9527a7c', 'Paket uji E2E dikirim');
END $$;