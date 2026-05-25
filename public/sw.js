// Service worker untuk Web Push notification dan badge.
// Tidak melakukan cache offline; cukup terima push & tampilkan notifikasi.

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: "Notifikasi", body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "Notifikasi";
  const body = payload.body || "";
  const url = payload.url || "/";
  const tag = payload.tag || "notif";
  event.waitUntil((async () => {
    // Foreground toast jika ada client terbuka.
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (clientsList.length > 0) {
      clientsList.forEach((c) => c.postMessage({ type: "push", title, body, url }));
    }
    await self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(url); } catch {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
