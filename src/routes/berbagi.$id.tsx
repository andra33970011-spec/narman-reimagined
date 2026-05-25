import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import {
  getPaketDetail,
  approvePaket,
  markTargetAction,
  addKomentar,
  getLampiranUrl,
  submitDraft,
  cancelPaket,
  archivePaket,
} from "@/lib/share.functions";
import { ArrowLeft, Paperclip, MessageSquare, Check, X, Send, Clock, Download, Ban, Archive } from "lucide-react";

export const Route = createFileRoute("/berbagi/$id")({
  head: () => ({ meta: [{ title: "Detail Paket Berbagi" }, { name: "robots", content: "noindex" }] }),
  component: PageDetail,
});

type Paket = {
  id: string; kode: string | null; judul: string; deskripsi: string | null; tipe: string;
  prioritas: string; sensitivitas: string; status: string; approval_required: boolean;
  approval_note: string | null; created_at: string; expires_at: string | null;
  pengirim_user_id: string; pengirim_opd_id: string | null;
  opd: { nama: string; singkatan: string | null } | null;
  pengirim: { nama_lengkap: string | null } | null;
};
type Target = {
  id: string; target_type: string; status_baca: string; tindak_lanjut_catatan: string | null;
  opd: { nama: string } | null; user: { nama_lengkap: string | null } | null; pejabat: { nama: string; jabatan: string | null } | null;
};
type Lampiran = { id: string; nama_file: string; ukuran: number; path: string };
type Riwayat = { id: string; aksi: string; created_at: string; catatan: string | null; oleh: { nama_lengkap: string | null } | null };
type Komentar = { id: string; isi: string; created_at: string; oleh: { nama_lengkap: string | null } | null };

function PageDetail() {
  const { id } = Route.useParams();
  const { user, isAdminOpd, isSuperAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [paket, setPaket] = useState<Paket | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [lampiran, setLampiran] = useState<Lampiran[]>([]);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [isi, setIsi] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getPaketDetail({ data: { id } }) as unknown as {
        paket: Paket; targets: Target[]; lampiran: Lampiran[]; riwayat: Riwayat[]; komentar: Komentar[];
      };
      setPaket(r.paket); setTargets(r.targets); setLampiran(r.lampiran);
      setRiwayat(r.riwayat); setKomentar(r.komentar);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal memuat");
    }
  }, [id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function onApprove(approve: boolean) {
    setBusy(true);
    try { await approvePaket({ data: { id, approve, note } }); setNote(""); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }

  async function onAction(target_id: string, aksi: "dibuka" | "ditindaklanjuti" | "ditolak", catatan?: string) {
    setBusy(true);
    try { await markTargetAction({ data: { target_id, aksi, catatan } }); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }

  async function onComment() {
    if (isi.trim().length === 0) return;
    setBusy(true);
    try { await addKomentar({ data: { paket_id: id, isi } }); setIsi(""); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }

  async function onDownload(path: string, nama: string) {
    try {
      const r = await getLampiranUrl({ data: { path, paket_id: id } }) as unknown as { url: string };
      const a = document.createElement("a"); a.href = r.url; a.download = nama; a.target = "_blank"; a.click();
    } catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal unduh"); }
  }

  async function onOwnerSubmit() {
    setBusy(true);
    try { await submitDraft({ data: { id } }); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }
  async function onOwnerCancel() {
    const alasan = prompt("Alasan pembatalan (opsional):") ?? undefined;
    setBusy(true);
    try { await cancelPaket({ data: { id, alasan } }); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }
  async function onArchive() {
    if (!confirm("Arsipkan paket ini?")) return;
    setBusy(true);
    try { await archivePaket({ data: { id } }); await load(); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Gagal"); } finally { setBusy(false); }
  }

  if (authLoading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan masuk.</div></PageShell>;
  if (err && !paket) return <PageShell><div className="container-page py-10 text-destructive">{err}</div></PageShell>;
  if (!paket) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;

  const isOwner = paket.pengirim_user_id === user.id;
  const canApprove = (isAdminOpd || isSuperAdmin) && paket.status === "menunggu_approval";
  const canSubmit = isOwner && (paket.status === "draft" || paket.status === "ditolak");
  const canCancel = (isOwner || isSuperAdmin || isAdminOpd) && ["draft", "menunggu_approval", "terkirim"].includes(paket.status);
  const canArchive = (isOwner || isSuperAdmin || isAdminOpd) && ["terkirim", "ditolak", "dibatalkan"].includes(paket.status);


  return (
    <PageShell>
      <section className="container-page py-8">
        <button onClick={() => nav({ to: "/berbagi" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </button>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{paket.kode ?? "-"}</span>
              <span>•</span>
              <span className="uppercase">{paket.tipe}</span>
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{paket.prioritas}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">{paket.sensitivitas}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold">{paket.judul}</h1>
            <div className="mt-1 text-xs text-muted-foreground">
              Dari: <strong>{paket.pengirim?.nama_lengkap ?? "-"}</strong> ({paket.opd?.singkatan ?? paket.opd?.nama ?? "-"}) • {new Date(paket.created_at).toLocaleString("id-ID")}
            </div>
          </div>
          <StatusBadge s={paket.status} />
        </div>

        {paket.deskripsi && <div className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm">{paket.deskripsi}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card title={`Lampiran (${lampiran.length})`} icon={<Paperclip className="h-4 w-4" />}>
              {lampiran.length === 0 ? <Empty>Tidak ada lampiran.</Empty> : (
                <ul className="divide-y divide-border">
                  {lampiran.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{l.nama_file}</div>
                        <div className="text-xs text-muted-foreground">{Math.round(l.ukuran / 1024)} KB</div>
                      </div>
                      <button onClick={() => onDownload(l.path, l.nama_file)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        <Download className="h-3.5 w-3.5" /> Unduh
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Penerima (${targets.length})`}>
              <ul className="divide-y divide-border">
                {targets.map((t) => {
                  const label = t.target_type === "opd" ? t.opd?.nama
                    : t.target_type === "user" ? t.user?.nama_lengkap
                    : `${t.pejabat?.jabatan ?? "Pimpinan"}: ${t.pejabat?.nama ?? "-"}`;
                  return (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <div className="font-medium">{label ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">Status: {t.status_baca.replace("_", " ")}</div>
                        {t.tindak_lanjut_catatan && <div className="mt-1 text-xs italic text-muted-foreground">"{t.tindak_lanjut_catatan}"</div>}
                      </div>
                      {paket.status === "terkirim" && (
                        <div className="flex gap-1">
                          <Btn onClick={() => onAction(t.id, "dibuka")} disabled={busy}>Tandai Dibuka</Btn>
                          <Btn onClick={() => { const c = prompt("Catatan tindak lanjut:") ?? undefined; onAction(t.id, "ditindaklanjuti", c); }} disabled={busy} variant="primary">Tindak Lanjut</Btn>
                          <Btn onClick={() => { const c = prompt("Alasan tolak:") ?? undefined; onAction(t.id, "ditolak", c); }} disabled={busy} variant="danger">Tolak</Btn>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title={`Diskusi (${komentar.length})`} icon={<MessageSquare className="h-4 w-4" />}>
              <ul className="space-y-2">
                {komentar.map((k) => (
                  <li key={k.id} className="rounded-md border border-border bg-background p-2 text-sm">
                    <div className="text-xs text-muted-foreground">{k.oleh?.nama_lengkap ?? "-"} • {new Date(k.created_at).toLocaleString("id-ID")}</div>
                    <div className="mt-1 whitespace-pre-wrap">{k.isi}</div>
                  </li>
                ))}
                {komentar.length === 0 && <Empty>Belum ada komentar.</Empty>}
              </ul>
              <div className="mt-3 flex gap-2">
                <input className="input flex-1" placeholder="Tulis komentar…" value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={2000} />
                <button onClick={onComment} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  <Send className="h-3.5 w-3.5" /> Kirim
                </button>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {canApprove && (
              <Card title="Persetujuan">
                <textarea className="input min-h-[80px]" placeholder="Catatan (opsional)…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Btn onClick={() => onApprove(true)} disabled={busy} variant="success"><Check className="h-3.5 w-3.5" /> Setujui</Btn>
                  <Btn onClick={() => onApprove(false)} disabled={busy} variant="danger"><X className="h-3.5 w-3.5" /> Tolak</Btn>
                </div>
              </Card>
            )}

            {(canSubmit || canCancel || canArchive) && (
              <Card title="Tindakan Pengirim">
                <div className="flex flex-wrap gap-2">
                  {canSubmit && (
                    <Btn onClick={onOwnerSubmit} disabled={busy} variant="primary"><Send className="h-3.5 w-3.5" /> Kirim</Btn>
                  )}
                  {canCancel && (
                    <Btn onClick={onOwnerCancel} disabled={busy} variant="danger"><Ban className="h-3.5 w-3.5" /> Batalkan</Btn>
                  )}
                  {canArchive && (
                    <Btn onClick={onArchive} disabled={busy}><Archive className="h-3.5 w-3.5" /> Arsipkan</Btn>
                  )}
                </div>
                {paket.expires_at && (
                  <div className="mt-2 text-xs text-muted-foreground">Paket berlaku sampai: {new Date(paket.expires_at).toLocaleString("id-ID")}</div>
                )}
              </Card>
            )}


            <Card title="Riwayat" icon={<Clock className="h-4 w-4" />}>
              <ol className="relative space-y-3 border-l border-border pl-4">
                {riwayat.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="text-xs font-semibold uppercase">{r.aksi.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{r.oleh?.nama_lengkap ?? "-"} • {new Date(r.created_at).toLocaleString("id-ID")}</div>
                    {r.catatan && <div className="mt-1 text-xs italic">"{r.catatan}"</div>}
                  </li>
                ))}
                {riwayat.length === 0 && <li className="text-xs text-muted-foreground">Belum ada riwayat.</li>}
              </ol>
            </Card>

            {paket.approval_note && (
              <Card title="Catatan Approver">
                <div className="text-sm">{paket.approval_note}</div>
              </Card>
            )}
          </div>
        </div>
        {err && <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}
      </section>
    </PageShell>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">{icon}{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-2 text-xs text-muted-foreground">{children}</div>;
}
function Btn({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "primary" | "success" | "danger" }) {
  const cls = variant === "success" ? "bg-success text-success-foreground"
    : variant === "danger" ? "bg-destructive text-destructive-foreground"
    : variant === "primary" ? "bg-primary text-primary-foreground"
    : "border border-border bg-background hover:bg-muted";
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-60 ${cls}`}>{children}</button>;
}
function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    menunggu_approval: "bg-warning/15 text-warning",
    disetujui_kirim: "bg-success/15 text-success",
    ditolak: "bg-destructive/15 text-destructive",
    terkirim: "bg-primary/15 text-primary",
    dibatalkan: "bg-muted text-muted-foreground",
    arsip: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${map[s] ?? "bg-muted"}`}>{s.replace("_", " ")}</span>;
}
