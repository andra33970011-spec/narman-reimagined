ALTER TABLE public.share_lampiran
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS mime text,
  ADD COLUMN IF NOT EXISTS ukuran bigint,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE public.share_lampiran ALTER COLUMN url DROP NOT NULL;

ALTER TABLE public.share_target
  ADD COLUMN IF NOT EXISTS dibuka_pada timestamptz,
  ADD COLUMN IF NOT EXISTS tindak_lanjut_catatan text,
  ADD COLUMN IF NOT EXISTS tindak_lanjut_pada timestamptz;