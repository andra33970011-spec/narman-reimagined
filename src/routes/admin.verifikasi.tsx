// Verifikasi Akun
// - Super Admin: verifikasi Admin OPD & Admin Desa (no QR scan).
// - Admin Desa : scan QR / kode warga di desanya, lalu verifikasi.
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CheckCircle2, Loader2, ScanLine, X, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import {
  lookupVerificationToken,
  verifyWargaByToken,
  listWargaSedesa,
  listPendingStaff,
  adminUpdateWarga,
  adminDeleteWarga,
} from "@/lib/verification.functions";
import { setUserVerified } from "@/lib/admin-actions.functions";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/verifikasi")({
  head: () => ({ meta: [{ title: "Verifikasi Akun — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <VerifikasiPage />
    </AdminGuard>
  ),
});

type Profile = {
  id: string;
  nama_lengkap: string | null;
  nik: string | null;
  no_hp: string | null;
  desa: string | null;
  email?: string;
  verified_at: string | null;
};

type StaffRow = {
  id: string;
  email: string;
  nama_lengkap: string | null;
  role: "admin_opd" | "admin_desa" | "asn";
  desa: string | null;
  opd_id: string | null;
  opd_nama: string | null;
  nip: string | null;
  jabatan: string | null;
  verified_at: string | null;
};

function VerifikasiPage() {
  const { isAdminDesa, isSuperAdmin, profile } = useAuth();
  const allowed = isAdminDesa || isSuperAdmin;

  if (!allowed) {
    return (
      <AdminShell breadcrumb={[{ label: "Verifikasi Akun" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Hanya Super Admin atau Admin Desa.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Verifikasi Akun" }]}>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold">Verifikasi Akun</h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Verifikasi akun Admin OPD dan Admin Desa."
            : <>Scan QR / masukkan kode dari aplikasi warga di desa Anda.{profile?.desa && <span className="ml-1 rounded bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Desa: {profile.desa}</span>}</>}
        </p>
      </div>

      {isSuperAdmin ? <SuperAdminPanel /> : <AdminDesaPanel />}
    </AdminShell>
  );
}

// ============= SUPER ADMIN =============
function SuperAdminPanel() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await listPendingStaff();
      setRows(r.rows as StaffRow[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(row: StaffRow) {
    const verify = !row.verified_at;
    if (!confirm(verify ? `Verifikasi ${row.email} sebagai ${row.role}?` : `Cabut verifikasi ${row.email}?`)) return;
    setBusyId(row.id);
    try {
      await setUserVerified({ data: { user_id: row.id, verified: verify } });
      toast.success(verify ? "Akun diverifikasi" : "Verifikasi dicabut");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  const filtered = rows.filter((r) =>
    !filter.trim() ||
    (r.nama_lengkap ?? "").toLowerCase().includes(filter.toLowerCase()) ||
    r.email.toLowerCase().includes(filter.toLowerCase()) ||
    (r.desa ?? "").toLowerCase().includes(filter.toLowerCase()),
  );
  const opd = filtered.filter((r) => r.role === "admin_opd");
  const desa = filtered.filter((r) => r.role === "admin_desa");
  const asn = filtered.filter((r) => r.role === "asn");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Admin OPD, Admin Desa, & ASN</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari nama / email / desa…"
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        {loading && <div className="py-8 text-center text-sm text-muted-foreground">Memuat…</div>}
        {!loading && (
          <div className="mt-4 space-y-6">
            <StaffTable title="Admin OPD" rows={opd} busyId={busyId} onToggle={toggle} />
            <StaffTable title="Admin Desa" rows={desa} busyId={busyId} onToggle={toggle} />
            <StaffTable title="ASN" rows={asn} busyId={busyId} onToggle={toggle} />
          </div>
        )}
      </div>
    </div>
  );
}

function StaffTable({
  title, rows, busyId, onToggle,
}: { title: string; rows: StaffRow[]; busyId: string | null; onToggle: (r: StaffRow) => void }) {
  const secondCol = title === "Admin Desa" ? "Desa" : "OPD / Instansi";
  return (
    <div>
      <h3 className="mb-2 font-semibold text-sm">{title} <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{rows.length}</span></h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Akun</th>
              <th className="px-3 py-2 font-medium">{secondCol}</th>
              {title === "ASN" && <th className="px-3 py-2 font-medium">NIP / Jabatan</th>}
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={title === "ASN" ? 5 : 4} className="px-3 py-6 text-center text-xs text-muted-foreground">Tidak ada akun.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.nama_lengkap || "(tanpa nama)"}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="px-3 py-2 text-xs">{title === "Admin Desa" ? (r.desa ?? "—") : (r.opd_nama ?? r.opd_id ?? "—")}</td>
                {title === "ASN" && (
                  <td className="px-3 py-2 text-xs">
                    <div className="font-mono">{r.nip ?? "—"}</div>
                    <div className="text-muted-foreground">{r.jabatan ?? "—"}</div>
                  </td>
                )}
                <td className="px-3 py-2">
                  {r.verified_at ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"><ShieldCheck className="h-3 w-3" /> Terverifikasi</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"><ShieldOff className="h-3 w-3" /> Belum verif</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onToggle(r)}
                    disabled={busyId === r.id}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${r.verified_at ? "border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" : "border-primary/40 text-primary hover:bg-primary/10"} disabled:opacity-50`}
                  >
                    {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : r.verified_at ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {r.verified_at ? "Cabut" : "Verifikasi"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= ADMIN DESA =============
function AdminDesaPanel() {
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState("");
  const [data, setData] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Profile[]>([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function loadList() {
    try {
      const r = await listWargaSedesa();
      setList(r.rows as Profile[]);
    } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => { loadList(); }, []);

  async function startScan() {
    setScanning(true);
    setTimeout(async () => {
      try {
        const el = document.getElementById("qr-reader");
        if (!el) return;
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          async (decoded) => {
            await stopScan();
            await handleToken(decoded.trim());
          },
          () => {},
        );
      } catch (e) {
        toast.error("Tidak bisa mengakses kamera: " + (e as Error).message);
        setScanning(false);
      }
    }, 50);
  }

  async function stopScan() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch { /* ignore */ }
    setScanning(false);
  }

  useEffect(() => () => { stopScan(); }, []);

  async function handleToken(t: string) {
    if (!/^[a-f0-9]{8,64}$/i.test(t)) {
      toast.error("Format token tidak valid");
      return;
    }
    setToken(t);
    setBusy(true);
    try {
      const r = await lookupVerificationToken({ data: { token: t } });
      setData(r.profile as Profile);
      if (r.already_verified) toast.info("Warga ini sudah terverifikasi");
    } catch (e) {
      toast.error((e as Error).message);
      setData(null);
    } finally { setBusy(false); }
  }

  async function doVerify() {
    if (!token) return;
    setBusy(true);
    try {
      await verifyWargaByToken({ data: { token } });
      toast.success("Akun warga berhasil diverifikasi");
      setData(null); setToken(""); loadList();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const filtered = list.filter((p) =>
    !filter.trim() ||
    (p.nama_lengkap ?? "").toLowerCase().includes(filter.toLowerCase()) ||
    (p.nik ?? "").includes(filter),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scanner QR</h2>
        {!scanning && !data && (
          <div className="mt-4 grid gap-3">
            <button onClick={startScan} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-primary text-sm font-semibold text-primary-foreground">
              <Camera className="h-4 w-4" /> Mulai Scan Kamera
            </button>
            <div className="text-xs text-muted-foreground">atau masukkan token manual</div>
            <div className="flex gap-2">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="token verifikasi..."
                className="h-10 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs"
              />
              <button onClick={() => handleToken(token)} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Cari
              </button>
            </div>
          </div>
        )}
        {scanning && (
          <div className="mt-4">
            <div id="qr-reader" className="overflow-hidden rounded-md" />
            <button onClick={stopScan} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs">
              <X className="h-3.5 w-3.5" /> Berhenti scan
            </button>
          </div>
        )}
        {data && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data Warga</div>
              <Row label="Nama" value={data.nama_lengkap ?? "—"} />
              <Row label="NIK" value={data.nik ?? "—"} />
              <Row label="No. HP" value={data.no_hp ?? "—"} />
              <Row label="Desa" value={data.desa ?? "—"} />
              <Row label="Email" value={data.email ?? "—"} />
              {data.verified_at && (
                <div className="mt-2 rounded bg-success/10 px-2 py-1 text-xs text-success">
                  Sudah diverifikasi pada {new Date(data.verified_at).toLocaleString("id-ID")}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setData(null); setToken(""); }} className="h-10 rounded-md border border-border px-3 text-sm">Batal</button>
              <button onClick={doVerify} disabled={busy || !!data.verified_at} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-success text-sm font-semibold text-success-foreground disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verifikasi Akun
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Warga di Desa Anda</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.filter((p) => p.verified_at).length} / {filtered.length} terverifikasi
          </span>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cari nama / NIK…"
          className="mt-3 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        <div className="mt-3 max-h-[480px] overflow-y-auto divide-y divide-border">
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Belum ada warga terdaftar di desa Anda.</div>}
          {filtered.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{w.nama_lengkap || "(tanpa nama)"}</div>
                <div className="truncate text-xs text-muted-foreground">NIK: {w.nik ?? "—"} · HP: {w.no_hp ?? "—"}</div>
              </div>
              {w.verified_at ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"><CheckCircle2 className="h-3 w-3" /> Verified</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Belum verif</span>
              )}
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(w)} title="Edit data warga"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleting(w)} title="Hapus akun warga"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <EditWargaModal
          warga={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadList(); }}
        />
      )}
      {deleting && (
        <DeleteWargaModal
          warga={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); loadList(); }}
        />
      )}
    </div>
  );
}

function EditWargaModal({ warga, onClose, onSaved }: { warga: Profile; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nama_lengkap: warga.nama_lengkap ?? "",
    nik: warga.nik ?? "",
    no_hp: warga.no_hp ?? "",
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (form.nama_lengkap.trim().length < 1) { toast.error("Nama wajib"); return; }
    if (form.nik && !/^\d{16}$/.test(form.nik.trim())) { toast.error("NIK harus 16 digit"); return; }
    setBusy(true);
    try {
      await adminUpdateWarga({ data: {
        user_id: warga.id,
        nama_lengkap: form.nama_lengkap.trim(),
        nik: form.nik.trim() || null,
        no_hp: form.no_hp.trim() || null,
      }});
      toast.success("Data warga diperbarui");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Edit Data Warga</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nama Lengkap</label>
            <input value={form.nama_lengkap} onChange={(e) => setForm((f) => ({ ...f, nama_lengkap: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">NIK (16 digit)</label>
            <input value={form.nik} inputMode="numeric" maxLength={16}
              onChange={(e) => setForm((f) => ({ ...f, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">No. HP</label>
            <input value={form.no_hp} onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
          </div>
          <div className="rounded-md border border-border bg-surface p-2 text-[11px] text-muted-foreground">
            Untuk pindah desa, hapus akun warga lalu minta yang bersangkutan mendaftar ulang dengan desa baru.
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
          <button onClick={save} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteWargaModal({ warga, onClose, onDeleted }: { warga: Profile; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function doDelete() {
    if (reason.trim().length < 5) { toast.error("Alasan wajib diisi (min 5 karakter)"); return; }
    if (!confirm(`Hapus permanen akun ${warga.nama_lengkap || warga.id}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusy(true);
    try {
      await adminDeleteWarga({ data: { user_id: warga.id, reason: reason.trim() } });
      toast.success("Akun warga dihapus");
      onDeleted();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-destructive">Hapus Akun Warga</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Akun <b>{warga.nama_lengkap || "(tanpa nama)"}</b> (NIK: {warga.nik ?? "—"}) akan dihapus permanen, termasuk login dan profil. Gunakan untuk kasus pindah desa atau pendaftaran ganda.
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Alasan Penghapusan (wajib)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
              placeholder="Contoh: Warga pindah ke Desa X."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
          <button onClick={doDelete} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
