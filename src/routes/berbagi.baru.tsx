import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { createPaket, lookupTargets, searchUsers } from "@/lib/share.functions";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Upload, ShieldAlert, Send, Search } from "lucide-react";

export const Route = createFileRoute("/berbagi/baru")({
  head: () => ({ meta: [{ title: "Paket Berbagi Baru" }, { name: "robots", content: "noindex" }] }),
  component: PageBaru,
});

type OPD = { id: string; nama: string; singkatan: string | null };
type Pim = { id: string; nama: string; jabatan: string | null; level: string | null };
type UserHit = { id: string; nama_lengkap: string; jabatan: string | null; opd: { singkatan: string | null; nama: string } | null };
type TargetItem =
  | { target_type: "opd"; target_opd_id: string }
  | { target_type: "pimpinan"; target_pejabat_id: string }
  | { target_type: "user"; target_user_id: string; _label?: string };
type Lampiran = { nama_file: string; mime: string; ukuran: number; path: string };

function PageBaru() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tipe, setTipe] = useState<"dokumen" | "memo" | "dataset">("dokumen");
  const [prioritas, setPrioritas] = useState<"normal" | "penting" | "segera" | "rahasia">("normal");
  const [sensitivitas, setSensitivitas] = useState<"publik_internal" | "terbatas" | "rahasia">("publik_internal");
  const [opdList, setOpdList] = useState<OPD[]>([]);
  const [pimList, setPimList] = useState<Pim[]>([]);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [lampiran, setLampiran] = useState<Lampiran[]>([]);
  const [submit, setSubmit] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userQ, setUserQ] = useState("");
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  useEffect(() => {
    lookupTargets().then((r) => {
      const x = r as { opd: OPD[]; pimpinan: Pim[] };
      setOpdList(x.opd);
      setPimList(x.pimpinan);
    });
  }, []);

  useEffect(() => {
    if (userQ.trim().length < 2) { setUserHits([]); return; }
    const t = setTimeout(() => {
      setUserSearching(true);
      searchUsers({ data: { q: userQ } })
        .then((r) => setUserHits((r as { rows: UserHit[] }).rows))
        .catch(() => setUserHits([]))
        .finally(() => setUserSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [userQ]);

  function addOpd(id: string) {
    if (!id) return;
    if (targets.find((t) => t.target_type === "opd" && t.target_opd_id === id)) return;
    setTargets((p) => [...p, { target_type: "opd", target_opd_id: id }]);
  }
  function addPim(id: string) {
    if (!id) return;
    if (targets.find((t) => t.target_type === "pimpinan" && t.target_pejabat_id === id)) return;
    setTargets((p) => [...p, { target_type: "pimpinan", target_pejabat_id: id }]);
  }
  function addUser(u: UserHit) {
    if (targets.find((t) => t.target_type === "user" && t.target_user_id === u.id)) return;
    const label = `${u.nama_lengkap}${u.opd?.singkatan ? ` (${u.opd.singkatan})` : ""}`;
    setTargets((p) => [...p, { target_type: "user", target_user_id: u.id, _label: label }]);
    setUserQ(""); setUserHits([]);
  }
  function removeTarget(i: number) {
    setTargets((p) => p.filter((_, k) => k !== i));
  }


  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const out: Lampiran[] = [];
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name} > 20MB`);
        const path = `paket/${user!.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("share-files").upload(path, f, { upsert: false });
        if (error) throw new Error(error.message);
        out.push({ nama_file: f.name, mime: f.type || "application/octet-stream", ukuran: f.size, path });
      }
      setLampiran((p) => [...p, ...out]);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit() {
    setErr(null);
    if (judul.trim().length < 3) return setErr("Judul minimal 3 karakter");
    if (targets.length === 0) return setErr("Pilih minimal 1 penerima");
    setBusy(true);
    try {
      const cleanTargets = targets.map((t) => {
        if (t.target_type === "user") return { target_type: "user" as const, target_user_id: t.target_user_id };
        return t;
      });
      const res = (await createPaket({
        data: {
          judul, deskripsi, tipe, prioritas, sensitivitas, targets: cleanTargets, lampiran, submit,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      })) as { ok: boolean; id: string; kode: string };
      nav({ to: "/berbagi/$id", params: { id: res.id } });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal membuat paket");
    } finally {
      setBusy(false);
    }
  }

  const crossOpdOrPim =
    targets.some((t) => t.target_type === "pimpinan") || sensitivitas === "rahasia";

  if (loading) return <PageShell><div className="container-page py-10">Memuat…</div></PageShell>;
  if (!user) return <PageShell><div className="container-page py-10">Silakan masuk.</div></PageShell>;

  return (
    <PageShell>
      <section className="container-page py-8">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Modul Berbagi Data</div>
        <h1 className="font-display text-2xl font-bold">Buat Paket Berbagi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Isi metadata, pilih penerima, lampirkan dokumen, lalu kirim.</p>

        {crossOpdOrPim && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Paket ini akan masuk antrian persetujuan admin OPD asal karena ditujukan ke Pimpinan atau bersifat rahasia.
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Field label="Judul">
              <input className="input" value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Deskripsi">
              <textarea className="input min-h-[100px]" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} maxLength={4000} />
            </Field>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-semibold">Penerima</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tambah OPD</label>
                  <select className="input" onChange={(e) => { addOpd(e.target.value); e.target.value = ""; }}>
                    <option value="">— pilih OPD —</option>
                    {opdList.map((o) => <option key={o.id} value={o.id}>{o.singkatan ? `${o.singkatan} — ` : ""}{o.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Tambah Pimpinan</label>
                  <select className="input" onChange={(e) => { addPim(e.target.value); e.target.value = ""; }}>
                    <option value="">— pilih pimpinan —</option>
                    {pimList.map((p) => <option key={p.id} value={p.id}>{p.jabatan ?? "Pimpinan"} — {p.nama}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs text-muted-foreground">Tambah Pengguna (cari nama / NIP / username)</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      className="h-9 flex-1 bg-transparent text-sm outline-none"
                      placeholder="min. 2 karakter…"
                      value={userQ}
                      onChange={(e) => setUserQ(e.target.value)}
                      maxLength={80}
                    />
                    {userSearching && <span className="text-[10px] text-muted-foreground">mencari…</span>}
                  </div>
                  {userHits.length > 0 && (
                    <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-soft">
                      {userHits.map((u) => (
                        <li key={u.id}>
                          <button type="button" onClick={() => addUser(u)} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                            <div className="font-medium">{u.nama_lengkap}</div>
                            <div className="text-[11px] text-muted-foreground">{u.jabatan ?? "-"} • {u.opd?.singkatan ?? u.opd?.nama ?? "Tanpa OPD"}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {targets.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {targets.map((t, i) => {
                    const label = t.target_type === "opd"
                      ? opdList.find((o) => o.id === t.target_opd_id)?.nama ?? "OPD"
                      : t.target_type === "pimpinan"
                        ? `Pimpinan: ${pimList.find((p) => p.id === t.target_pejabat_id)?.nama ?? "-"}`
                        : `User: ${t._label ?? t.target_user_id}`;
                    return (
                      <li key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {label}
                        <button onClick={() => removeTarget(i)} className="ml-1"><X className="h-3 w-3" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>


            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Lampiran (maks 20 file, 20MB/file)</div>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Mengunggah…" : "Pilih File"}
                  <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
                </label>
              </div>
              {lampiran.length === 0
                ? <div className="text-xs text-muted-foreground">Belum ada lampiran.</div>
                : <ul className="space-y-1 text-xs">
                    {lampiran.map((l, i) => (
                      <li key={i} className="flex items-center justify-between rounded border border-border px-2 py-1">
                        <span className="truncate">{l.nama_file} <span className="text-muted-foreground">({Math.round(l.ukuran / 1024)} KB)</span></span>
                        <button onClick={() => setLampiran((p) => p.filter((_, k) => k !== i))}><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-semibold">Metadata</div>
              <Field label="Tipe">
                <select className="input" value={tipe} onChange={(e) => setTipe(e.target.value as typeof tipe)}>
                  <option value="dokumen">Dokumen / Berkas</option>
                  <option value="memo">Memo / Disposisi</option>
                  <option value="dataset">Dataset / Laporan</option>
                </select>
              </Field>
              <Field label="Prioritas">
                <select className="input" value={prioritas} onChange={(e) => setPrioritas(e.target.value as typeof prioritas)}>
                  <option value="normal">Normal</option>
                  <option value="penting">Penting</option>
                  <option value="segera">Segera</option>
                  <option value="rahasia">Rahasia</option>
                </select>
              </Field>
              <Field label="Sensitivitas">
                <select className="input" value={sensitivitas} onChange={(e) => setSensitivitas(e.target.value as typeof sensitivitas)}>
                  <option value="publik_internal">Publik Internal</option>
                  <option value="terbatas">Terbatas</option>
                  <option value="rahasia">Rahasia</option>
                </select>
              </Field>
              <Field label="Berlaku sampai (opsional)">
                <input type="datetime-local" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </Field>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} />
                Kirim sekarang (atau simpan draft)
              </label>
            </div>

            {err && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}

            <button
              onClick={onSubmit}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {submit ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {busy ? "Memproses…" : submit ? "Kirim Paket" : "Simpan Draft"}
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
