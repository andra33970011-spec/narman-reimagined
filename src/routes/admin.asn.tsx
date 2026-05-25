// Dashboard ASN super admin: Kantor & QR + Monitoring Absensi.
import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, MapPin, Save } from "lucide-react";
import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listKantorQR, regenerateKantorQR, listAbsensiAdmin } from "@/lib/asn.functions";
import { QrImage, downloadQrPng } from "@/components/asn/QrPrintable";

export const Route = createFileRoute("/admin/asn")({
  head: () => ({ meta: [{ title: "Modul ASN — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AdminGuard><Page /></AdminGuard>),
});

type Opd = { id: string; nama: string; singkatan: string };
type Tab = "kantor" | "absensi";

function Page() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("kantor");
  const [opds, setOpds] = useState<Opd[]>([]);
  useEffect(() => { supabase.from("opd").select("id,nama,singkatan").order("nama").then(({ data }) => setOpds((data ?? []) as Opd[])); }, []);

  if (!isSuperAdmin) {
    return <AdminShell breadcrumb={[{ label: "Modul ASN" }]}><div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Hanya Super Admin.</div></AdminShell>;
  }

  return (
    <AdminShell breadcrumb={[{ label: "Modul ASN" }]}>
      <h1 className="font-display text-2xl font-bold">Modul ASN</h1>
      <p className="text-sm text-muted-foreground">Pengaturan QR kantor (titik koordinat + radius) dan monitoring absensi.</p>
      <div className="mt-4 inline-flex flex-wrap rounded-lg border border-border bg-surface p-1">
        {(["kantor", "absensi"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 px-4 rounded-md text-sm font-semibold ${tab === t ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {t === "kantor" ? "Kantor & QR" : "Absensi"}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "kantor" && <KantorTab opds={opds} />}
        {tab === "absensi" && <AbsensiTab opds={opds} />}
      </div>
    </AdminShell>
  );
}

type Qr = {
  id: string; opd_id: string; token: string;
  label: string | null; lokasi: string | null;
  lat: number | null; lng: number | null; radius_m: number | null;
  aktif: boolean; opd: { nama: string; singkatan: string } | null;
};

function KantorTab({ opds }: { opds: Opd[] }) {
  const [rows, setRows] = useState<Qr[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Local edit state per opd: lat/lng/radius/lokasi/label
  const [edit, setEdit] = useState<Record<string, { lat: string; lng: string; radius: string; lokasi: string; label: string }>>({});

  async function reload() {
    const r = await listKantorQR();
    const rs = (r as { rows: Qr[] }).rows;
    setRows(rs);
    setEdit((prev) => {
      const next = { ...prev };
      for (const q of rs) {
        if (!next[q.opd_id]) {
          next[q.opd_id] = {
            lat: q.lat?.toString() ?? "",
            lng: q.lng?.toString() ?? "",
            radius: (q.radius_m ?? 100).toString(),
            lokasi: q.lokasi ?? "",
            label: q.label ?? "",
          };
        }
      }
      return next;
    });
  }
  useEffect(() => { reload().catch(() => {}); }, []);

  function ensureEdit(opdId: string) {
    setEdit((prev) => prev[opdId] ? prev : { ...prev, [opdId]: { lat: "", lng: "", radius: "100", lokasi: "", label: "" } });
  }
  function setField(opdId: string, k: "lat" | "lng" | "radius" | "lokasi" | "label", v: string) {
    setEdit((prev) => ({ ...prev, [opdId]: { ...(prev[opdId] ?? { lat: "", lng: "", radius: "100", lokasi: "", label: "" }), [k]: v } }));
  }
  function pickGps(opdId: string) {
    if (!navigator.geolocation) { toast.error("GPS tidak didukung."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setField(opdId, "lat", p.coords.latitude.toFixed(6)); setField(opdId, "lng", p.coords.longitude.toFixed(6)); toast.success("Koordinat GPS diisi"); },
      () => toast.error("Gagal mendapatkan GPS"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  async function save(opdId: string, rotate = false) {
    const e = edit[opdId];
    const lat = e?.lat ? Number(e.lat) : NaN;
    const lng = e?.lng ? Number(e.lng) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) { toast.error("Koordinat lat/lng wajib diisi"); return; }
    const radius = Math.max(10, Math.min(5000, Number(e?.radius || 100)));
    setBusyId(opdId);
    try {
      await regenerateKantorQR({ data: { opd_id: opdId, lat, lng, radius_m: radius, label: e?.label || undefined, lokasi: e?.lokasi || undefined, rotate } });
      toast.success(rotate ? "Token QR dirotasi" : "Pengaturan kantor tersimpan");
      await reload();
    } catch (err) { toast.error((err as Error).message); } finally { setBusyId(null); }
  }

  const byOpd = new Map(rows.map((r) => [r.opd_id, r]));

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
        Tetapkan <b>titik koordinat</b> dan <b>radius</b> setiap kantor OPD. ASN hanya bisa absen jika berada dalam radius tersebut (default 100&nbsp;m).
        Gunakan tombol <i>Pakai GPS sekarang</i> bila Anda sedang berada di lokasi kantor.
      </div>

      {opds.map((o) => {
        const q = byOpd.get(o.id);
        const e = edit[o.id] ?? { lat: "", lng: "", radius: "100", lokasi: "", label: "" };
        const url = q ? `${typeof window !== "undefined" ? window.location.origin : ""}/asn/scan/${q.token}` : "";
        return (
          <div key={o.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="font-semibold">{o.nama} <span className="text-xs text-muted-foreground">({o.singkatan})</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Latitude</label>
                    <input value={e.lat} onChange={(ev) => { ensureEdit(o.id); setField(o.id, "lat", ev.target.value); }} placeholder="-2.5489" className="input h-9 w-full" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Longitude</label>
                    <input value={e.lng} onChange={(ev) => { ensureEdit(o.id); setField(o.id, "lng", ev.target.value); }} placeholder="118.0149" className="input h-9 w-full" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Radius (meter)</label>
                    <input type="number" min={10} max={5000} value={e.radius} onChange={(ev) => { ensureEdit(o.id); setField(o.id, "radius", ev.target.value); }} className="input h-9 w-full" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Label kantor</label>
                    <input value={e.label} onChange={(ev) => { ensureEdit(o.id); setField(o.id, "label", ev.target.value); }} placeholder="Kantor Utama" className="input h-9 w-full" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Alamat lokasi (opsional)</label>
                    <input value={e.lokasi} onChange={(ev) => { ensureEdit(o.id); setField(o.id, "lokasi", ev.target.value); }} placeholder="Jl. ..." className="input h-9 w-full" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => pickGps(o.id)} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs"><MapPin className="h-3 w-3" /> Pakai GPS sekarang</button>
                  <button onClick={() => save(o.id, false)} disabled={busyId === o.id} className="inline-flex h-9 items-center gap-1 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                    {busyId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {q ? "Simpan" : "Generate QR"}
                  </button>
                  {q && (
                    <button onClick={() => save(o.id, true)} disabled={busyId === o.id} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs">
                      <RefreshCw className="h-3 w-3" /> Rotasi Token
                    </button>
                  )}
                  {q && <button onClick={() => downloadQrPng(url, `qr-${o.singkatan}.png`)} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs"><Download className="h-3 w-3" /> Unduh PNG</button>}
                </div>
                {q && (
                  <div className="mt-2 text-[11px] text-muted-foreground break-all">
                    URL scan: {url}
                    {q.lat !== null && q.lng !== null && (
                      <> · Koordinat aktif: <b>{Number(q.lat).toFixed(5)}, {Number(q.lng).toFixed(5)}</b> · Radius: <b>{q.radius_m ?? 100} m</b></>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                {q ? <QrImage value={url} size={130} /> : <div className="grid h-32 w-32 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground text-center px-2">Belum ada QR</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AbsRow = { id: string; tipe: string; waktu: string; lat: number | null; lng: number | null; opd: { nama: string; singkatan: string } | null; profile: { nama_lengkap: string; nip: string | null; jabatan: string | null } | null };
function AbsensiTab({ opds }: { opds: Opd[] }) {
  const [rows, setRows] = useState<AbsRow[]>([]);
  const [opdId, setOpdId] = useState<string>("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  async function reload() {
    const r = await listAbsensiAdmin({ data: { opd_id: opdId || null, from: from ? new Date(from).toISOString() : null, to: to ? new Date(to).toISOString() : null } });
    setRows((r as { rows: AbsRow[] }).rows);
  }
  useEffect(() => { reload().catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      (r.profile?.nama_lengkap ?? "").toLowerCase().includes(t)
      || (r.profile?.nip ?? "").toLowerCase().includes(t)
      || (r.opd?.singkatan ?? "").toLowerCase().includes(t),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRows = rows.filter((r) => new Date(r.waktu) >= today);
    return {
      total: rows.length,
      hariIni: todayRows.length,
      masuk: todayRows.filter((r) => r.tipe === "masuk").length,
      pulang: todayRows.filter((r) => r.tipe === "pulang").length,
    };
  }, [rows]);

  function exportCsv() {
    const header = "Nama,NIP,Jabatan,OPD,Tipe,Waktu,Lat,Lng\n";
    const body = filtered.map((r) => `"${r.profile?.nama_lengkap ?? ""}","${r.profile?.nip ?? ""}","${r.profile?.jabatan ?? ""}","${r.opd?.singkatan ?? ""}",${r.tipe},${new Date(r.waktu).toISOString()},${r.lat ?? ""},${r.lng ?? ""}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `absensi-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Tercatat" value={stats.total} />
        <StatCard label="Hari Ini" value={stats.hariIni} tone="accent" />
        <StatCard label="Masuk Hari Ini" value={stats.masuk} tone="success" />
        <StatCard label="Pulang Hari Ini" value={stats.pulang} tone="gold" />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select value={opdId} onChange={(e) => setOpdId(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm"><option value="">Semua OPD</option>{opds.map((o) => <option key={o.id} value={o.id}>{o.singkatan}</option>)}</select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / NIP / OPD" className="h-9 rounded-md border border-border bg-background px-2 text-sm flex-1 min-w-[180px]" />
        <button onClick={reload} className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Terapkan</button>
        <button onClick={exportCsv} className="h-9 rounded-md border border-border px-3 text-xs">Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Pegawai</th><th className="px-3 py-2">OPD</th><th className="px-3 py-2">Tipe</th><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Koordinat</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Tidak ada data.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2"><div className="font-medium">{r.profile?.nama_lengkap ?? "-"}</div><div className="text-xs text-muted-foreground">{r.profile?.nip ?? ""} {r.profile?.jabatan ? `· ${r.profile.jabatan}` : ""}</div></td>
                <td className="px-3 py-2">{r.opd?.singkatan ?? "-"}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.tipe === "masuk" ? "bg-success/15 text-success" : "bg-accent/20 text-accent"}`}>{r.tipe.toUpperCase()}</span></td>
                <td className="px-3 py-2 text-xs">{new Date(r.waktu).toLocaleString("id-ID")}</td>
                <td className="px-3 py-2 text-xs">{r.lat !== null && r.lng !== null ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
