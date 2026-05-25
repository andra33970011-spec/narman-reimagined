ALTER PUBLICATION supabase_realtime ADD TABLE public.share_paket;
ALTER PUBLICATION supabase_realtime ADD TABLE public.share_target;
ALTER TABLE public.share_paket REPLICA IDENTITY FULL;
ALTER TABLE public.share_target REPLICA IDENTITY FULL;