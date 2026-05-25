import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { listApprovalQueue } from "@/lib/share.functions";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/berbagi")({
  head: () => ({ meta: [{ title: "Admin — Berbagi Data" }, { name: "robots", content: "noindex" }] }),
  component: () => <AdminGuard><AdminShell><Page /></AdminShell></AdminGuard>,
});

type Row = { id: string; kode: string | null; judul: string; tipe: string; prioritas: string; sensitivitas: string; status: string; created_at: string; pengirim: { nama_lengkap: string | null } | null; opd: { singkatan: string | null; nama: string } | null };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    listApprovalQueue().then((r) => setRows((r as unknown as { rows: Row[] }).rows)).catch(() => setRows([])).finally(() => setBusy(false));
  }, []);

  return (
    <div>
      <h2 className="font-display text-xl font-bold">Antrian Persetujuan Berbagi Data</h2>
      <p className="text-sm text-muted-foreground">Paket lintas-OPD, ditujukan ke Pimpinan, atau bersifat rahasia memerlukan persetujuan admin OPD asal.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Kode</th><th className="px-3 py-2">Judul</th><th className="px-3 py-2">Pengirim</th>
              <th className="px-3 py-2">OPD</th><th className="px-3 py-2">Prioritas</th><th className="px-3 py-2">Waktu</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {busy && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Memuat…</td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Tidak ada paket menunggu persetujuan.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.kode ?? "-"}</td>
                <td className="px-3 py-2 font-medium">{r.judul}</td>
                <td className="px-3 py-2">{r.pengirim?.nama_lengkap ?? "-"}</td>
                <td className="px-3 py-2">{r.opd?.singkatan ?? r.opd?.nama ?? "-"}</td>
                <td className="px-3 py-2"><span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{r.prioritas}</span></td>
                <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="px-3 py-2">
                  <Link to="/berbagi/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                    <ShieldCheck className="h-3 w-3" /> Tinjau
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
