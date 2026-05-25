/**
 * Memecah teks persyaratan menjadi daftar berkas yang harus diunggah.
 * Mendukung format umum: bullet (-, *, •), penomoran (1., 1)),
 * baris baru, atau pemisah titik koma. Baris kosong dilewati.
 */
export function parsePersyaratan(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n|;/g)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .trim(),
    )
    .filter((s) => s.length > 0);
}
