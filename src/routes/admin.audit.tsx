// Audit Log Viewer — super admin.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/permohonan";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AdminGuard>
      <AuditPage />
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  created_at: string;
  user_email: string | null;
  aksi: string;
  entitas: string;
  entitas_id: string | null;
  data_sebelum: unknown;
  data_sesudah: unknown;
};

function AuditPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase
      .from("audit_log")
      .select("id,created_at,user_email,aksi,entitas,entitas_id,data_sebelum,data_sesudah")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <AdminShell breadcrumb={[{ label: "Audit Log" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Hanya untuk Super Admin.
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Audit Log" }]}>
      <h1 className="mb-1 font-display text-2xl font-bold">Audit Log</h1>
      <p className="mb-4 text-sm text-muted-foreground">200 aksi terbaru pada sistem.</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
              <th className="px-4 py-3 font-medium">Entitas</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Belum ada catatan.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="px-4 py-3 text-xs">{r.user_email ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.aksi}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{r.entitas}</div>
                  {r.entitas_id && <div className="font-mono text-[10px] text-muted-foreground">{r.entitas_id.slice(0, 8)}…</div>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {(r.data_sebelum || r.data_sesudah) ? (
                    <pre className="max-w-md overflow-x-auto rounded bg-muted p-2 text-[10px] text-foreground">
                      {JSON.stringify({ before: r.data_sebelum, after: r.data_sesudah })}
                    </pre>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
