// Detail permohonan — DB real, dengan ubah status, tambah catatan, lihat berkas.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, IdCard, Paperclip, Clock, Send, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_LABEL, STATUS_TONE, fmtDateTime, type StatusPermohonan } from "@/lib/permohonan";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/permohonan/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Permohonan ${params.id} — Admin` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <DetailPermohonan />
    </AdminGuard>
  ),
});

const STATUS_OPTIONS: StatusPermohonan[] = ["baru", "diproses", "selesai", "ditolak"];

type Permohonan = {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: StatusPermohonan;
  prioritas: string | null;
  deskripsi: string | null;
  tanggal_masuk: string;
  tenggat: string | null;
  opd_id: string;
  pemohon_id: string;
  petugas_id: string | null;
  untuk_orang_lain: boolean;
  atas_nama_nama: string | null;
  atas_nama_nik: string | null;
  atas_nama_hp: string | null;
  wakil_ambil_nama: string | null;
  wakil_ambil_nik: string | null;
  opd: { nama: string; singkatan: string } | null;
  profiles: { nama_lengkap: string; nik: string | null; no_hp: string | null } | null;
};
type Riwayat = { id: string; ts?: string; created_at: string; aksi: string; catatan: string | null; oleh: string | null; nama_petugas?: string | null; email_petugas?: string | null };
type Berkas = { name: string; size: number };

function DetailPermohonan() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<Permohonan | null>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [berkas, setBerkas] = useState<Berkas[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBaru, setStatusBaru] = useState<StatusPermohonan>("baru");
  const [catatanStatus, setCatatanStatus] = useState("");
  const [catatanBaru, setCatatanBaru] = useState("");
  const [busy, setBusy] = useState(false);
  const [pemohonEmail, setPemohonEmail] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Tidak ada FK eksplisit antara permohonan.pemohon_id dan profiles, jadi query terpisah
      const { data: row, error: rowErr } = await supabase
        .from("permohonan")
        .select("*, opd:opd!opd_id(nama,singkatan)")
        .eq("id", id)
        .maybeSingle();
      if (rowErr) {
        console.error("Gagal memuat permohonan:", rowErr);
        toast.error(`Gagal memuat permohonan: ${rowErr.message}`);
        setLoading(false);
        return;
      }
      if (!row) {
        setLoading(false);
        return;
      }

      // Ambil profil pemohon secara terpisah
      const { data: prof } = await supabase
        .from("profiles")
        .select("nama_lengkap,nik,no_hp")
        .eq("id", (row as { pemohon_id: string }).pemohon_id)
        .maybeSingle();

      const merged = { ...(row as object), profiles: prof ?? null } as unknown as Permohonan;
      setItem(merged);
      setStatusBaru((row as { status: StatusPermohonan }).status);

      // Riwayat dengan info petugas (nama + email) via RPC
      const { data: rws, error: rwsErr } = await supabase
        .rpc("riwayat_dengan_petugas", { _permohonan_id: id });
      if (rwsErr) {
        // Fallback ke tabel mentah jika RPC belum tersedia
        const { data: raw } = await supabase
          .from("permohonan_riwayat")
          .select("id,created_at,aksi,catatan,oleh")
          .eq("permohonan_id", id)
          .order("created_at", { ascending: true });
        setRiwayat((raw ?? []) as Riwayat[]);
      } else {
        setRiwayat((rws ?? []) as Riwayat[]);
      }

      // List berkas: <pemohonId>/<permohonanId>/
      const folder = `${(row as { pemohon_id: string }).pemohon_id}/${id}`;
      const { data: files } = await supabase.storage.from("berkas-permohonan").list(folder);
      setBerkas(
        (files ?? [])
          .filter((f) => f && typeof f.name === "string")
          .map((f) => ({ name: f.name, size: f.metadata?.size ?? 0 })),
      );

      setPemohonEmail(null);
    } catch (e) {
      console.error(e);
      toast.error(`Gagal memuat data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const pemohonFolder = useMemo(() => item ? `${item.pemohon_id}/${item.id}` : "", [item]);

  async function downloadBerkas(name: string) {
    const path = `${pemohonFolder}/${name}`;
    const { data, error } = await supabase.storage.from("berkas-permohonan").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("Gagal membuat link unduh");
    window.open(data.signedUrl, "_blank");
  }

  async function simpanStatus() {
    if (!item || !user) return;
    setBusy(true);
    try {
      const oldStatus = item.status;
      const { error } = await supabase
        .from("permohonan")
        .update({ status: statusBaru, ...(statusBaru !== "baru" ? {} : {}) })
        .eq("id", item.id);
      if (error) throw error;

      await supabase.from("permohonan_riwayat").insert({
        permohonan_id: item.id,
        oleh: user.id,
        aksi: `Status diubah menjadi ${STATUS_LABEL[statusBaru]}`,
        catatan: catatanStatus || null,
      });
      await logAudit({
        aksi: "permohonan.status_changed.manual",
        entitas: "permohonan",
        entitas_id: item.id,
        data_sebelum: { status: oldStatus },
        data_sesudah: { status: statusBaru, catatan: catatanStatus || null },
      });

      setCatatanStatus("");
      toast.success("Status diperbarui");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function tambahCatatan() {
    if (!item || !user || !catatanBaru.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("permohonan_riwayat").insert({
        permohonan_id: item.id,
        oleh: user.id,
        aksi: "Catatan ditambahkan",
        catatan: catatanBaru,
      });
      if (error) throw error;
      setCatatanBaru("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AdminShell breadcrumb={[{ label: "Permohonan", to: "/admin" }, { label: id }]}>
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AdminShell>
    );
  }
  if (!item) {
    return (
      <AdminShell breadcrumb={[{ label: "Permohonan", to: "/admin" }]}>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <h1 className="font-display text-xl font-bold">Permohonan tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">ID tidak terdaftar atau Anda tidak memiliki akses.</p>
          <button onClick={() => navigate({ to: "/admin" })} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell breadcrumb={[{ label: "Permohonan", to: "/admin" }, { label: item.kode }]}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{item.opd?.singkatan} · {item.kategori}</div>
          <h1 className="truncate font-display text-xl font-bold md:text-2xl">{item.judul}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{item.kode}</span>
            <span className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_TONE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
            {item.prioritas && (
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground capitalize">Prioritas: {item.prioritas}</span>
            )}
          </div>
        </div>
        <Link to="/admin" className="hidden sm:inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Daftar
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {item.untuk_orang_lain ? (
            <>
              <div className="rounded-xl border border-primary/30 bg-primary-soft/40 p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-primary">Pemohon (Atas Nama)</h2>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">DIWAKILKAN</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field icon={IdCard} label="Nama">{item.atas_nama_nama || "—"}</Field>
                  <Field icon={IdCard} label="NIK">{item.atas_nama_nik || "—"}</Field>
                  <Field icon={Phone} label="Telepon">{item.atas_nama_hp || "—"}</Field>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pemilik Akun (Pengaju)</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field icon={IdCard} label="Nama">{item.profiles?.nama_lengkap || "—"}</Field>
                  <Field icon={IdCard} label="NIK">{item.profiles?.nik || "—"}</Field>
                  <Field icon={Phone} label="Telepon">{item.profiles?.no_hp || "—"}</Field>
                  <Field icon={Mail} label="Email">{pemohonEmail || "—"}</Field>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data Pemohon</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field icon={IdCard} label="Nama">{item.profiles?.nama_lengkap || "—"}</Field>
                <Field icon={IdCard} label="NIK">{item.profiles?.nik || "—"}</Field>
                <Field icon={Phone} label="Telepon">{item.profiles?.no_hp || "—"}</Field>
                <Field icon={Mail} label="Email">{pemohonEmail || "—"}</Field>
              </div>
            </div>
          )}

          {item.wakil_ambil_nama && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-5 shadow-soft">
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-gold-foreground">Wakil Pengambilan Berkas</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field icon={IdCard} label="Nama Wakil">{item.wakil_ambil_nama}</Field>
                <Field icon={IdCard} label="NIK Wakil">{item.wakil_ambil_nik || "—"}</Field>
              </div>
            </div>
          )}

          {item.deskripsi && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Deskripsi</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.deskripsi}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Diajukan: <strong className="text-foreground">{fmtDateTime(item.tanggal_masuk)}</strong></span>
                {item.tenggat && <span>Tenggat: <strong className="text-foreground">{fmtDateTime(item.tenggat)}</strong></span>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Berkas Pendukung</h2>
            {berkas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada berkas terlampir.</p>
            ) : (
              <ul className="divide-y divide-border">
                {berkas.map((b) => (
                  <li key={b.name} className="flex items-center gap-3 py-2">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                      <Paperclip className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{b.name.split("_").slice(1).join("_") || b.name}</div>
                      <div className="text-xs text-muted-foreground">{(b.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => downloadBerkas(b.name)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Download className="h-3.5 w-3.5" /> Unduh
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Riwayat & Catatan</h2>
            <ol className="space-y-3">
              {riwayat.map((r) => (
                <li key={r.id} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="text-sm font-medium text-foreground">{r.aksi}</div>
                  <div className="text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {fmtDateTime(r.created_at)}
                    {r.nama_petugas && (
                      <span className="ml-2">
                        · oleh <strong className="text-foreground">{r.nama_petugas}</strong>
                        {r.email_petugas && <span className="text-muted-foreground"> ({r.email_petugas})</span>}
                      </span>
                    )}
                  </div>
                  {r.catatan && <div className="mt-1 text-sm text-surface-foreground">{r.catatan}</div>}
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-border pt-4">
              <label className="text-xs font-medium text-muted-foreground">Tambah catatan internal</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={catatanBaru}
                  onChange={(e) => setCatatanBaru(e.target.value)}
                  placeholder="Catatan untuk arsip…"
                  maxLength={500}
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={tambahCatatan}
                  disabled={!catatanBaru.trim() || busy}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Tambah
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ubah Status</h2>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusBaru(s)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold capitalize transition ${
                    statusBaru === s ? STATUS_TONE[s] + " ring-2 ring-ring" : "border-border bg-background text-surface-foreground hover:bg-muted"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <textarea
              value={catatanStatus}
              onChange={(e) => setCatatanStatus(e.target.value)}
              placeholder="Catatan perubahan status (opsional)…"
              maxLength={500}
              rows={3}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={simpanStatus}
              disabled={busy || (statusBaru === item.status && !catatanStatus.trim())}
              className="mt-3 w-full rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Menyimpan…" : "Simpan Perubahan"}
            </button>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-start gap-2 text-sm text-foreground">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <span className="break-words">{children}</span>
      </div>
    </div>
  );
}
