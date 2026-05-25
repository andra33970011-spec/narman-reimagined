// Backup & disaster recovery — Super Admin.
// Satu tombol untuk backup semua tabel sekaligus (file JSON gabungan)
// dan fitur upload restore yang mendistribusikan kembali datanya per tabel.
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Database, AlertTriangle, Upload, CheckCircle2, Cloud, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import { exportTable, enqueueJob, importBackup, createSnapshot, listSnapshots, getSnapshot, restoreSnapshot, deleteSnapshot } from "@/lib/admin-actions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Clock, History, RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/backup")({
  head: () => ({ meta: [{ title: "Backup Data — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <BackupPage />
    </AdminGuard>
  ),
});

const TABLES = [
  "profiles",
  "user_roles",
  "opd",
  "kategori_layanan",
  "layanan_publik",
  "berita",
  "permohonan",
  "permohonan_riwayat",
  "audit_log",
  "job_queue",
] as const;

type TableId = (typeof TABLES)[number];

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type BackupFile = {
  version: 1;
  exported_at: string;
  tables: Record<string, Record<string, unknown>[]>;
};

function BackupPage() {
  const { isSuperAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [lastReport, setLastReport] = useState<Record<string, { inserted: number; error?: string }> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackupAll() {
    setExporting(true);
    setProgress({ done: 0, total: TABLES.length, current: TABLES[0] });
    try {
      const tables: Record<string, Record<string, unknown>[]> = {};
      let totalRows = 0;
      for (let i = 0; i < TABLES.length; i++) {
        const t = TABLES[i];
        setProgress({ done: i, total: TABLES.length, current: t });
        const res = await exportTable({ data: { tabel: t } });
        tables[t] = res.rows as Record<string, unknown>[];
        totalRows += res.rows.length;
      }
      const payload: BackupFile = {
        version: 1,
        exported_at: new Date().toISOString(),
        tables,
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      download(`backup-lengkap_${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
      toast.success(`Backup selesai: ${totalRows} baris dari ${TABLES.length} tabel`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }

  async function handleRestoreFile(file: File) {
    setImporting(true);
    setLastReport(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupFile>;
      if (!parsed || typeof parsed !== "object" || !parsed.tables) {
        throw new Error("Format file tidak valid (butuh field 'tables').");
      }
      // Hanya kirim tabel yang dikenali untuk menghindari error.
      const filtered: Record<string, Record<string, unknown>[]> = {};
      for (const t of TABLES) {
        if (Array.isArray(parsed.tables[t])) filtered[t] = parsed.tables[t] as Record<string, unknown>[];
      }
      if (Object.keys(filtered).length === 0) throw new Error("Tidak ada tabel yang bisa direstore di dalam file.");

      const res = await importBackup({ data: { tables: filtered } });
      setLastReport(res.summary);
      const errors = Object.values(res.summary).filter((s) => s.error).length;
      if (errors > 0) toast.warning(`Restore selesai dengan ${errors} tabel bermasalah`);
      else toast.success("Restore selesai untuk semua tabel");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runMaintenance(jobType: string) {
    try {
      await enqueueJob({ data: { job_type: jobType, payload: {} } });
      toast.success("Job dijadwalkan, akan dijalankan dalam 1 menit");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Backup" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div>
      </AdminShell>
    );
  }

  const busy = exporting || importing;

  return (
    <AdminShell breadcrumb={[{ label: "Backup Data" }]}>
      <h1 className="mb-1 font-display text-2xl font-bold">Backup &amp; Disaster Recovery</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Unduh seluruh data sebagai satu file JSON, atau unggah file backup untuk mengembalikan data ke tabel masing-masing.
      </p>

      <div className="mb-6 flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-gold-foreground" />
        <div>
          <div className="font-semibold text-foreground">Catatan</div>
          <p className="mt-1 text-muted-foreground">
            Restore dilakukan dengan <strong>upsert berdasarkan ID</strong>: data yang sudah ada akan ditimpa, data baru akan ditambahkan.
            Untuk perlindungan menyeluruh, aktifkan <strong>Point-in-Time Recovery</strong> di pengaturan database.
          </p>
        </div>
      </div>

      {/* BACKUP ALL */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
            <Database className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Backup Seluruh Data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mengekspor {TABLES.length} tabel inti ke dalam satu file JSON yang bisa diunggah kembali kapan saja.
            </p>
            {progress && (
              <p className="mt-2 text-xs text-muted-foreground">
                Memproses <span className="font-mono">{progress.current}</span> ({progress.done}/{progress.total})…
              </p>
            )}
          </div>
          <button
            onClick={handleBackupAll}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Mem-backup…" : "Backup Sekarang"}
          </button>
        </div>
      </div>

      {/* UPLOAD RESTORE */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Upload Backup (Restore)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pilih file backup JSON. Data otomatis didistribusikan ke tabelnya masing-masing mengikuti urutan dependensi.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleRestoreFile(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Mengembalikan…" : "Pilih File Backup"}
          </button>
        </div>

        {lastReport && (
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Tabel</th>
                  <th className="px-3 py-2 text-right">Baris Diproses</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lastReport).map(([tabel, info]) => (
                  <tr key={tabel} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{tabel}</td>
                    <td className="px-3 py-2 text-right">{info.inserted}</td>
                    <td className="px-3 py-2">
                      {info.error ? (
                        <span className="text-destructive">{info.error}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sukses
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MAINTENANCE */}
      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold">Pemeliharaan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Jadwalkan job pembersihan latar belakang.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => runMaintenance("audit.cleanup")} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Bersihkan Audit Log &gt;180 hari
          </button>
          <button onClick={() => runMaintenance("ratelimit.cleanup")} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Bersihkan Rate Limit &gt;1 jam
          </button>
        </div>
      </div>
      <SnapshotPitrCard />
      <AutoBackupCard />
      <GdriveBackupCard />
    </AdminShell>
  );
}

// ============= AUTO BACKUP TERJADWAL (LOKAL + SERVER) =============
type AutoBackupCfg = {
  enabled: boolean;
  retention: number; // jumlah snapshot otomatis disimpan
  auto_local_download: boolean; // saat super admin buka halaman, auto-download snapshot terbaru
  last_local_download: string | null;
};
const DEFAULT_AUTO: AutoBackupCfg = {
  enabled: false, retention: 14, auto_local_download: false, last_local_download: null,
};

function AutoBackupCard() {
  const [cfg, setCfg] = useState<AutoBackupCfg | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_setting").select("value").eq("key", "auto_backup_config").maybeSingle().then(({ data }) => {
      const v = data?.value as Partial<AutoBackupCfg> | null;
      setCfg({ ...DEFAULT_AUTO, ...(v ?? {}) });
    });
  }, []);

  async function save(next: AutoBackupCfg) {
    setSaving(true);
    const { error } = await supabase
      .from("app_setting")
      .upsert({ key: "auto_backup_config", value: next as unknown as never }, { onConflict: "key" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCfg(next);
    toast.success("Pengaturan auto backup disimpan");
  }

  if (!cfg) return null;
  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
          <Clock className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">Auto Backup Terjadwal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot otomatis dibuat oleh cron (default: harian) dan disimpan di tabel <code>backup_snapshot</code>.
            Snapshot ini menjadi dasar Point-in-Time Recovery di kartu di atas.
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-xs text-muted-foreground">{cfg.enabled ? "Aktif" : "Nonaktif"}</span>
          <button
            onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
            disabled={saving}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-50 ${cfg.enabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${cfg.enabled ? "translate-x-8" : "translate-x-1"}`} />
          </button>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground">Retensi (jumlah snapshot otomatis)</label>
          <input
            type="number" min={1} max={90}
            value={cfg.retention}
            onChange={(e) => setCfg({ ...cfg, retention: Math.max(1, Math.min(90, Number(e.target.value) || 14)) })}
            onBlur={() => save(cfg)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.auto_local_download}
              onChange={(e) => save({ ...cfg, auto_local_download: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span>Unduh otomatis ke perangkat saat super admin membuka halaman ini (sekali per hari)</span>
          </label>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Untuk menjadwalkan cron, aktifkan <code>pg_cron</code> &amp; <code>pg_net</code>, lalu panggil endpoint
        <code> /api/public/hooks/backup-snapshot</code> dengan header <code>apikey</code> (anon key).
      </p>
    </div>
  );
}

// ============= SNAPSHOT HISTORY + POINT-IN-TIME RECOVERY =============
type SnapshotRow = {
  id: string;
  created_at: string;
  label: string;
  tipe: string;
  size_bytes: number;
  table_counts: Record<string, number>;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function SnapshotPitrCard() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await listSnapshots();
      setRows(res.snapshots as SnapshotRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // Auto-local download: cek config & download snapshot terbaru sekali per hari
  useEffect(() => {
    if (rows.length === 0) return;
    (async () => {
      const { data } = await supabase.from("app_setting").select("value").eq("key", "auto_backup_config").maybeSingle();
      const cfg = (data?.value ?? {}) as { auto_local_download?: boolean; last_local_download?: string | null };
      if (!cfg.auto_local_download) return;
      const today = new Date().toISOString().slice(0, 10);
      const last = (cfg.last_local_download ?? "").slice(0, 10);
      if (last === today) return;
      const latest = rows[0];
      try {
        const res = await getSnapshot({ data: { id: latest.id } });
        const file = {
          version: 1, exported_at: latest.created_at, snapshot_id: latest.id,
          tables: (res.snapshot.data as { tables?: unknown })?.tables ?? {},
        };
        downloadBlob(
          `snapshot_${latest.created_at.replace(/[:.]/g, "-").slice(0, 19)}.json`,
          JSON.stringify(file, null, 2),
          "application/json",
        );
        await supabase.from("app_setting").upsert(
          { key: "auto_backup_config", value: { ...cfg, last_local_download: new Date().toISOString() } as unknown as never },
          { onConflict: "key" },
        );
      } catch (e) { console.warn("auto-local-download failed", e); }
    })();
  }, [rows]);

  async function handleCreate() {
    setCreating(true);
    try {
      await createSnapshot({ data: { tipe: "manual" } });
      toast.success("Snapshot dibuat");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  }

  async function handleRestore(row: SnapshotRow) {
    if (!confirm(`Restore database ke titik waktu:\n${new Date(row.created_at).toLocaleString("id-ID")}\n\nData saat ini akan ditimpa (upsert per ID). Lanjutkan?`)) return;
    setBusyId(row.id);
    try {
      const res = await restoreSnapshot({ data: { id: row.id } });
      const errors = Object.values(res.summary).filter((s) => s.error).length;
      if (errors > 0) toast.warning(`Restore selesai dengan ${errors} tabel bermasalah`);
      else toast.success(`Database dipulihkan ke ${new Date(res.restored_to).toLocaleString("id-ID")}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleDownload(row: SnapshotRow) {
    setBusyId(row.id);
    try {
      const res = await getSnapshot({ data: { id: row.id } });
      const tables = (res.snapshot.data as { tables?: unknown })?.tables ?? {};
      const file = { version: 1, exported_at: row.created_at, snapshot_id: row.id, tables };
      downloadBlob(
        `snapshot_${row.created_at.replace(/[:.]/g, "-").slice(0, 19)}.json`,
        JSON.stringify(file, null, 2), "application/json",
      );
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleDelete(row: SnapshotRow) {
    if (!confirm(`Hapus snapshot "${row.label}"?`)) return;
    setBusyId(row.id);
    try {
      await deleteSnapshot({ data: { id: row.id } });
      toast.success("Snapshot dihapus");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
          <History className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">Point-in-Time Recovery (Snapshot)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Setiap snapshot menyimpan seluruh tabel inti pada saat tertentu. Pilih titik waktu lalu klik <em>Restore</em> untuk memulihkan database persis pada saat itu.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {creating ? "Membuat…" : "Snapshot Sekarang"}
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Waktu</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Tipe</th>
              <th className="px-3 py-2 text-right">Ukuran</th>
              <th className="px-3 py-2 text-right">Total Baris</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Memuat…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada snapshot. Klik “Snapshot Sekarang” untuk membuat titik pemulihan pertama.</td></tr>
            )}
            {rows.map((r) => {
              const total = Object.values(r.table_counts ?? {}).reduce((a, b) => a + (b as number), 0);
              const busy = busyId === r.id;
              return (
                <tr key={r.id} className="border-t border-border align-top hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tipe === "auto" ? "bg-accent/15 text-accent" : "bg-primary-soft text-primary"}`}>
                      {r.tipe}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{formatBytes(r.size_bytes)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{total.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => handleDownload(r)} disabled={busy}
                        title="Unduh ke perangkat"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRestore(r)} disabled={busy}
                        title="Restore (Point-in-Time)"
                        className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-1 text-xs font-semibold text-gold-foreground border border-gold/30 hover:bg-gold/25 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(r)} disabled={busy}
                        title="Hapus snapshot"
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/15 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type GdriveConfig = {
  enabled: boolean;
  folder_id: string;
  schedule: "daily" | "weekly" | "monthly";
  last_run: string | null;
  last_status: string | null;
  last_file: string | null;
};

const DEFAULT_GDRIVE: GdriveConfig = {
  enabled: false,
  folder_id: "",
  schedule: "daily",
  last_run: null,
  last_status: null,
  last_file: null,
};

function GdriveBackupCard() {
  const [cfg, setCfg] = useState<GdriveConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    supabase.from("app_setting").select("value").eq("key", "gdrive_backup_config").maybeSingle().then(({ data }) => {
      const v = data?.value as Partial<GdriveConfig> | null;
      setCfg({ ...DEFAULT_GDRIVE, ...(v ?? {}) });
    });
  }, []);

  async function save(next: GdriveConfig) {
    setSaving(true);
    const { error } = await supabase
      .from("app_setting")
      .upsert({ key: "gdrive_backup_config", value: next as unknown as never }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCfg(next);
    toast.success("Pengaturan backup Google Drive disimpan");
  }

  if (!cfg) return null;

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
          <Cloud className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">Backup Otomatis ke Google Drive</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur backup terjadwal agar database otomatis disalin ke folder Google Drive Anda. Eksekusi dilakukan oleh worker eksternal (cron) yang membaca pengaturan ini.
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-xs text-muted-foreground">{cfg.enabled ? "Aktif" : "Nonaktif"}</span>
          <button
            onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
            disabled={saving}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-50 ${cfg.enabled ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle"
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${cfg.enabled ? "translate-x-8" : "translate-x-1"}`} />
          </button>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground">Folder ID Google Drive</label>
          <input
            type="text"
            value={cfg.folder_id}
            onChange={(e) => setCfg({ ...cfg, folder_id: e.target.value })}
            onBlur={() => save(cfg)}
            placeholder="contoh: 1AbCDEF...xyz"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Buka folder tujuan di Google Drive → salin bagian setelah <code>/folders/</code> di URL.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground">Frekuensi</label>
          <select
            value={cfg.schedule}
            onChange={(e) => save({ ...cfg, schedule: e.target.value as GdriveConfig["schedule"] })}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="daily">Harian (02:00 WITA)</option>
            <option value="weekly">Mingguan (Minggu 02:00)</option>
            <option value="monthly">Bulanan (Tgl 1, 02:00)</option>
          </select>
        </div>
      </div>

      {cfg.last_run && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs">
          <div><strong>Backup terakhir:</strong> {new Date(cfg.last_run).toLocaleString("id-ID")}</div>
          {cfg.last_status && <div><strong>Status:</strong> {cfg.last_status}</div>}
          {cfg.last_file && <div className="truncate"><strong>File:</strong> {cfg.last_file}</div>}
        </div>
      )}

      <button
        onClick={() => setShowSetup((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <SettingsIcon className="h-3.5 w-3.5" /> {showSetup ? "Sembunyikan" : "Lihat"} panduan setup worker
      </button>

      {showSetup && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-4 text-xs">
          <div className="mb-2 font-semibold">Setup worker backup (jalan di luar Lovable)</div>
          <ol className="ml-4 list-decimal space-y-1.5 text-muted-foreground">
            <li>Aktifkan Google Drive API di Google Cloud Console & buat <strong>Service Account</strong>, unduh file JSON kredensialnya.</li>
            <li>Share folder Google Drive tujuan ke email service account (akses Editor), salin Folder ID ke kolom di atas.</li>
            <li>Simpan kredensial JSON sebagai secret <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> di Cloudflare Workers / GitHub Actions Anda.</li>
            <li>Tambahkan secret Supabase: <code>SUPABASE_URL</code> dan <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
            <li>Buat scheduled job (cron) yang: (a) baca <code>app_setting.gdrive_backup_config</code>, (b) jika <code>enabled=true</code> dan jadwal cocok, dump semua tabel ke JSON, (c) upload ke Drive folder <code>folder_id</code>, (d) update field <code>last_run / last_status / last_file</code>.</li>
            <li>Contoh script siap pakai tersedia di file <code>scripts/gdrive-backup.md</code> di repo (akan dibuat saat anda push ke supabase pribadi).</li>
          </ol>
        </div>
      )}
    </div>
  );
}
