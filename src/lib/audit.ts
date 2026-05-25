// Helper untuk mencatat audit log dari client. RLS sudah memastikan
// hanya user terotentikasi yang bisa insert dengan user_id miliknya sendiri.
import { supabase } from "@/integrations/supabase/client";

type AuditPayload = {
  aksi: string;
  entitas: string;
  entitas_id?: string | null;
  data_sebelum?: unknown;
  data_sesudah?: unknown;
};

export async function logAudit(p: AuditPayload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      aksi: p.aksi,
      entitas: p.entitas,
      entitas_id: p.entitas_id ?? null,
      data_sebelum: (p.data_sebelum ?? null) as never,
      data_sesudah: (p.data_sesudah ?? null) as never,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    // Audit gagal tidak boleh memutus alur user.
    console.warn("audit log failed", e);
  }
}
