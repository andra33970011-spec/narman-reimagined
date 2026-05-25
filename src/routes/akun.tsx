// Halaman akun warga: tampilkan QR code verifikasi, status verifikasi, dan edit profil (termasuk desa).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, AlertTriangle, RefreshCw, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyVerificationToken, getMyVerificationDetail } from "@/lib/verification.functions";

export const Route = createFileRoute("/akun")({
  head: () => ({ meta: [{ title: "Akun Saya — Portal Buton Selatan" }, { name: "robots", content: "noindex" }] }),
  component: AkunPage,
});

type DesaRow = { id: string; nama: string };
type Verifier = { id: string; nama_lengkap: string | null; email: string; role: string | null };

function AkunPage() {
  const { user, profile, loading, isVerified, refreshProfile } = useAuth();
  const [token, setToken] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [desaList, setDesaList] = useState<DesaRow[]>([]);
  const [form, setForm] = useState({ nama_lengkap: "", nik: "", no_hp: "", desa: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [verDetail, setVerDetail] = useState<{ verified_at: string | null; verifier: Verifier | null } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function loadToken() {
    if (!user) return;
    setBusy(true);
    try {
      const r = await getMyVerificationToken();
      setToken(r.token);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Refresh profile pada mount, polling 10s, dan saat tab kembali fokus.
  useEffect(() => {
    if (!user) return;
    refreshProfile();
    const t = setInterval(() => { refreshProfile(); }, isVerified ? 30000 : 10000);
    const onFocus = () => { refreshProfile(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isVerified]);

  // Detail verifikasi (siapa & kapan)
  useEffect(() => {
    if (!user || !isVerified) { setVerDetail(null); return; }
    getMyVerificationDetail().then((r) => setVerDetail(r as { verified_at: string | null; verifier: Verifier | null })).catch(() => {});
  }, [user, isVerified, profile?.verified_at]);

  useEffect(() => {
    supabase.from("desa").select("id,nama").eq("aktif", true).order("nama").then(({ data }) => {
      setDesaList((data ?? []) as DesaRow[]);
    });
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        nama_lengkap: profile.nama_lengkap ?? "",
        nik: profile.nik ?? "",
        no_hp: profile.no_hp ?? "",
        desa: profile.desa ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user && !isVerified) loadToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isVerified]);

  useEffect(() => {
    if (!token || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, token, { width: 260, margin: 2, errorCorrectionLevel: "M" }).catch(() => {});
  }, [token]);

  function downloadQR() {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qr-verifikasi-${profile?.nama_lengkap ?? "warga"}.png`;
    a.click();
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nama_lengkap: form.nama_lengkap.trim(),
          nik: form.nik.trim() || null,
          no_hp: form.no_hp.trim() || null,
          desa: form.desa.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profil tersimpan");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) return <PageShell><div className="container-page py-16 text-center text-muted-foreground">Memuat…</div></PageShell>;
  if (!user) {
    return (
      <PageShell>
        <div className="container-page py-16 text-center">
          <p className="mb-4 text-muted-foreground">Silakan masuk untuk melihat akun Anda.</p>
          <Link to="/auth" className="inline-flex h-10 items-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground">Masuk</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero eyebrow="Akun Saya" title="Profil & Verifikasi" description="Perbarui data diri Anda dan tunjukkan QR code kepada Admin Desa untuk verifikasi." />
      <section className="container-page py-10">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Data Akun</h2>
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Belum verifikasi
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="mt-1 text-sm font-medium text-foreground">{user.email}</div>
              </div>
              {isVerified && (
                <div className="rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
                  Akun Anda telah diverifikasi. Nama, NIK, No. HP, dan Desa terkunci. Untuk perubahan data atau pindah desa, silakan hubungi Admin Desa.
                </div>
              )}
              <Field label="Nama Lengkap">
                <input value={form.nama_lengkap} disabled={isVerified}
                  onChange={(e) => setForm((f) => ({ ...f, nama_lengkap: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
              </Field>
              <Field label="NIK">
                <input value={form.nik} disabled={isVerified}
                  onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))}
                  inputMode="numeric" maxLength={16}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono disabled:cursor-not-allowed disabled:opacity-60" />
              </Field>
              <Field label="No. HP">
                <input value={form.no_hp} disabled={isVerified}
                  onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
              </Field>
              <Field label="Desa">
                <select value={form.desa} disabled={isVerified}
                  onChange={(e) => setForm((f) => ({ ...f, desa: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                  <option value="">— Pilih Desa —</option>
                  {desaList.map((d) => <option key={d.id} value={d.nama}>{d.nama}</option>)}
                </select>
              </Field>

              {!isVerified && (
                <button onClick={saveProfile} disabled={savingProfile}
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <Save className="h-4 w-4" /> {savingProfile ? "Menyimpan…" : "Simpan Profil"}
                </button>
              )}

              {!isVerified && !form.desa && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                  Pilih desa Anda agar Admin Desa dapat melakukan verifikasi.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold">QR Code Verifikasi</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tunjukkan ke Admin Desa untuk discan. Token sekali pakai, berlaku 30 hari.</p>
            <div className="mt-5 grid place-items-center">
              {isVerified ? (
                <div className="w-full rounded-lg border border-dashed border-success/40 bg-success/5 p-6 text-sm text-success">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5" /> Akun Anda sudah terverifikasi
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-foreground">
                    <div>
                      <span className="text-muted-foreground">Waktu verifikasi: </span>
                      <span className="font-medium">
                        {verDetail?.verified_at
                          ? new Date(verDetail.verified_at).toLocaleString("id-ID")
                          : profile?.verified_at
                            ? new Date(profile.verified_at).toLocaleString("id-ID")
                            : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Diverifikasi oleh: </span>
                      <span className="font-medium">
                        {verDetail?.verifier
                          ? `${verDetail.verifier.nama_lengkap || verDetail.verifier.email || "—"}${verDetail.verifier.role ? ` (${verDetail.verifier.role})` : ""}`
                          : "Sistem / Super Admin"}
                      </span>
                    </div>
                    {verDetail?.verifier?.email && verDetail.verifier.nama_lengkap && (
                      <div className="text-[11px] text-muted-foreground">{verDetail.verifier.email}</div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <canvas ref={canvasRef} className="rounded-md border border-border bg-white p-2" />
                  <div className="mt-4 flex gap-2">
                    <button onClick={loadToken} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted">
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Muat ulang
                    </button>
                    <button onClick={downloadQR} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
                      <Download className="h-3.5 w-3.5" /> Unduh QR
                    </button>
                  </div>
                  <button onClick={() => { refreshProfile(); }} className="mt-3 text-xs text-muted-foreground hover:text-primary">
                    Cek status lagi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
