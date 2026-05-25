// QR code render-able + tombol download PNG, dengan logo kabupaten di tengah.
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useSiteBranding, getSiteBranding } from "@/lib/site-settings";

function drawCenterLogo(canvas: HTMLCanvasElement, logoUrl: string): Promise<void> {
  return new Promise((resolve) => {
    if (!logoUrl) return resolve();
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve();
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const s = canvas.width;
      const box = Math.round(s * 0.22);
      const x = Math.round((s - box) / 2);
      const y = Math.round((s - box) / 2);
      const pad = Math.round(box * 0.12);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - pad, y - pad, box + pad * 2, box + pad * 2);
      ctx.drawImage(img, x, y, box, box);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = logoUrl;
  });
}

export function QrImage({ value, size = 256 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const branding = useSiteBranding();
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    QRCode.toCanvas(c, value, { width: size, margin: 1, errorCorrectionLevel: "H" })
      .then(() => drawCenterLogo(c, branding.logo_url))
      .catch(() => {});
  }, [value, size, branding.logo_url]);
  return <canvas ref={canvasRef} className="rounded-md bg-white" />;
}

export async function downloadQrPng(value: string, filename: string, size = 512) {
  try {
    const branding = await getSiteBranding().catch(() => null);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    await QRCode.toCanvas(canvas, value, { width: size, margin: 2, errorCorrectionLevel: "H" });
    if (branding?.logo_url) await drawCenterLogo(canvas, branding.logo_url);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  } catch { /* noop */ }
}
