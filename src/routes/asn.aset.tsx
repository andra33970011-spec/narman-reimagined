import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Camera, RotateCcw, X } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { QrScanner } from "@/components/asn/QrScanner";
import { useAuth } from "@/lib/auth-context";
import { resolveAsetByKode, scanAset, listAset } from "@/lib/aset.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/asn/aset")({
  head: () => ({ meta: [{ title: "Tracking Aset — Scan QR" }, { name: "robots", content: "noindex" }] }),
  component: AsetPage,
});

type Aset = {
  id: string; kode: string; nama: string; kategori: string;
  lokasi_terkini: string | null; status: string;
  opd: { nama: string; singkatan: string } | null;
  pemegang: { nama_lengkap: string } | null;
};

const PHOTO_DEADLINE_SEC = 60;

function AsetPage() {
  const { user, loading } = useAuth();
  const [scanned, setScanned] = useState<Aset | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [requestingGps, setRequestingGps] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [lokasiText, setLokasiText] = useState("");
  const [mine, setMine] = useState<Aset[]>([]);
  // Photo capture state
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null); // epoch ms
  const [tick, setTick] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Perangkat ini tidak mendukung GPS.");
      return;
    }
    setRequestingGps(true); setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setRequestingGps(false); },
      (err) => {
        setRequestingGps(false);
        setGpsError(err.code === 1 ? "Izin lokasi ditolak. Aktifkan GPS pada peramban Anda." : "Gagal mendapatkan lokasi GPS.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);
  useEffect(() => { requestGps(); }, [requestGps]);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsError(null); },
      () => {}, { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => { try { navigator.geolocation.clearWatch(id); } catch { /* noop */ } };
  }, []);

  // Countdown timer when photo deadline active
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);

  const reloadMine = useCallback(async () => {
    try { const r = await listAset({ data: { mine: true } }); setMine((r as { rows: Aset[] }).rows); }
    catch (e) { console.warn("[aset]", (e as Error).message); }
  }, []);
  useEffect(() => { if (user) reloadMine(); }, [user, reloadMine]);

  function extractKode(text: string): string | null {
    try { if (text.startsWith("http")) { const u = new URL(text); const k = u.searchParams.get("kode"); if (k) return k; } } catch { /* noop */ }
    if (/^AST-[A-Z0-9-]+$/i.test(text)) return text.toUpperCase();
    return text.trim() || null;
  }

  function resetCapture() {
    setScanned(null); setPhotoBlob(null); setPhotoPreview(null); setDeadline(null);
    setCatatan(""); setLokasiText("");
  }

  async function onScan(text: string) {
    const k = extractKode(text); if (!k) { toast.error("QR tidak dikenali"); return; }
    try {
      const a = await resolveAsetByKode({ data: { kode: k } });
      setScanned(a as Aset);
      // Start 60s deadline to capture photo
      setDeadline(Date.now() + PHOTO_DEADLINE_SEC * 1000);
      setPhotoBlob(null); setPhotoPreview(null);
      toast.success("QR diverifikasi. Silakan foto fisik aset dalam 60 detik.");
    } catch (e) { toast.error((e as Error).message); }
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!file) return;
    // Camera-only: file should originate from capture. We reject if no `lastModified` close to now or if not image.
    if (!file.type.startsWith("image/")) { toast.error("File bukan gambar"); return; }
    const ageSec = (Date.now() - file.lastModified) / 1000;
    if (ageSec > 120) {
      toast.error("Foto harus diambil langsung dari kamera, bukan dari galeri.");
      return;
    }
    setPhotoBlob(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submitScan() {
    if (!scanned) return;
    if (!coords) { toast.error("GPS wajib aktif."); requestGps(); return; }
    if (!deadline || Date.now() > deadline) { toast.error("Waktu 60 detik habis. Scan ulang QR aset."); return; }
    if (!photoBlob) { toast.error("Wajib mengambil foto fisik aset dari kamera."); return; }

    setBusy(true);
    try {
      // Upload photo
      const ext = (photoBlob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${user!.id}/${scanned.kode}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("aset-foto").upload(path, photoBlob, { contentType: photoBlob.type, upsert: false });
      if (upErr) throw new Error(`Gagal unggah foto: ${upErr.message}`);
      const { data: signed } = await supabase.storage.from("aset-foto").createSignedUrl(path, 60 * 60 * 24 * 365);
      const foto_url = signed?.signedUrl ?? null;

      await scanAset({ data: { kode: scanned.kode, lat: coords.lat, lng: coords.lng, lokasi_text: lokasiText || null, catatan: catatan || null, foto_url } });
      toast.success("Scan tersimpan beserta foto kondisi");
      resetCapture();
      await reloadMine();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan <Link to="/auth" className="text-primary underline">masuk</Link> untuk scan aset.</div></PageShell>;

  const gpsReady = !!coords;
  const remainingMs = deadline ? Math.max(0, deadline - Date.now()) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const expired = !!deadline && remainingMs <= 0;
  void tick;

  return (
    <PageShell>
      <section className="container-page py-8">
        <h1 className="font-display text-2xl font-bold">Tracking Aset Pemda</h1>
        <p className="mt-1 text-sm text-muted-foreground">Scan QR aset → ambil foto fisik dalam 60 detik (hanya kamera langsung) → kirim.</p>

        {!gpsReady && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="font-semibold text-destructive">GPS wajib aktif</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{gpsError ?? "Menunggu izin lokasi…"}</p>
            <button onClick={requestGps} disabled={requestingGps} className="mt-2 h-9 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
              {requestingGps ? "Meminta izin…" : "Aktifkan GPS"}
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            {!gpsReady ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Aktifkan GPS terlebih dahulu.
              </div>
            ) : !scanned ? (
              <QrScanner onResult={onScan} />
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Aset Terverifikasi</div>
                    <div className="font-display text-lg font-bold">{scanned.nama}</div>
                    <div className="text-xs text-muted-foreground">{scanned.kode} · {scanned.kategori} · {scanned.status}</div>
                    <div className="text-xs text-muted-foreground">OPD: {scanned.opd?.nama ?? "-"}</div>
                  </div>
                  <button onClick={resetCapture} className="rounded-md border border-border p-1.5"><X className="h-4 w-4" /></button>
                </div>

                {/* Countdown */}
                <div className={`rounded-md p-3 text-sm ${expired ? "bg-destructive/15 text-destructive" : remainingSec <= 15 ? "bg-gold/20" : "bg-primary-soft text-primary"}`}>
                  {expired ? (
                    <div>
                      <div className="font-semibold">Waktu habis.</div>
                      <p className="text-xs">Foto fisik aset harus diambil dalam 60 detik setelah QR diverifikasi. Silakan scan ulang QR.</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Sisa waktu: {remainingSec}s</span>
                      <span className="text-xs opacity-80">Foto wajib langsung dari kamera</span>
                    </div>
                  )}
                </div>

                {!expired && (
                  <>
                    {!photoPreview ? (
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface py-8 text-sm font-semibold hover:bg-muted"
                      >
                        <Camera className="h-5 w-5" /> Buka Kamera & Foto Aset
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <img src={photoPreview} alt="Foto aset" className="w-full max-h-64 rounded-md object-contain border border-border bg-black/5" />
                        <button onClick={() => { setPhotoBlob(null); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs">
                          <RotateCcw className="h-3 w-3" /> Foto ulang
                        </button>
                      </div>
                    )}
                    {/* capture attribute restricts to camera on mobile */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={onPickPhoto}
                    />

                    <input value={lokasiText} onChange={(e) => setLokasiText(e.target.value)} placeholder="Deskripsi lokasi (opsional)" className="input h-9" />
                    <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan kondisi (opsional)" className="input min-h-20" />
                    {coords && <p className="text-xs text-muted-foreground">GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
                    <div className="flex gap-2">
                      <button disabled={busy || !photoBlob} onClick={submitScan} className="h-10 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan Scan"}</button>
                      <button onClick={resetCapture} className="h-10 rounded-md border border-border px-4 text-sm">Batal</button>
                    </div>
                  </>
                )}
                {expired && (
                  <button onClick={resetCapture} className="h-10 w-full rounded-md bg-gradient-primary text-sm font-semibold text-primary-foreground">Scan Ulang QR</button>
                )}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Aset yang Anda Pegang</h2>
            <div className="mt-2 space-y-2">
              {mine.length === 0 && <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada aset yang ditugaskan kepada Anda.</div>}
              {mine.map((a) => (
                <div key={a.id} className="rounded-md border border-border bg-card p-3 text-sm">
                  <div className="font-semibold">{a.nama}</div>
                  <div className="text-xs text-muted-foreground">{a.kode} · {a.kategori} · {a.status}</div>
                  {a.lokasi_terkini && <div className="text-xs text-muted-foreground">📍 {a.lokasi_terkini}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
