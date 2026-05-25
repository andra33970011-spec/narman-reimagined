// Log Verifikasi Akun — khusus Super Admin.
// Menampilkan riwayat verifikasi & pencabutan dengan timestamp dan pelakunya.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldOff, UserCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import { listVerificationLog } from "@/lib/verification.functions";

export const Route = createFileRoute("/admin/verifikasi-log")({
  head: () => ({ meta: [{ title: "Log Verifikasi — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <Page />
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  created_at: string;
  aksi: string;
  actor: { id: string | null; nama: string | null; email: string };
  target: { id: string; nama: string | null; email: string };
};

function Page() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await listVerificationLog();
      setRows(r.rows as Row[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Log Verifikasi" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Halaman ini hanya untuk Super Admin.
        </div>
      </AdminShell>
    );
  }

  const filtered = rows.filter((r) =>
    !filter.trim() ||
    [r.actor.nama, r.actor.email, r.target.nama, r.target.email, r.aksi]
      .filter(Boolean).join(" ").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <AdminShell breadcrumb={[{ label: "Log Verifikasi" }]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Log Verifikasi Akun</h1>
          <p className="text-sm text-muted-foreground">Riwayat verifikasi & pencabutan, beserta pelaku dan waktunya. 500 entri terbaru.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari nama / email / aksi…"
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button onClick={load} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Muat ulang
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
              <th className="px-4 py-3 font-medium">Akun Target</th>
              <th className="px-4 py-3 font-medium">Pelaku</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Belum ada catatan.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="px-4 py-3">
                  <ActionBadge aksi={r.aksi} />
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-medium text-foreground">{r.target.nama || "(tanpa nama)"}</div>
                  <div className="text-muted-foreground">{r.target.email || r.target.id?.slice(0, 8) + "…"}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-medium text-foreground">{r.actor.nama || r.actor.email || "—"}</div>
                  {r.actor.email && r.actor.nama && <div className="text-muted-foreground">{r.actor.email}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function ActionBadge({ aksi }: { aksi: string }) {
  if (aksi === "user.verified") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"><ShieldCheck className="h-3 w-3" /> Verifikasi staff</span>;
  }
  if (aksi === "user.unverified") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"><ShieldOff className="h-3 w-3" /> Cabut verifikasi</span>;
  }
  if (aksi === "warga.verified") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"><UserCheck className="h-3 w-3" /> Verifikasi warga</span>;
  }
  return <span className="font-mono text-[10px]">{aksi}</span>;
}
