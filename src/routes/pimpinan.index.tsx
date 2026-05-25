import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { listInbox } from "@/lib/share.functions";
import { Crown, FileText } from "lucide-react";

export const Route = createFileRoute("/pimpinan/")({
  head: () => ({ meta: [{ title: "Dashboard Pimpinan" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Row = { id: string; kode: string | null; judul: string; tipe: string; prioritas: string; status: string; created_at: string; pengirim: { nama_lengkap: string | null } | null; opd: { singkatan: string | null; nama: string } | null };

function Page() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    listInbox().then((r) => setRows((r as unknown as { rows: Row[] }).rows)).catch(() => setRows([])).finally(() => setBusy(false));
  }, [user]);

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan masuk.</div></PageShell>;

  const segera = rows.filter((r) => r.prioritas === "segera" || r.prioritas === "rahasia").length;
  const total = rows.length;
  const baru = rows.filter((r) => new Date(r.created_at) > new Date(Date.now() - 24 * 3600 * 1000)).length;

  return (
    <PageShell>
      <section className="container-page py-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-accent">
          <Crown className="h-3.5 w-3.5" /> Khusus Pimpinan
        </div>
        <h1 className="font-display text-2xl font-bold">Dashboard Pimpinan</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Paket berbagi yang ditujukan ke Bupati/Sekda/Kepala dari seluruh OPD.</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Total" value={total} />
          <Stat label="Prioritas Tinggi" value={segera} accent />
          <Stat label="Baru (24 jam)" value={baru} />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Paket Masuk</div>
          {busy && <div className="p-6 text-sm text-muted-foreground">Memuat…</div>}
          {!busy && rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Belum ada paket.</div>}
          {!busy && rows.length > 0 && (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <Link key={r.id} to="/berbagi/$id" params={{ id: r.id }} className="block px-4 py-3 transition hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="font-mono">{r.kode ?? "-"}</span>
                        <span>•</span>
                        <span className="uppercase">{r.tipe}</span>
                        {r.prioritas !== "normal" && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{r.prioritas}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold">{r.judul}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Dari {r.pengirim?.nama_lengkap ?? "-"} ({r.opd?.singkatan ?? r.opd?.nama ?? "-"})</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
