// Tombol install PWA — selalu tampil di semua platform.
// - Android/Chrome/Edge: trigger native beforeinstallprompt.
// - iOS Safari & browser tanpa prompt: tampilkan modal instruksi manual.
import { useEffect, useState } from "react";
import { Download, X, Share, MoreVertical, Plus } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
}

export function InstallPWAButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneMode()) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Daftarkan service worker agar browser memenuhi syarat installability
    // (manifest + SW dengan fetch handler). Lewati di iframe/preview Lovable
    // karena SW di iframe dapat mengganggu navigasi preview.
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const host = window.location.hostname;
    const isPreviewHost = host.includes("id-preview--") || host.includes("lovableproject.com");
    if ("serviceWorker" in navigator && !inIframe && !isPreviewHost) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // Fallback: tampilkan instruksi manual.
    setShowHowTo(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 ${className}`}
        aria-label="Install aplikasi"
      >
        <Download className="h-4 w-4" />
        Install Aplikasi
      </button>

      {showHowTo && <InstallHowToModal onClose={() => setShowHowTo(false)} />}
    </>
  );
}

function InstallHowToModal({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-foreground shadow-elevated"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Pasang Aplikasi</h3>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {ios ? (
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">1</span>
              <span>Buka menu <b>Bagikan</b> <Share className="inline h-4 w-4 align-text-bottom" /> di bilah Safari.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
              <span>Pilih <b>Tambahkan ke Layar Utama</b> <Plus className="inline h-4 w-4 align-text-bottom" />.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">3</span>
              <span>Ketuk <b>Tambah</b> untuk menyelesaikan instalasi.</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">1</span>
              <span>Ketuk menu browser <MoreVertical className="inline h-4 w-4 align-text-bottom" /> di pojok kanan atas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
              <span>Pilih <b>Install aplikasi</b> atau <b>Tambahkan ke Layar Utama</b>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">3</span>
              <span>Konfirmasi pemasangan, lalu buka dari Layar Utama.</span>
            </li>
          </ol>
        )}
        <p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
          Setelah terpasang, aplikasi akan tampil penuh seperti aplikasi native dan bisa dibuka dari ikon di Layar Utama.
        </p>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
