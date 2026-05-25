import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { listInbox, listOutbox, listApprovalQueue, submitDraft, deleteDraft, cancelPaket, archivePaket } from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Inbox, Send, ShieldCheck, Crown, Plus, FileText, Trash2, RotateCw, Ban, Edit, Search, Archive } from "lucide-react";

export const Route = createFileRoute("/berbagi/")({
  head: () => ({ meta: [{ title: "Berbagi Data — Portal Pemerintah" }, { name: "robots", content: "noindex" }] }),
  component: BerbagiHub,
});

type Row = { id: string; kode: string | null; judul: string; tipe: string; prioritas: string; sensitivitas: string; status: string; created_at: string; expires_at?: string | null };

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
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${map[s] ?? "bg-muted"}`}>{s.replace("_", " ")}</span>;
}

function BerbagiHub() {
  const { user, isAdminOpd, isSuperAdmin, loading } = useAuth();
  const [opdId, setOpdId] = useState<string | null>(null);
  const [tab, setTab] = useState<"masuk" | "keluar" | "approval">("masuk");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [actBusy, setActBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [prioritasFilter, setPrioritasFilter] = useState<string>("");


  const load = useCallback(() => {
    if (!user) return;
    setBusy(true);
    const fn = tab === "masuk" ? listInbox : tab === "keluar" ? listOutbox : listApprovalQueue;
    fn().then((r) => setRows((r as { rows: Row[] }).rows)).catch(() => setRows([])).finally(() => setBusy(false));
  }, [user, tab]);

  useEffect(() => { load(); }, [load]);

  // Ambil opd_id sekali untuk filter realtime
  useEffect(() => {
    if (!user) { setOpdId(null); return; }
    supabase.from("profiles").select("opd_id").eq("id", user.id).maybeSingle()
      .then(({ data }) => setOpdId((data?.opd_id as string | null) ?? null));
  }, [user]);

  // Realtime inbox: refresh + toast on new target addressed to me / my OPD
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`share-inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "share_target", filter: `target_user_id=eq.${user.id}` },
        () => { toast("Paket berbagi baru masuk"); if (tab === "masuk") load(); })
      .subscribe();
    let opdCh: ReturnType<typeof supabase.channel> | null = null;
    if (opdId) {
      opdCh = supabase
        .channel(`share-inbox-opd-${opdId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "share_target", filter: `target_opd_id=eq.${opdId}` },
          () => { toast("Paket berbagi baru ke OPD Anda"); if (tab === "masuk") load(); })
        .subscribe();
    }
    return () => { supabase.removeChannel(channel); if (opdCh) supabase.removeChannel(opdCh); };
  }, [user, opdId, tab, load]);


  async function onSubmit(id: string) {
    setActBusy(true);
    try { await submitDraft({ data: { id } }); toast.success("Paket dikirim"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setActBusy(false); }
  }
  async function onDelete(id: string) {
    if (!confirm("Hapus draft ini? Tidak bisa dibatalkan.")) return;
    setActBusy(true);
    try { await deleteDraft({ data: { id } }); toast.success("Draft dihapus"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setActBusy(false); }
  }
  async function onCancel(id: string) {
    const alasan = prompt("Alasan pembatalan (opsional):") ?? undefined;
    setActBusy(true);
    try { await cancelPaket({ data: { id, alasan } }); toast.success("Paket dibatalkan"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setActBusy(false); }
  }
  async function onArchive(id: string) {
    if (!confirm("Arsipkan paket ini?")) return;
    setActBusy(true);
    try { await archivePaket({ data: { id } }); toast.success("Paket diarsipkan"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal"); }
    finally { setActBusy(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (prioritasFilter && r.prioritas !== prioritasFilter) return false;
      if (!q) return true;
      return (r.judul ?? "").toLowerCase().includes(q) || (r.kode ?? "").toLowerCase().includes(q) || (r.tipe ?? "").toLowerCase().includes(q);
    });
  }, [rows, query, statusFilter, prioritasFilter]);

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan <Link to="/auth" className="text-primary underline">masuk</Link>.</div></PageShell>;

  const canApprove = isAdminOpd || isSuperAdmin;

  return (
    <PageShell>
      <section className="container-page py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Modul Resmi</div>
            <h1 className="font-display text-2xl font-bold">Berbagi Data Antar OPD &amp; Pimpinan</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Kirim dokumen, memo/disposisi, dan dataset terstruktur ke OPD lain, pengguna spesifik, atau Pimpinan. Permintaan lintas-OPD &amp; rahasia melalui persetujuan admin OPD asal.
            </p>
          </div>
          <a href="/berbagi/baru" className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft">
            <Plus className="h-4 w-4" /> Paket Baru
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Inbox className="h-4 w-4" />} label="Masuk" onClick={() => setTab("masuk")} active={tab === "masuk"} />
          <StatCard icon={<Send className="h-4 w-4" />} label="Keluar" onClick={() => setTab("keluar")} active={tab === "keluar"} />
          {canApprove && <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Persetujuan" onClick={() => setTab("approval")} active={tab === "approval"} />}
          <a href="/pimpinan" className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-soft">
            <div className="flex items-center gap-2 text-sm font-semibold"><Crown className="h-4 w-4 text-accent" /> Dashboard Pimpinan</div>
            <div className="mt-1 text-xs text-muted-foreground">Khusus pejabat pimpinan</div>
          </a>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">
              {tab === "masuk" ? "Paket Masuk" : tab === "keluar" ? "Paket Keluar" : "Antrian Persetujuan"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({filtered.length}/{rows.length})</span>
            </div>
            <a href="/pengisian" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <FileText className="h-3.5 w-3.5" /> Pengisian Dataset
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="h-8 flex-1 bg-transparent text-sm outline-none"
                placeholder="Cari judul, kode, atau tipe…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua status</option>
              {tab === "keluar" && <option value="draft">Draft</option>}
              <option value="menunggu_approval">Menunggu Approval</option>
              <option value="terkirim">Terkirim</option>
              <option value="ditolak">Ditolak</option>
              <option value="dibatalkan">Dibatalkan</option>
              <option value="arsip">Arsip</option>
            </select>
            <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={prioritasFilter} onChange={(e) => setPrioritasFilter(e.target.value)}>
              <option value="">Semua prioritas</option>
              <option value="normal">Normal</option>
              <option value="penting">Penting</option>
              <option value="segera">Segera</option>
              <option value="rahasia">Rahasia</option>
            </select>
          </div>
          {busy && <div className="p-6 text-sm text-muted-foreground">Memuat…</div>}
          {!busy && filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada data sesuai filter.</div>}
          {!busy && filtered.length > 0 && (
            <div className="divide-y divide-border">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3 transition hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-3">
                    <a href={`/berbagi/${r.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{r.kode ?? "-"}</span>
                        <span>•</span>
                        <span className="uppercase">{r.tipe}</span>
                        {r.prioritas !== "normal" && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{r.prioritas}</span>}
                        {r.expires_at && <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">Berlaku s.d {new Date(r.expires_at).toLocaleDateString("id-ID")}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{r.judul}</div>
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge s={r.status} />
                      <span className="hidden text-xs text-muted-foreground sm:inline">{new Date(r.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </div>
                  {tab === "keluar" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {r.status === "draft" && (
                        <>
                          <a href={`/berbagi/${r.id}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">
                            <Edit className="h-3 w-3" /> Lanjutkan
                          </a>
                          <button disabled={actBusy} onClick={() => onSubmit(r.id)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                            <Send className="h-3 w-3" /> Kirim
                          </button>
                          <button disabled={actBusy} onClick={() => onDelete(r.id)} className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-60">
                            <Trash2 className="h-3 w-3" /> Hapus
                          </button>
                        </>
                      )}
                      {r.status === "ditolak" && (
                        <>
                          <button disabled={actBusy} onClick={() => onSubmit(r.id)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                            <RotateCw className="h-3 w-3" /> Kirim Ulang
                          </button>
                          <button disabled={actBusy} onClick={() => onArchive(r.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                            <Archive className="h-3 w-3" /> Arsipkan
                          </button>
                        </>
                      )}
                      {(r.status === "menunggu_approval" || r.status === "terkirim") && (
                        <button disabled={actBusy} onClick={() => onCancel(r.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                          <Ban className="h-3 w-3" /> Batalkan
                        </button>
                      )}
                      {r.status === "terkirim" && (
                        <button disabled={actBusy} onClick={() => onArchive(r.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                          <Archive className="h-3 w-3" /> Arsipkan
                        </button>
                      )}
                      {(r.status === "dibatalkan") && (
                        <button disabled={actBusy} onClick={() => onArchive(r.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                          <Archive className="h-3 w-3" /> Arsipkan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function StatCard({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">{icon} {label}</div>
      <div className="mt-1 text-xs text-muted-foreground">Klik untuk melihat</div>
    </button>
  );
}
