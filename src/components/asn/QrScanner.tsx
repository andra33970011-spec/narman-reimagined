// Komponen scanner QR untuk kamera. Lazy-load html5-qrcode supaya tidak menyentuh SSR.
import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (text: string) => void;
  paused?: boolean;
};

export function QrScanner({ onResult, paused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useRef(`qr-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;
    if (paused) return;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;
        const html5 = new mod.Html5Qrcode(id.current);
        scannerRef.current = html5 as unknown as { stop: () => Promise<void>; clear: () => void };
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            onResult(decodedText);
          },
          () => {},
        );
      } catch (e) {
        setError((e as Error).message || "Tidak dapat mengakses kamera");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
        scannerRef.current = null;
      }
    };
  }, [onResult, paused]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black/90">
      <div id={id.current} ref={containerRef} className="aspect-square w-full" />
      {error && <div className="bg-destructive/90 px-3 py-2 text-xs text-destructive-foreground">{error}</div>}
    </div>
  );
}
