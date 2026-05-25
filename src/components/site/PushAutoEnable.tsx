// Auto-aktif notifikasi PWA. Berjalan di mode standalone (PWA terinstal)
// dan juga ketika izin notifikasi sudah granted di browser biasa.
// Mendengarkan pesan dari service worker untuk menampilkan toast saat foreground.
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const VAPID_PUBLIC_KEY =
  "BCbhbNJtF9zAlDdbFCPI8vWZdxWj-NCVvC3Hw_X6C4nCkmjJDGzUIiRLWggL0mn_Q2xXX03LMmNHxOgbA6G_TCY";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isPreviewOrIframe() {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

async function bufToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ensureSubscription(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  // Paksa update untuk memastikan SW versi terbaru (push handler) terpasang.
  try { await reg.update(); } catch {}
  await navigator.serviceWorker.ready;

  if (Notification.permission === "default") {
    const res = await Notification.requestPermission();
    if (res !== "granted") return;
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh || (await bufToB64(sub.getKey("p256dh")));
  const auth = json.keys?.auth || (await bufToB64(sub.getKey("auth")));

  await supabase
    .from("push_subscription")
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, user_agent: navigator.userAgent },
      { onConflict: "endpoint" },
    );
}

export function PushAutoEnable() {
  const { user } = useAuth();

  // Foreground toast dari SW.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === "push") {
        toast(d.title || "Notifikasi", { description: d.body });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isPreviewOrIframe()) return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const alreadyGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
    const tryEnable = () => { ensureSubscription(user.id).catch(() => {}); };
    if (standalone || alreadyGranted) tryEnable();
    window.addEventListener("appinstalled", tryEnable);
    return () => window.removeEventListener("appinstalled", tryEnable);
  }, [user]);

  return null;
}
