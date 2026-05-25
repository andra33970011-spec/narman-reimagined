// Manajemen User — hanya super admin.
// Fitur: ubah role/OPD, suspend/aktifkan, force logout, kirim reset password.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Save, Search, Ban, CheckCircle2, LogOut, KeyRound, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  setUserRole, listUsers, setUserSuspended, forceSignOut, sendPasswordReset, setUserVerified, deleteUser,
} from "@/lib/admin-actions.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Manajemen User — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <UsersPage />
    </AdminGuard>
  ),
});

type Opd = { id: string; nama: string; singkatan: string };
type AppRoleUI = "warga" | "admin_opd" | "super_admin" | "admin_desa" | "asn";
type Row = {
  id: string; email: string; nama_lengkap: string; nik: string | null; no_hp: string | null;
  opd_id: string | null; status: string; role: AppRoleUI;
  desa: string | null; verified_at: string | null; jabatan: string | null;
  last_sign_in_at: string | null;
  pendingRole?: AppRoleUI; pendingOpd?: string | null; pendingDesa?: string | null;
};

function UsersPage() {
  const { isSuperAdmin, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [opds, setOpds] = useState<Opd[]>([]);
  const [desaList, setDesaList] = useState<{ id: string; nama: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actId, setActId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [wargaDesa, setWargaDesa] = useState<string>("semua");

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const opdResPromise = supabase.from("opd").select("id,nama,singkatan").order("nama");
      const desaResPromise = supabase.from("desa").select("id,nama").eq("aktif", true).order("nama");
      let usersRes: { users: Row[] } = { users: [] };
      try {
        usersRes = (await listUsers()) as { users: Row[] };
      } catch (e) {
        const msg = (e as Error).message || "Gagal memuat daftar user";
        setLoadError(msg);
        toast.error(msg);
      }
      const [opdRes, desaRes] = await Promise.all([opdResPromise, desaResPromise]);
      setRows((usersRes?.users ?? []) as Row[]);
      setOpds((opdRes?.data ?? []) as Opd[]);
      setDesaList((desaRes?.data ?? []) as { id: string; nama: string }[]);
    } catch (e) {
      const msg = (e as Error).message;
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  async function saveRole(row: Row) {
    setActId(row.id);
    try {
      const role = row.pendingRole ?? row.role;
      const opd_id = (role === "admin_opd" || role === "asn") ? (row.pendingOpd ?? row.opd_id ?? null) : null;
      const desa = role === "admin_desa" ? ((row.pendingDesa ?? row.desa ?? "").trim() || null) : null;
      await setUserRole({ data: { user_id: row.id, role, opd_id, desa } });
      toast.success("Role diperbarui"); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }
  async function toggleSuspend(row: Row) {
    if (row.id === user?.id) { toast.error("Tidak dapat menonaktifkan akun sendiri"); return; }
    const suspend = row.status !== "suspended";
    if (!confirm(suspend ? `Suspend akun ${row.email}?` : `Aktifkan kembali ${row.email}?`)) return;
    setActId(row.id);
    try { await setUserSuspended({ data: { user_id: row.id, suspend } }); toast.success("Berhasil"); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }
  async function logout(row: Row) {
    if (!confirm(`Force logout semua sesi ${row.email}?`)) return;
    setActId(row.id);
    try { await forceSignOut({ data: { user_id: row.id } }); toast.success("Sesi diakhiri"); }
    catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }
  async function reset(row: Row) {
    if (!row.email) { toast.error("Email tidak tersedia"); return; }
    setActId(row.id);
    try { await sendPasswordReset({ data: { email: row.email } }); toast.success("Link reset password dikirim"); }
    catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }
  async function toggleVerify(row: Row) {
    const verify = !row.verified_at;
    if (!confirm(verify ? `Verifikasi akun ${row.email} sebagai ${row.role}?` : `Cabut verifikasi akun ${row.email}?`)) return;
    setActId(row.id);
    try { await setUserVerified({ data: { user_id: row.id, verified: verify } }); toast.success(verify ? "Akun diverifikasi" : "Verifikasi dicabut"); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }
  async function removeUser(row: Row) {
    if (row.id === user?.id) { toast.error("Tidak dapat menghapus akun sendiri"); return; }
    if (row.role === "super_admin") { toast.error("Akun Super Admin tidak dapat dihapus"); return; }
    if (!confirm(`HAPUS PERMANEN akun ${row.email}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setActId(row.id);
    try { await deleteUser({ data: { user_id: row.id } }); toast.success("Akun dihapus"); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setActId(null); }
  }

  if (!isSuperAdmin) {
    return <AdminShell breadcrumb={[{ label: "Manajemen User" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Halaman ini hanya untuk Super Admin.</div></AdminShell>;
  }

  const matchQ = (r: Row) =>
    !q.trim() ||
    r.nama_lengkap.toLowerCase().includes(q.toLowerCase()) ||
    r.email.toLowerCase().includes(q.toLowerCase()) ||
    (r.nik ?? "").includes(q);

  const staffRows = useMemo(() => {
    return rows
      .filter((r) => (r.role === "super_admin" || r.role === "admin_opd") && matchQ(r))
      .sort((a, b) => {
        if (a.role === b.role) return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
        return a.role === "super_admin" ? -1 : 1;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q]);

  const desaRows = useMemo(() => {
    return rows
      .filter((r) => r.role === "admin_desa" && matchQ(r))
      .sort((a, b) => (a.desa ?? "").localeCompare(b.desa ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q]);

  const asnRows = useMemo(() => {
    return rows
      .filter((r) => r.role === "asn" && matchQ(r))
      .sort((a, b) => (a.nama_lengkap || "").localeCompare(b.nama_lengkap || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q]);

  const wargaRows = useMemo(() => {
    return rows
      .filter((r) => r.role === "warga" && matchQ(r) && (wargaDesa === "semua" || (r.desa ?? "") === wargaDesa))
      .sort((a, b) => (a.desa ?? "zzz").localeCompare(b.desa ?? "zzz") || (a.nama_lengkap || "").localeCompare(b.nama_lengkap || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, wargaDesa]);

  function renderRow(r: Row) {
    const role = r.pendingRole ?? r.role;
    const opd = r.pendingOpd ?? r.opd_id;
    const desa = r.pendingDesa ?? r.desa ?? "";
    const dirty =
      (r.pendingRole && r.pendingRole !== r.role) ||
      ((role === "admin_opd" || role === "asn") && (r.pendingOpd ?? r.opd_id) !== r.opd_id) ||
      (role === "admin_desa" && (r.pendingDesa ?? r.desa ?? "") !== (r.desa ?? ""));
    const busy = actId === r.id;
    const suspended = r.status === "suspended";
    const needsOpd = role === "admin_opd" || role === "asn";
    const canVerify = r.role === "admin_opd" || r.role === "admin_desa" || r.role === "asn";
    return (
      <tr key={r.id} className="border-t border-border align-top">
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{r.nama_lengkap || "(tanpa nama)"}</div>
          <div className="text-xs text-muted-foreground">{r.email}</div>
          <div className="text-xs text-muted-foreground">NIK: {r.nik ?? "—"} · HP: {r.no_hp ?? "—"}</div>
          {r.role === "asn" && (
            <div className="mt-0.5 text-xs text-muted-foreground">Jabatan: {r.jabatan ?? "—"}</div>
          )}
        </td>
        <td className="px-4 py-3">
          <select
            value={role}
            disabled={r.role === "super_admin"}
            title={r.role === "super_admin" ? "Role Super Admin tidak dapat diubah" : undefined}
            onChange={(e) => setRows((prev) => prev.map((p) => p.id === r.id ? { ...p, pendingRole: e.target.value as AppRoleUI } : p))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
          >
            <option value="warga">Warga</option>
            <option value="asn">ASN</option>
            <option value="admin_opd">Admin OPD</option>
            <option value="admin_desa">Admin Desa</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </td>
        <td className="px-4 py-3">
          {role === "admin_desa" ? (
            <select
              value={desa}
              onChange={(e) => setRows((prev) => prev.map((p) => p.id === r.id ? { ...p, pendingDesa: e.target.value } : p))}
              className="h-9 w-44 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— Pilih Desa —</option>
              {desaList.map((d) => <option key={d.id} value={d.nama}>{d.nama}</option>)}
            </select>
          ) : (
            <select disabled={!needsOpd} value={opd ?? ""} onChange={(e) => setRows((prev) => prev.map((p) => p.id === r.id ? { ...p, pendingOpd: e.target.value || null } : p))} className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50">
              <option value="">— Pilih OPD —</option>
              {opds.map((o) => (<option key={o.id} value={o.id}>{o.singkatan}</option>))}
            </select>
          )}
          {dirty && (
            <button onClick={() => saveRole(r)} disabled={busy || (needsOpd && !opd) || (role === "admin_desa" && desa.trim().length < 2)} className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Simpan
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs ${suspended ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
              {suspended ? "Suspended" : "Aktif"}
            </span>
            {(canVerify || r.role === "super_admin") && (
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.verified_at ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                {r.verified_at ? <><ShieldCheck className="h-3 w-3" /> Terverifikasi</> : <><ShieldOff className="h-3 w-3" /> Belum verif</>}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("id-ID") : "—"}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-1.5">
            <button onClick={() => toggleSuspend(r)} disabled={busy || r.id === user?.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${suspended ? "border-success/40 text-success hover:bg-success/10" : "border-destructive/40 text-destructive hover:bg-destructive/10"} disabled:opacity-40`}>
              {suspended ? <><CheckCircle2 className="h-3 w-3" /> Aktifkan</> : <><Ban className="h-3 w-3" /> Suspend</>}
            </button>
            <button onClick={() => logout(r)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
              <LogOut className="h-3 w-3" /> Logout
            </button>
            <button onClick={() => reset(r)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
              <KeyRound className="h-3 w-3" /> Reset PW
            </button>
            {canVerify && (
              <button onClick={() => toggleVerify(r)} disabled={busy} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${r.verified_at ? "border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" : "border-primary/40 text-primary hover:bg-primary/10"} disabled:opacity-40`}>
                {r.verified_at ? <><ShieldOff className="h-3 w-3" /> Cabut Verif</> : <><ShieldCheck className="h-3 w-3" /> Verifikasi</>}
              </button>
            )}
            <button
              onClick={() => removeUser(r)}
              disabled={busy || r.id === user?.id || r.role === "super_admin"}
              title={r.role === "super_admin" ? "Super Admin tidak dapat dihapus" : "Hapus user"}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Hapus
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function renderTable(title: string, items: Row[], extraHeader?: React.ReactNode) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">{title} <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{items.length}</span></h2>
          {extraHeader}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">OPD / Desa</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Login Terakhir</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Memuat…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Tidak ada user.</td></tr>}
              {items.map(renderRow)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Manajemen User" }]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">Kelola peran, OPD, status akun, sesi, dan reset password.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email / NIK…" className="h-9 w-72 rounded-md border border-border bg-background pl-8 pr-3 text-sm" />
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="font-semibold text-destructive">Gagal memuat daftar user</div>
          <div className="mt-1 text-destructive/90 break-words">{loadError}</div>
          <button onClick={() => load()} className="mt-3 inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground">
            Coba lagi
          </button>
        </div>
      )}

      <div className="space-y-8">
        {renderTable("Staff (Super Admin & Admin OPD)", staffRows)}
        {renderTable("Admin Desa", desaRows)}
        {renderTable("ASN", asnRows)}
        {renderTable(
          "Warga",
          wargaRows,
          <select
            value={wargaDesa}
            onChange={(e) => setWargaDesa(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="semua">Semua Desa</option>
            <option value="">Tanpa Desa</option>
            {desaList.map((d) => <option key={d.id} value={d.nama}>{d.nama}</option>)}
          </select>,
        )}
      </div>
    </AdminShell>
  );
}
