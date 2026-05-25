
-- ============== 1. PEJABAT: tambah kolom pimpinan ==============
ALTER TABLE public.pejabat
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS is_pimpinan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level text;

CREATE INDEX IF NOT EXISTS idx_pejabat_user ON public.pejabat(user_id);
CREATE INDEX IF NOT EXISTS idx_pejabat_pimpinan ON public.pejabat(is_pimpinan) WHERE is_pimpinan = true;

-- ============== 2. HELPER FUNCTIONS ==============
CREATE OR REPLACE FUNCTION public.is_pimpinan(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pejabat WHERE user_id = _user_id AND is_pimpinan = true AND aktif = true)
$$;

-- ============== 3. SHARE_PAKET ==============
CREATE TABLE IF NOT EXISTS public.share_paket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE,
  judul text NOT NULL,
  deskripsi text,
  tipe text NOT NULL CHECK (tipe IN ('dokumen','memo','dataset')),
  prioritas text NOT NULL DEFAULT 'normal' CHECK (prioritas IN ('normal','penting','segera','rahasia')),
  sensitivitas text NOT NULL DEFAULT 'publik_internal' CHECK (sensitivitas IN ('publik_internal','terbatas','rahasia')),
  pengirim_user_id uuid NOT NULL,
  pengirim_opd_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','menunggu_approval','disetujui_kirim','ditolak','terkirim','dibatalkan','arsip')),
  approval_required boolean NOT NULL DEFAULT false,
  approver_id uuid,
  approved_at timestamptz,
  approval_note text,
  dataset_template_id uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_paket_pengirim ON public.share_paket(pengirim_user_id);
CREATE INDEX IF NOT EXISTS idx_share_paket_opd ON public.share_paket(pengirim_opd_id);
CREATE INDEX IF NOT EXISTS idx_share_paket_status ON public.share_paket(status);

-- ============== 4. SHARE_TARGET ==============
CREATE TABLE IF NOT EXISTS public.share_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('opd','user','pimpinan')),
  target_opd_id uuid,
  target_user_id uuid,
  target_pejabat_id uuid,
  status_baca text NOT NULL DEFAULT 'belum' CHECK (status_baca IN ('belum','dibuka','ditindaklanjuti','ditolak')),
  dibuka_oleh uuid,
  dibuka_pada timestamptz,
  tindak_lanjut_catatan text,
  tindak_lanjut_pada timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_target_paket ON public.share_target(paket_id);
CREATE INDEX IF NOT EXISTS idx_share_target_opd ON public.share_target(target_opd_id);
CREATE INDEX IF NOT EXISTS idx_share_target_user ON public.share_target(target_user_id);
CREATE INDEX IF NOT EXISTS idx_share_target_pejabat ON public.share_target(target_pejabat_id);

-- ============== 5. SHARE_LAMPIRAN ==============
CREATE TABLE IF NOT EXISTS public.share_lampiran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  nama_file text NOT NULL,
  mime text,
  ukuran bigint NOT NULL DEFAULT 0,
  path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_lampiran_paket ON public.share_lampiran(paket_id);

-- ============== 6. SHARE_RIWAYAT ==============
CREATE TABLE IF NOT EXISTS public.share_riwayat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  aksi text NOT NULL,
  oleh_user_id uuid,
  catatan text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_riwayat_paket ON public.share_riwayat(paket_id);

-- ============== 7. SHARE_KOMENTAR ==============
CREATE TABLE IF NOT EXISTS public.share_komentar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES public.share_paket(id) ON DELETE CASCADE,
  oleh_user_id uuid NOT NULL,
  isi text NOT NULL,
  lampiran_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_komentar_paket ON public.share_komentar(paket_id);

-- ============== 8. DATASET_TEMPLATE ==============
CREATE TABLE IF NOT EXISTS public.dataset_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text UNIQUE,
  judul text NOT NULL,
  deskripsi text,
  opd_pemilik_id uuid,
  target_role text NOT NULL DEFAULT 'asn' CHECK (target_role IN ('asn','admin_opd','semua')),
  target_scope text NOT NULL DEFAULT 'opd_sendiri' CHECK (target_scope IN ('opd_sendiri','lintas_opd','spesifik')),
  target_opd_ids uuid[] DEFAULT '{}',
  kolom jsonb NOT NULL DEFAULT '[]',
  excel_layout jsonb NOT NULL DEFAULT '{}',
  deadline timestamptz,
  aktif boolean NOT NULL DEFAULT true,
  allow_multiple_submit boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dataset_template_opd ON public.dataset_template(opd_pemilik_id);

-- ============== 9. DATASET_SUBMISSION ==============
CREATE TABLE IF NOT EXISTS public.dataset_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.dataset_template(id) ON DELETE CASCADE,
  oleh_user_id uuid NOT NULL,
  opd_id uuid,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('draft','final','dikembalikan')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  returned_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dataset_sub_tpl ON public.dataset_submission(template_id);
CREATE INDEX IF NOT EXISTS idx_dataset_sub_user ON public.dataset_submission(oleh_user_id);
CREATE INDEX IF NOT EXISTS idx_dataset_sub_opd ON public.dataset_submission(opd_id);

-- ============== 10. can_access_paket ==============
CREATE OR REPLACE FUNCTION public.can_access_paket(_paket_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.share_paket p
    WHERE p.id = _paket_id AND (
      p.pengirim_user_id = _user_id
      OR public.has_role(_user_id, 'super_admin'::app_role)
      OR (public.has_role(_user_id, 'admin_opd'::app_role) AND p.pengirim_opd_id = public.get_user_opd(_user_id))
      OR EXISTS (
        SELECT 1 FROM public.share_target t
        WHERE t.paket_id = p.id AND (
          t.target_user_id = _user_id
          OR (t.target_type='opd' AND t.target_opd_id = public.get_user_opd(_user_id))
          OR (t.target_type='pimpinan' AND public.is_pimpinan(_user_id))
        )
      )
    )
  )
$$;

-- ============== 11. TRIGGERS ==============
-- Generate kode SHR-YYYY-XXXXXX
CREATE OR REPLACE FUNCTION public.gen_share_kode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kode IS NULL OR NEW.kode = '' THEN
    NEW.kode := 'SHR-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*900000)+100000)::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gen_dataset_kode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kode IS NULL OR NEW.kode = '' THEN
    NEW.kode := 'DST-' || to_char(now(),'YYYY') || '-' || lpad((floor(random()*900000)+100000)::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

-- Hitung approval_required otomatis saat submit
CREATE OR REPLACE FUNCTION public.set_paket_approval_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE need boolean := false;
BEGIN
  IF NEW.sensitivitas = 'rahasia' THEN need := true; END IF;
  IF EXISTS (SELECT 1 FROM public.share_target t WHERE t.paket_id = NEW.id AND t.target_type='pimpinan') THEN
    need := true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.share_target t
    WHERE t.paket_id = NEW.id AND t.target_type='opd'
      AND t.target_opd_id IS DISTINCT FROM NEW.pengirim_opd_id
  ) THEN need := true; END IF;
  NEW.approval_required := need;
  RETURN NEW;
END $$;

-- Log riwayat saat status berubah
CREATE OR REPLACE FUNCTION public.log_share_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.share_riwayat(paket_id, aksi, oleh_user_id, meta)
    VALUES (NEW.id, 'dibuat', NEW.pengirim_user_id, jsonb_build_object('status',NEW.status));
  ELSIF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.share_riwayat(paket_id, aksi, oleh_user_id, catatan, meta)
    VALUES (NEW.id, 'status_berubah', COALESCE(NEW.approver_id, NEW.pengirim_user_id), NEW.approval_note,
      jsonb_build_object('dari',OLD.status,'ke',NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_share_paket_kode ON public.share_paket;
CREATE TRIGGER trg_share_paket_kode BEFORE INSERT ON public.share_paket
  FOR EACH ROW EXECUTE FUNCTION public.gen_share_kode();

DROP TRIGGER IF EXISTS trg_share_paket_updated ON public.share_paket;
CREATE TRIGGER trg_share_paket_updated BEFORE UPDATE ON public.share_paket
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_share_paket_log ON public.share_paket;
CREATE TRIGGER trg_share_paket_log AFTER INSERT OR UPDATE ON public.share_paket
  FOR EACH ROW EXECUTE FUNCTION public.log_share_event();

DROP TRIGGER IF EXISTS trg_dataset_template_kode ON public.dataset_template;
CREATE TRIGGER trg_dataset_template_kode BEFORE INSERT ON public.dataset_template
  FOR EACH ROW EXECUTE FUNCTION public.gen_dataset_kode();

DROP TRIGGER IF EXISTS trg_dataset_template_updated ON public.dataset_template;
CREATE TRIGGER trg_dataset_template_updated BEFORE UPDATE ON public.dataset_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_dataset_sub_updated ON public.dataset_submission;
CREATE TRIGGER trg_dataset_sub_updated BEFORE UPDATE ON public.dataset_submission
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== 12. RLS ==============
ALTER TABLE public.share_paket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_target ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_lampiran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_riwayat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_komentar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_submission ENABLE ROW LEVEL SECURITY;

-- share_paket
CREATE POLICY "paket select akses" ON public.share_paket FOR SELECT TO authenticated
  USING (public.can_access_paket(id, auth.uid()));
CREATE POLICY "paket insert pengirim" ON public.share_paket FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = pengirim_user_id);
CREATE POLICY "paket update pengirim draft" ON public.share_paket FOR UPDATE TO authenticated
  USING (auth.uid() = pengirim_user_id AND status IN ('draft','ditolak'))
  WITH CHECK (auth.uid() = pengirim_user_id);
CREATE POLICY "paket update approver" ON public.share_paket FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin_opd'::app_role) AND pengirim_opd_id = public.get_user_opd(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin_opd'::app_role) AND pengirim_opd_id = public.get_user_opd(auth.uid()));
CREATE POLICY "paket super admin" ON public.share_paket FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

-- share_target
CREATE POLICY "target select akses" ON public.share_target FOR SELECT TO authenticated
  USING (public.can_access_paket(paket_id, auth.uid()));
CREATE POLICY "target insert pengirim" ON public.share_target FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid()));
CREATE POLICY "target update penerima" ON public.share_target FOR UPDATE TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (target_type='opd' AND target_opd_id = public.get_user_opd(auth.uid()))
    OR (target_type='pimpinan' AND public.is_pimpinan(auth.uid()))
    OR public.has_role(auth.uid(),'super_admin'::app_role)
  );
CREATE POLICY "target delete pengirim" ON public.share_target FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid() AND p.status IN ('draft','ditolak')));

-- share_lampiran
CREATE POLICY "lampiran select akses" ON public.share_lampiran FOR SELECT TO authenticated
  USING (public.can_access_paket(paket_id, auth.uid()));
CREATE POLICY "lampiran insert pengirim" ON public.share_lampiran FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid()));
CREATE POLICY "lampiran delete pengirim" ON public.share_lampiran FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.share_paket p WHERE p.id=paket_id AND p.pengirim_user_id = auth.uid() AND p.status IN ('draft','ditolak')));

-- share_riwayat
CREATE POLICY "riwayat select akses" ON public.share_riwayat FOR SELECT TO authenticated
  USING (public.can_access_paket(paket_id, auth.uid()));
CREATE POLICY "riwayat insert" ON public.share_riwayat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = oleh_user_id OR public.has_role(auth.uid(),'super_admin'::app_role));

-- share_komentar
CREATE POLICY "komentar select akses" ON public.share_komentar FOR SELECT TO authenticated
  USING (public.can_access_paket(paket_id, auth.uid()));
CREATE POLICY "komentar insert akses" ON public.share_komentar FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = oleh_user_id AND public.can_access_paket(paket_id, auth.uid()));

-- dataset_template
CREATE POLICY "tpl select" ON public.dataset_template FOR SELECT TO authenticated
  USING (
    aktif = true
    OR public.has_role(auth.uid(),'super_admin'::app_role)
    OR (public.has_role(auth.uid(),'admin_opd'::app_role) AND opd_pemilik_id = public.get_user_opd(auth.uid()))
    OR public.is_pimpinan(auth.uid())
  );
CREATE POLICY "tpl admin opd kelola" ON public.dataset_template FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin_opd'::app_role) AND opd_pemilik_id = public.get_user_opd(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin_opd'::app_role) AND opd_pemilik_id = public.get_user_opd(auth.uid()));
CREATE POLICY "tpl super admin" ON public.dataset_template FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'::app_role));

-- dataset_submission
CREATE POLICY "sub user kelola sendiri" ON public.dataset_submission FOR ALL TO authenticated
  USING (auth.uid() = oleh_user_id)
  WITH CHECK (auth.uid() = oleh_user_id);
CREATE POLICY "sub admin opd lihat" ON public.dataset_submission FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role)
    OR public.is_pimpinan(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.dataset_template t WHERE t.id = template_id AND (
        (public.has_role(auth.uid(),'admin_opd'::app_role) AND t.opd_pemilik_id = public.get_user_opd(auth.uid()))
      )
    )
  );

-- pejabat: super admin sudah kelola semua; tambah policy update untuk pejabat sendiri
CREATE POLICY "pejabat self lihat" ON public.pejabat FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR aktif = true);

-- ============== 13. STORAGE BUCKET share-files ==============
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-files','share-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "share-files baca akses paket" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'share-files' AND public.can_access_paket(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "share-files upload pengirim" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'share-files' AND EXISTS (
      SELECT 1 FROM public.share_paket p
      WHERE p.id = ((storage.foldername(name))[1])::uuid AND p.pengirim_user_id = auth.uid()
    )
  );
CREATE POLICY "share-files hapus pengirim" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'share-files' AND EXISTS (
      SELECT 1 FROM public.share_paket p
      WHERE p.id = ((storage.foldername(name))[1])::uuid AND p.pengirim_user_id = auth.uid()
    )
  );
