// Dashboard Aset super admin: CRUD aset + Riwayat scan.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, QrCode, Search } from "lucide-react";
import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listAset, upsertAset, deleteAset, listAsetRiwayat } from "@/lib/aset.functions";
import { downloadQrPng, QrImage } from "@/components/asn/QrPrintable";

export const Route = createFileRoute("/admin/aset")({
  head: () => ({ meta: [{ title: "Modul Aset — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AdminGuard><Page /></AdminGuard>),
});

type Opd = { id: string; nama: string; singkatan: string };
type Tab = "list" | "riwayat";

function Page() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("list");
  const [opds, setOpds] = useState<Opd[]>([]);
  useEffect(() => { supabase.from("opd").select("id,nama,singkatan").order("nama").then(({ data }) => setOpds((data ?? []) as Opd[])); }, []);

  if (!isSuperAdmin) {
    return <AdminShell breadcrumb={[{ label: "Modul Aset" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div></AdminShell>;
  }

  return (
    <AdminShell breadcrumb={[{ label: "Modul Aset" }]}>
      <h1 className="font-display text-2xl font-bold">Modul Aset Pemda</h1>
      <p className="text-sm text-muted-foreground">Kelola data aset, cetak QR untuk pelacakan, dan pantau riwayat scan lapangan.</p>
      <div className="mt-4 inline-flex flex-wrap rounded-lg border border-border bg-surface p-1">
        {(["list", "riwayat"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 px-4 rounded-md text-sm font-semibold ${tab === t ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {t === "list" ? "Daftar Aset" : "Riwayat Scan"}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "list" && <AsetTab opds={opds} />}
        {tab === "riwayat" && <RiwayatTab />}
      </div>
    </AdminShell>
  );
}

type AsetRow = { id: string; kode: string; nama: string; kategori: string; opd_id: string | null; pemegang_user_id: string | null; lokasi_terkini: string | null; status: string; foto_url: string | null; opd: { nama: string; singkatan: string } | null; pemegang: { nama_lengkap: string; nip: string | null } | null };

function AsetTab({ opds }: { opds: Opd[] }) {
  const [rows, setRows] = useState<AsetRow[]>([]);
  const [form, setForm] = useState<{ nama: string; kategori: "kendaraan" | "elektronik" | "lainnya"; merk: string; nomor_seri: string; opd_id: string }>({ nama: "", kategori: "kendaraan", merk: "", nomor_seri: "", opd_id: "" });
  const [busy, setBusy] = useState(false);
  const [filterOpd, setFilterOpd] = useState("");
  const [filterKat, setFilterKat] = useState("");
  const [q, setQ] = useState("");
  const [qrFor, setQrFor] = useState<AsetRow | null>(null);

  async function reload() { const r = await listAset({ data: {} }); setRows((r as { rows: AsetRow[] }).rows); }
  useEffect(() => { reload().catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterOpd && r.opd_id !== filterOpd) return false;
      if (filterKat && r.kategori !== filterKat) return false;
      if (t && !(`${r.nama} ${r.kode} ${r.opd?.singkatan ?? ""}`).toLowerCase().includes(t)) return false;
      return true;
    });
  }, [rows, filterOpd, filterKat, q]);

  const stats = useMemo(() => ({
    total: rows.length,
    aktif: rows.filter((r) => r.status === "aktif").length,
    rusak: rows.filter((r) => r.status === "rusak").length,
    kendaraan: rows.filter((r) => r.kategori === "kendaraan").length,
  }), [rows]);

  async function create() {
    if (!form.nama || !form.opd_id) { toast.error("Nama & OPD wajib"); return; }
    setBusy(true);
    try {
      await upsertAset({ data: { nama: form.nama, kategori: form.kategori, merk: form.merk || null, nomor_seri: form.nomor_seri || null, opd_id: form.opd_id, status: "aktif" } });
      toast.success("Aset ditambahkan"); setForm({ nama: "", kategori: "kendaraan", merk: "", nomor_seri: "", opd_id: "" }); await reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function hapus(id: string) {
    if (!confirm("Hapus aset ini?")) return;
    try { await deleteAset({ data: { id } }); toast.success("Aset dihapus"); await reload(); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Aset" value={stats.total} />
        <StatCard label="Aktif" value={stats.aktif} tone="success" />
        <StatCard label="Kendaraan" value={stats.kendaraan} tone="accent" />
        <StatCard label="Rusak" value={stats.rusak} tone="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-2">Tambah Aset</h3>
        <div className="grid gap-2 sm:grid-cols-5">
          <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama aset" className="input h-9" />
          <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value as typeof form.kategori })} className="input h-9">
            <option value="kendaraan">Kendaraan</option><option value="elektronik">Elektronik</option><option value="lainnya">Lainnya</option>
          </select>
          <input value={form.merk} onChange={(e) => setForm({ ...form, merk: e.target.value })} placeholder="Merk" className="input h-9" />
          <input value={form.nomor_seri} onChange={(e) => setForm({ ...form, nomor_seri: e.target.value })} placeholder="No. Seri / Plat" className="input h-9" />
          <select value={form.opd_id} onChange={(e) => setForm({ ...form, opd_id: e.target.value })} className="input h-9"><option value="">— OPD —</option>{opds.map((o) => <option key={o.id} value={o.id}>{o.singkatan}</option>)}</select>
        </div>
        <button disabled={busy} onClick={create} className="mt-2 inline-flex h-9 items-center gap-1 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground"><Plus className="h-3 w-3" /> Tambah</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kode / OPD" className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm" />
        </div>
        <select value={filterOpd} onChange={(e) => setFilterOpd(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm"><option value="">Semua OPD</option>{opds.map((o) => <option key={o.id} value={o.id}>{o.singkatan}</option>)}</select>
        <select value={filterKat} onChange={(e) => setFilterKat(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">Semua kategori</option><option value="kendaraan">Kendaraan</option><option value="elektronik">Elektronik</option><option value="lainnya">Lainnya</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Aset</th><th className="px-3 py-2">OPD</th><th className="px-3 py-2">Pemegang</th><th className="px-3 py-2">Lokasi</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Foto</th><th className="px-3 py-2">QR</th><th /></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Tidak ada aset.</td></tr>}
            {filtered.map((r) => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/asn/aset?kode=${r.kode}`;
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2"><div className="font-medium">{r.nama}</div><div className="text-xs text-muted-foreground">{r.kode} · {r.kategori}</div></td>
                  <td className="px-3 py-2 text-xs">{r.opd?.singkatan ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.pemegang?.nama_lengkap ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.lokasi_terkini ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs">{r.foto_url ? <a href={r.foto_url} target="_blank" rel="noreferrer" className="text-primary underline">Lihat</a> : "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setQrFor(r)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs"><QrCode className="h-3 w-3" /> Pratinjau</button>
                    <button onClick={() => downloadQrPng(url, `aset-${r.kode}.png`)} className="ml-1 inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs">Unduh</button>
                  </td>
                  <td className="px-3 py-2"><button onClick={() => hapus(r.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 px-2 text-xs text-destructive"><Trash2 className="h-3 w-3" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {qrFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setQrFor(null)}>
          <div className="rounded-xl bg-card p-6 text-center shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="font-display font-bold">{qrFor.nama}</div>
            <div className="text-xs text-muted-foreground">{qrFor.kode}</div>
            <div className="mt-3 grid place-items-center"><QrImage value={`${window.location.origin}/asn/aset?kode=${qrFor.kode}`} size={240} /></div>
            <button onClick={() => downloadQrPng(`${window.location.origin}/asn/aset?kode=${qrFor.kode}`, `aset-${qrFor.kode}.png`)} className="mt-3 h-9 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground">Unduh PNG</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Riwayat = { id: string; aksi: string; catatan: string | null; lokasi_text: string | null; lat: number | null; lng: number | null; data: { foto_url?: string } | null; created_at: string; oleh_profile: { nama_lengkap: string } | null };

function RiwayatTab() {
  const [asetId, setAsetId] = useState("");
  const [rows, setRows] = useState<Riwayat[]>([]);
  const [list, setList] = useState<{ id: string; kode: string; nama: string }[]>([]);
  useEffect(() => { listAset({ data: {} }).then((r) => setList((r as { rows: { id: string; kode: string; nama: string }[] }).rows.map((x) => ({ id: x.id, kode: x.kode, nama: x.nama })))).catch(() => {}); }, []);
  async function load() { if (!asetId) return; const r = await listAsetRiwayat({ data: { aset_id: asetId } }); setRows((r as { rows: Riwayat[] }).rows); }
  useEffect(() => { load().catch(() => {}); }, [asetId]);
  const selected = useMemo(() => list.find((a) => a.id === asetId), [list, asetId]);
  return (
    <div className="space-y-3">
      <select value={asetId} onChange={(e) => setAsetId(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
        <option value="">— Pilih aset —</option>
        {list.map((a) => <option key={a.id} value={a.id}>{a.nama} ({a.kode})</option>)}
      </select>
      {selected && <div className="text-xs text-muted-foreground">Riwayat aset: <b>{selected.nama}</b></div>}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Pilih aset untuk melihat riwayat.</div>}
        {rows.map((r) => (
          <div key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-semibold">{r.aksi}</span><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID")}</span></div>
            <div className="text-xs text-muted-foreground">Oleh: {r.oleh_profile?.nama_lengkap ?? "-"}</div>
            {r.lokasi_text && <div className="text-xs">📍 {r.lokasi_text}</div>}
            {r.lat !== null && r.lng !== null && <div className="text-xs text-muted-foreground">GPS: {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}</div>}
            {r.catatan && <div className="text-xs">{r.catatan}</div>}
            {r.data?.foto_url && <a href={r.data.foto_url} target="_blank" rel="noreferrer" className="mt-1 inline-block"><img src={r.data.foto_url} alt="Foto aset" className="h-24 w-24 rounded-md object-cover border border-border" /></a>}
          </div>
        ))}
      </div>
    </div>
  );
}
