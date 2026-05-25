import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { getTemplate, mySubmission, submitDataset } from "@/lib/dataset.functions";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pengisian/$id")({
  head: () => ({ meta: [{ title: "Isi Dataset" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Kolom = { key: string; label: string; tipe: "text" | "number" | "date" | "select" | "textarea"; required?: boolean; options?: string[]; help?: string };
type Template = {
  id: string; kode: string | null; judul: string; deskripsi: string | null;
  kolom: Kolom[]; deadline: string | null; aktif: boolean;
  allow_multiple_submit: boolean;
  opd: { nama: string; singkatan: string | null } | null;
};
type Submission = { id: string; data: Record<string, string | number | null>; status: string; submitted_at: string };

function Page() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [existing, setExisting] = useState<Submission | null>(null);
  const [values, setValues] = useState<Record<string, string | number | null>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await getTemplate({ data: { id } }) as unknown as { template: Template };
      setTpl(t.template);
      const my = await mySubmission({ data: { template_id: id } }) as unknown as { rows: Submission[] };
      if (my.rows[0]) {
        setExisting(my.rows[0]);
        setValues(my.rows[0].data ?? {});
      }
    } catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal memuat"); }
  }, [id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function onSubmit() {
    setBusy(true); setErr(null); setOk(false);
    try {
      await submitDataset({ data: { template_id: id, data: values, submission_id: existing?.id } });
      setOk(true);
      await load();
    } catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal mengirim"); }
    finally { setBusy(false); }
  }

  if (!user) return <PageShell><div className="container-page py-10">Silakan masuk.</div></PageShell>;
  if (!tpl) return <PageShell><div className="container-page py-10">{err ?? "Memuat…"}</div></PageShell>;

  const overdue = tpl.deadline && new Date(tpl.deadline) < new Date();

  return (
    <PageShell>
      <section className="container-page py-8">
        <button onClick={() => nav({ to: "/pengisian" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground font-mono">{tpl.kode ?? "-"}</div>
            <h1 className="font-display text-2xl font-bold">{tpl.judul}</h1>
            {tpl.deskripsi && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tpl.deskripsi}</p>}
            <div className="mt-2 text-xs text-muted-foreground">
              Pemilik: {tpl.opd?.nama ?? "-"}
              {tpl.deadline && <> • Deadline: <span className={overdue ? "text-destructive font-semibold" : ""}>{new Date(tpl.deadline).toLocaleString("id-ID")}</span></>}
            </div>
          </div>
          {existing && <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold uppercase text-success">Sudah Disubmit</span>}
        </div>

        <div className="mt-6 max-w-3xl space-y-4 rounded-xl border border-border bg-card p-6">
          {tpl.kolom.map((k) => (
            <div key={k.key}>
              <label className="mb-1 block text-sm font-medium">
                {k.label} {k.required && <span className="text-destructive">*</span>}
              </label>
              {k.tipe === "textarea" ? (
                <textarea className="input min-h-[100px]" value={(values[k.key] as string) ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [k.key]: e.target.value }))} />
              ) : k.tipe === "select" ? (
                <select className="input" value={(values[k.key] as string) ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [k.key]: e.target.value }))}>
                  <option value="">— pilih —</option>
                  {(k.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" type={k.tipe === "number" ? "number" : k.tipe === "date" ? "date" : "text"}
                  value={(values[k.key] as string | number) ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [k.key]: k.tipe === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }))} />
              )}
              {k.help && <div className="mt-1 text-xs text-muted-foreground">{k.help}</div>}
            </div>
          ))}

          {err && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}
          {ok && <div className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 p-2 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan.</div>}

          <button onClick={onSubmit} disabled={busy || !tpl.aktif || !!overdue}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60">
            <Save className="h-4 w-4" /> {busy ? "Menyimpan…" : existing ? "Perbarui Submission" : "Kirim Submission"}
          </button>
        </div>
      </section>
    </PageShell>
  );
}
