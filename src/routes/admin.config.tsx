// Admin: Konfigurasi Sistem (Super Admin)
// - Verifikasi akun oleh Admin Desa (mode badge / block_login / block_permohonan)
// - Toggle Direktori OPD di Beranda
// - Mode akses menu Data Terpadu & Kinerja OPD (publik / perlu login)
// - Manajemen konten Data Terpadu (CRUD, dipindah dari /admin/data-terpadu)
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck, Eye, Globe, Lock, BarChart3 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { setSiteToggle } from "@/lib/admin-actions.functions";
import { getVerificationConfig, setVerificationConfig } from "@/lib/verification.functions";
import { getShowOpdDirectory } from "@/lib/site-settings";
import { getAccessMode, setAccessMode, type AccessMode, type AccessSettingKey } from "@/lib/access-mode";
import { DataTerpaduManager } from "@/components/admin/DataTerpaduManager";

export const Route = createFileRoute("/admin/config")({
  head: () => ({ meta: [{ title: "Konfigurasi Sistem — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <ConfigPage />
    </AdminGuard>
  ),
});

function ConfigPage() {
  const { isSuperAdmin } = useAuth();
  const [verif, setVerif] = useState<{ enabled: boolean; mode: "block_login" | "block_permohonan" | "badge_only" }>({ enabled: false, mode: "badge_only" });
  const [savingVerif, setSavingVerif] = useState(false);
  const [showOpdDir, setShowOpdDir] = useState(true);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  async function load() {
    try { setVerif(await getVerificationConfig()); } catch { /* ignore */ }
    try { setShowOpdDir(await getShowOpdDirectory()); } catch { /* ignore */ }
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function saveVerif(next: typeof verif) {
    setSavingVerif(true);
    try {
      await setVerificationConfig({ data: next });
      setVerif(next);
      toast.success("Pengaturan verifikasi disimpan");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingVerif(false); }
  }

  async function toggleSetting(key: "show_opd_directory", value: boolean) {
    setSavingToggle(key);
    try {
      await setSiteToggle({ data: { key, value: { visible: value } } });
      setShowOpdDir(value);
      toast.success("Pengaturan disimpan");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingToggle(null); }
  }

  if (!isSuperAdmin) return <AdminShell breadcrumb={[{ label: "Konfigurasi" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div></AdminShell>;

  return (
    <AdminShell breadcrumb={[{ label: "Konfigurasi" }]}>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold">Konfigurasi Sistem</h1>
        <p className="text-sm text-muted-foreground">Pengaturan verifikasi akun, akses menu publik, dan manajemen konten Data Terpadu.</p>
      </div>

      {/* Direktori OPD di Beranda */}
      <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Direktori OPD di Beranda</h2>
            <p className="text-sm text-muted-foreground">Tampilkan atau sembunyikan blok "Direktori OPD" pada halaman utama.</p>
            <div className="mt-3 flex items-center gap-3">
              <Switch
                checked={showOpdDir}
                disabled={savingToggle === "show_opd_directory"}
                onCheckedChange={(v) => toggleSetting("show_opd_directory", v)}
              />
              <span className="text-sm font-medium">{showOpdDir ? "Ditampilkan" : "Disembunyikan"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Akses Menu */}
      <AccessModeCard
        settingKey="data_terpadu_visible_public"
        title="Akses Menu Data Terpadu"
        description="Atur siapa yang dapat membuka halaman /data."
      />
      <AccessModeCard
        settingKey="kinerja_opd_visible_public"
        title="Akses Menu Kinerja OPD"
        description="Atur siapa yang dapat membuka halaman /kinerja-opd."
      />

      {/* Verifikasi Akun oleh Admin Desa */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Verifikasi Akun oleh Admin Desa</h2>
            <p className="text-sm text-muted-foreground">
              Aktifkan verifikasi warga via QR / kode oleh Admin Desa. Pilih bagaimana akun yang belum diverifikasi diperlakukan.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Switch
                checked={verif.enabled}
                disabled={savingVerif}
                onCheckedChange={(v) => saveVerif({ ...verif, enabled: v })}
              />
              <span className="text-sm font-medium">{verif.enabled ? "Aktif" : "Nonaktif"}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                { v: "badge_only", label: "Hanya Badge", desc: "Tampilkan badge belum/terverifikasi tanpa membatasi." },
                { v: "block_permohonan", label: "Blokir Permohonan", desc: "Warga tidak bisa mengajukan permohonan sebelum verifikasi." },
                { v: "block_login", label: "Blokir Login", desc: "Warga otomatis di-logout sebelum verifikasi." },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  disabled={!verif.enabled || savingVerif}
                  onClick={() => saveVerif({ ...verif, mode: opt.v })}
                  className={`rounded-md border p-3 text-left text-xs transition ${verif.mode === opt.v ? "border-primary bg-primary-soft" : "border-border hover:bg-muted"} disabled:opacity-50`}
                >
                  <div className="font-semibold text-foreground">{opt.label}</div>
                  <div className="mt-0.5 text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Manajemen Konten Data Terpadu */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Manajemen Konten Data Terpadu</h2>
            <p className="text-sm text-muted-foreground">Kelola semua konten (KPI, chart, dataset) yang tampil di halaman publik <code>/data</code>.</p>
          </div>
        </div>
        <DataTerpaduManager />
      </div>
    </AdminShell>
  );
}

function AccessModeCard({
  settingKey, title, description,
}: { settingKey: AccessSettingKey; title: string; description: string }) {
  const [mode, setMode] = useState<AccessMode | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAccessMode(settingKey).then(setMode).catch(() => setMode("public"));
  }, [settingKey]);

  async function change(next: AccessMode) {
    if (mode === next) return;
    setSaving(true);
    try {
      await setAccessMode(settingKey, next);
      setMode(next);
      toast.success(next === "public" ? "Diatur: dapat diakses publik tanpa login" : "Diatur: pengunjung wajib login");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
          {mode === "auth" ? <Lock className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([
              { v: "public", label: "Publik tanpa login", desc: "Semua pengunjung dapat mengakses halaman ini.", Icon: Globe },
              { v: "auth", label: "Perlu login", desc: "Pengunjung anonim diarahkan ke halaman masuk dengan pemberitahuan.", Icon: Lock },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                disabled={saving || mode === null}
                onClick={() => change(opt.v)}
                className={`flex items-start gap-2 rounded-md border p-3 text-left text-xs transition ${mode === opt.v ? "border-primary bg-primary-soft" : "border-border hover:bg-muted"} disabled:opacity-50`}
              >
                <opt.Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold text-foreground">{opt.label}</div>
                  <div className="mt-0.5 text-muted-foreground">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
