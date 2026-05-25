import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/site/PageShell";
import { QrScanner } from "@/components/asn/QrScanner";
import { useAuth } from "@/lib/auth-context";
import { submitAbsensi, listAbsensiSelf } from "@/lib/asn.functions";

export const Route = createFileRoute("/asn/absensi")({
  head: () => ({ meta: [{ title: "Absensi ASN — Scan QR" }, { name: "robots", content: "noindex" }] }),
  component: AbsensiPage,
});

type Row = { id: string; tipe: "masuk" | "pulang"; waktu: string; opd: { nama: string; singkatan: string } | null };

function AbsensiPage() {
  const { user, isAsn, profile, loading } = useAuth();
  const [scanned, setScanned] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tipe, setTipe] = useState<"masuk" | "pulang">("masuk");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [requestingGps, setRequestingGps] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Perangkat ini tidak mendukung GPS.");
      return;
    }
    setRequestingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setRequestingGps(false); },
      (err) => {
        setRequestingGps(false);
        setGpsError(err.code === 1 ? "Izin lokasi ditolak. Aktifkan GPS pada peramban Anda untuk absen." : "Gagal mendapatkan lokasi GPS.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => { requestGps(); }, [requestGps]);

  // Watch posisi agar GPS tetap update saat menunggu scan.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsError(null); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => { try { navigator.geolocation.clearWatch(id); } catch { /* noop */ } };
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await listAbsensiSelf();
      setRows((r as { rows: Row[] }).rows);
    } catch (e) {
      console.warn("[absensi] gagal memuat riwayat:", (e as Error).message);
    }
  }, []);

  useEffect(() => { if (user && isAsn) reload(); }, [user, isAsn, reload]);

  // Token dari deep-link /asn/scan/$token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem("kantor_qr_token");
    if (t) { setScanned(t); sessionStorage.removeItem("kantor_qr_token"); }
  }, []);

  function extractToken(text: string): string | null {
    try {
      if (text.startsWith("http")) { const u = new URL(text); const m = u.pathname.match(/\/asn\/scan\/([\w-]+)/); if (m) return m[1]; }
      if (text.startsWith("narman://kantor/")) return text.replace("narman://kantor/", "");
      if (/^[a-f0-9]{16,}$/i.test(text)) return text;
    } catch { /* noop */ }
    return null;
  }

  async function submit(token: string) {
    if (busy) return;
    if (!coords) { toast.error("GPS wajib aktif untuk absen."); requestGps(); return; }
    setBusy(true);
    try {
      await submitAbsensi({ data: { token, tipe, lat: coords.lat, lng: coords.lng, device_info: navigator.userAgent.slice(0, 180) } });
      toast.success(`Absen ${tipe} tercatat`);
      setScanned(null);
      await reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan <Link to="/auth" className="text-primary underline">masuk</Link> sebagai ASN.</div></PageShell>;
  if (!isAsn) return <PageShell><div className="container-page py-10">Halaman ini hanya untuk ASN terdaftar dan terverifikasi.</div></PageShell>;
  if (!profile?.verified_at) return <PageShell><div className="container-page py-10">Akun ASN Anda belum diverifikasi Super Admin.</div></PageShell>;

  const gpsReady = !!coords;

  return (
    <PageShell>
      <section className="container-page py-8">
        <h1 className="font-display text-2xl font-bold">Absensi ASN (QR Kantor)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih tipe absen lalu scan QR yang dipajang di kantor OPD Anda.</p>

        {!gpsReady && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="font-semibold text-destructive">GPS wajib aktif</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{gpsError ?? "Menunggu izin lokasi…"}</p>
            <button onClick={requestGps} disabled={requestingGps} className="mt-2 h-9 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
              {requestingGps ? "Meminta izin…" : "Aktifkan GPS"}
            </button>
          </div>
        )}

        <div className="mt-4 inline-flex rounded-lg border border-border bg-surface p-1">
          {(["masuk", "pulang"] as const).map((t) => (
            <button key={t} onClick={() => setTipe(t)} className={`h-9 px-4 rounded-md text-sm font-semibold ${tipe === t ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t === "masuk" ? "Absen Masuk" : "Absen Pulang"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            {!gpsReady ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Aktifkan GPS terlebih dahulu untuk mulai memindai QR.
              </div>
            ) : !scanned ? (
              <QrScanner onResult={(text) => { const t = extractToken(text); if (t) setScanned(t); else toast.error("QR tidak dikenali"); }} />
            ) : (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-sm">Token terdeteksi. Konfirmasi absen <b>{tipe}</b>?</div>
                <div className="mt-3 flex gap-2">
                  <button disabled={busy} onClick={() => submit(scanned)} className="h-10 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Memproses…" : "Kirim"}</button>
                  <button onClick={() => setScanned(null)} className="h-10 rounded-md border border-border px-4 text-sm">Batal</button>
                </div>
              </div>
            )}
            {coords && <p className="mt-2 text-xs text-muted-foreground">Lokasi: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Riwayat Absensi</h2>
            <div className="mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card">
              {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Belum ada absensi.</div>}
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
                  <div><span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.tipe === "masuk" ? "bg-success/15 text-success" : "bg-accent/20 text-accent"}`}>{r.tipe.toUpperCase()}</span><span className="ml-2 text-muted-foreground">{r.opd?.singkatan ?? ""}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(r.waktu).toLocaleString("id-ID")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
