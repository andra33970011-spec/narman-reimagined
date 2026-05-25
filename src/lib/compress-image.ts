// Kompresi gambar progresif sampai ≤ targetBytes, mempertahankan kualitas.
// Mendukung JPG/PNG/WebP. PDF/dokumen lain dilewati.
export async function compressImage(file: File, targetBytes: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= targetBytes) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const mime = file.type === "image/png" ? "image/jpeg" : file.type; // PNG → JPG agar kompres efektif
  let { width, height } = bitmap;
  // Batas dimensi awal supaya tidak boros memori
  const maxDim = 3200;
  if (Math.max(width, height) > maxDim) {
    const s = maxDim / Math.max(width, height);
    width = Math.round(width * s);
    height = Math.round(height * s);
  }

  const qualities = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4];
  for (const q of qualities) {
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      const w = Math.max(320, Math.round(width * scale));
      const h = Math.max(320, Math.round(height * scale));
      const canvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(w, h)
          : Object.assign(document.createElement("canvas"), { width: w, height: h });
      const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(bitmap, 0, 0, w, h);
      let blob: Blob;
      if (canvas instanceof HTMLCanvasElement) {
        blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), mime, q));
      } else {
        blob = await (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality: q });
      }
      if (blob && blob.size <= targetBytes) {
        const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
        const base = file.name.replace(/\.[^.]+$/, "");
        return new File([blob], `${base}.${ext}`, { type: mime });
      }
    }
  }
  return file; // fallback ke file asli kalau gagal mencapai target
}
