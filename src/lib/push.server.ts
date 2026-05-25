// Helper pengiriman Web Push notification.
// Dipakai oleh server functions; tidak boleh diimport dari client.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY ||
    "BCbhbNJtF9zAlDdbFCPI8vWZdxWj-NCVvC3Hw_X6C4nCkmjJDGzUIiRLWggL0mn_Q2xXX03LMmNHxOgbA6G_TCY";
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!configure()) return { sent: 0, skipped: userIds.length, reason: "VAPID_PRIVATE_KEY belum di-set" };
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return { sent: 0, skipped: 0 };

  const { data: subs } = await supabaseAdmin
    .from("push_subscription")
    .select("id,endpoint,p256dh,auth,user_id")
    .in("user_id", ids);
  if (!subs || subs.length === 0) return { sent: 0, skipped: ids.length };

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) stale.push(s.id);
    }
  }));
  if (stale.length > 0) {
    await supabaseAdmin.from("push_subscription").delete().in("id", stale);
  }
  return { sent, skipped: ids.length - sent };
}

// Resolusi user yang menjadi target paket (untuk notifikasi penerima).
export async function resolveTargetUserIds(paketId: string): Promise<string[]> {
  const { data: targets } = await supabaseAdmin
    .from("share_target")
    .select("target_type,target_user_id,target_opd_id")
    .eq("paket_id", paketId);
  if (!targets) return [];
  const ids = new Set<string>();
  const opdIds: string[] = [];
  for (const t of targets) {
    if (t.target_user_id) ids.add(t.target_user_id);
    if (t.target_type === "opd" && t.target_opd_id) opdIds.push(t.target_opd_id);
  }
  if (opdIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id").in("opd_id", opdIds).eq("status", "active");
    (profs ?? []).forEach((p) => ids.add(p.id));
  }
  const hasPimpinan = targets.some((t) => t.target_type === "pimpinan");
  if (hasPimpinan) {
    const { data: pim } = await supabaseAdmin
      .from("pejabat").select("user_id").eq("is_pimpinan", true).eq("aktif", true);
    (pim ?? []).forEach((p) => { if (p.user_id) ids.add(p.user_id); });
  }
  return Array.from(ids);
}
