import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { listTemplatesForMe } from "@/lib/dataset.functions";
import { ClipboardList, Clock } from "lucide-react";

export const Route = createFileRoute("/pengisian/")({
  head: () => ({ meta: [{ title: "Pengisian Dataset" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Tpl = {
  id: string; kode: string | null; judul: string; deskripsi: string | null;
  target_role: string; target_scope: string; deadline: string | null;
  opd: { nama: string; singkatan: string | null } | null;
};

function Page() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Tpl[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    listTemplatesForMe()
      .then((r) => setRows((r as unknown as { rows: Tpl[] }).rows))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, [user]);

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan masuk.</div></PageShell>;

  return (
    <PageShell>
      <section className="container-page py-8">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Modul Berbagi Data</div>
        <h1 className="font-display text-2xl font-bold">Pengisian Dataset</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daftar formulir/laporan yang perlu Anda isi sebagai ASN.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {busy && <div className="col-span-full text-sm text-muted-foreground">Memuat…</div>}
          {!busy && rows.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Tidak ada dataset yang ditujukan untuk Anda.</div>}
          {rows.map((t) => {
            const overdue = t.deadline && new Date(t.deadline) < new Date();
            return (
              <Link key={t.id} to="/pengisian/$id" params={{ id: t.id }} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="font-mono">{t.kode ?? "-"}</span>
                  </div>
                  {t.deadline && (
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                      <Clock className="h-3 w-3" /> {new Date(t.deadline).toLocaleDateString("id-ID")}
                    </span>
                  )}
                </div>
                <div className="mt-2 font-semibold text-foreground">{t.judul}</div>
                {t.deskripsi && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.deskripsi}</div>}
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Pemilik: {t.opd?.singkatan ?? t.opd?.nama ?? "—"}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
