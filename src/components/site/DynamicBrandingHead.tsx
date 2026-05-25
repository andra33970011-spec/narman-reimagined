// Mengganti manifest PWA, judul, ikon, dan theme-color secara dinamis
// sesuai pengaturan branding superadmin.
import { useEffect, useRef } from "react";
import { useSiteBranding } from "@/lib/site-settings";

export function DynamicBrandingHead() {
  const b = useSiteBranding();
  const manifestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const appName = b.meta_site_title || b.brand_name || "Portal Pemerintah";
    const shortName = b.brand_name || "Portal";
    const icon = b.logo_url || "/icon-192.png";

    // Update <title>
    document.title = appName;

    // Update theme-color
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("application-name", appName);
    setMeta("apple-mobile-web-app-title", shortName);
    setMeta("description", b.meta_site_description || "");

    // Update apple-touch-icon & favicon
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };
    setLink("apple-touch-icon", icon);
    setLink("icon", icon);

    // Generate dynamic manifest
    const manifest = {
      name: appName,
      short_name: shortName,
      description: b.meta_site_description || "Portal pelayanan publik dan satu data.",
      start_url: "/",
      scope: "/",
      id: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0F172A",
      theme_color: "#0F172A",
      lang: "id-ID",
      icons: [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);
    if (manifestUrlRef.current) URL.revokeObjectURL(manifestUrlRef.current);
    manifestUrlRef.current = url;

    let mfLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!mfLink) {
      mfLink = document.createElement("link");
      mfLink.rel = "manifest";
      document.head.appendChild(mfLink);
    }
    mfLink.href = url;
  }, [b]);

  return null;
}
