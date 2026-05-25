
-- Tambahkan FK yang hilang agar PostgREST bisa melakukan embedded select
-- share_paket
ALTER TABLE public.share_paket
  ADD CONSTRAINT share_paket_pengirim_user_id_fkey
    FOREIGN KEY (pengirim_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT share_paket_pengirim_opd_id_fkey
    FOREIGN KEY (pengirim_opd_id) REFERENCES public.opd(id) ON DELETE SET NULL,
  ADD CONSTRAINT share_paket_approver_id_fkey
    FOREIGN KEY (approver_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT share_paket_dataset_template_id_fkey
    FOREIGN KEY (dataset_template_id) REFERENCES public.dataset_template(id) ON DELETE SET NULL;

-- share_target
ALTER TABLE public.share_target
  ADD CONSTRAINT share_target_target_opd_id_fkey
    FOREIGN KEY (target_opd_id) REFERENCES public.opd(id) ON DELETE CASCADE,
  ADD CONSTRAINT share_target_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT share_target_target_pejabat_id_fkey
    FOREIGN KEY (target_pejabat_id) REFERENCES public.pejabat(id) ON DELETE CASCADE,
  ADD CONSTRAINT share_target_dibuka_oleh_fkey
    FOREIGN KEY (dibuka_oleh) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- share_lampiran
ALTER TABLE public.share_lampiran
  ADD CONSTRAINT share_lampiran_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- share_komentar
ALTER TABLE public.share_komentar
  ADD CONSTRAINT share_komentar_oleh_user_id_fkey
    FOREIGN KEY (oleh_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- share_riwayat
ALTER TABLE public.share_riwayat
  ADD CONSTRAINT share_riwayat_oleh_user_id_fkey
    FOREIGN KEY (oleh_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index untuk performa join & filter inbox
CREATE INDEX IF NOT EXISTS idx_share_target_paket ON public.share_target(paket_id);
CREATE INDEX IF NOT EXISTS idx_share_target_user ON public.share_target(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_target_opd ON public.share_target(target_opd_id) WHERE target_opd_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_target_pejabat ON public.share_target(target_pejabat_id) WHERE target_pejabat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_paket_status ON public.share_paket(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_paket_pengirim ON public.share_paket(pengirim_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_lampiran_paket ON public.share_lampiran(paket_id);
CREATE INDEX IF NOT EXISTS idx_share_komentar_paket ON public.share_komentar(paket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_share_riwayat_paket ON public.share_riwayat(paket_id, created_at);
