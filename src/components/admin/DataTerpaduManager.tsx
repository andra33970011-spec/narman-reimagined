// Manajemen konten Data Terpadu (dipindah dari /admin/data-terpadu ke /admin/config).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Kategori = "kpi" | "chart_layanan" | "penduduk" | "anggaran" | "dataset";

type Item = {
  id: string;
  kategori: Kategori;
  label: string;
  nilai_teks: string | null;
  nilai_num: number | null;
  nilai_num2: number | null;
  trend: string | null;
  ikon: string | null;
  format: string | null;
  ukuran: string | null;
  url: string | null;
  opd: string | null;
  aktif: boolean;
  urutan: number;
};

const KATEGORI_LABEL: Record<Kategori, string> = {
  kpi: "KPI Ringkasan",
  chart_layanan: "Chart Permohonan Bulanan",
  penduduk: "Komposisi Penduduk",
  anggaran: "Alokasi Anggaran",
  dataset: "Dataset Terbuka",
};

export function DataTerpaduManager() {
  const [tab, setTab] = useState<Kategori>("kpi");
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {(Object.keys(KATEGORI_LABEL) as Kategori[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {KATEGORI_LABEL[k]}
          </button>
        ))}
      </div>
      <ItemsTab kategori={tab} />
    </div>
  );
}

function ItemsTab({ kategori }: { kategori: Kategori }) {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("data_terpadu_item")
      .select("*")
      .eq("kategori", kategori)
      .order("urutan", { ascending: true });
    setRows((data ?? []) as Item[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [kategori]);

  async function save() {
    if (!editing?.label) { toast.error("Label/judul wajib diisi"); return; }
    const payload = {
      kategori,
      label: editing.label,
      nilai_teks: editing.nilai_teks ?? null,
      nilai_num: editing.nilai_num ?? null,
      nilai_num2: editing.nilai_num2 ?? null,
      trend: editing.trend ?? null,
      ikon: editing.ikon ?? null,
      format: editing.format ?? null,
      ukuran: editing.ukuran ?? null,
      url: editing.url ?? null,
      opd: editing.opd ?? null,
      aktif: editing.aktif ?? true,
      urutan: editing.urutan ?? 0,
    };
    const q = editing.id
      ? supabase.from("data_terpadu_item").update(payload).eq("id", editing.id)
      : supabase.from("data_terpadu_item").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("Tersimpan");
    setEditing(null);
    load();
  }

  async function hapus(id: string) {
    if (!confirm("Hapus item ini?")) return;
    const { error } = await supabase.from("data_terpadu_item").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dihapus");
    load();
  }

  async function toggleAktif(item: Item) {
    const { error } = await supabase
      .from("data_terpadu_item")
      .update({ aktif: !item.aktif })
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, aktif: !item.aktif } : r)));
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{KATEGORI_LABEL[kategori]} — {rows.length} item</div>
        <button
          onClick={() => setEditing({ aktif: true, urutan: rows.length + 1 })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Item Baru
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Nilai</th>
              {kategori === "dataset" && <th className="px-4 py-3 font-medium">OPD / Format</th>}
              <th className="px-4 py-3 font-medium">Urutan</th>
              <th className="px-4 py-3 font-medium">Aktif</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Belum ada item.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{r.label}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.nilai_teks ?? (r.nilai_num !== null ? `${r.nilai_num}${r.nilai_num2 !== null ? ` / ${r.nilai_num2}` : ""}` : "—")}
                  {r.trend && <span className="ml-2 text-xs text-success">{r.trend}</span>}
                </td>
                {kategori === "dataset" && (
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.opd ?? "—"} {r.format && <span className="ml-1 rounded bg-primary-soft px-1.5 py-0.5 text-primary">{r.format}</span>}
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-xs">{r.urutan}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleAktif(r)}
                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${r.aktif ? "bg-primary" : "bg-muted"}`}
                    aria-label={r.aktif ? "Nonaktifkan" : "Aktifkan"}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${r.aktif ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(r)} className="mr-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => hapus(r.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ItemModal
          kategori={kategori}
          editing={editing}
          setEditing={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function ItemModal({
  kategori, editing, setEditing, onClose, onSave,
}: {
  kategori: Kategori;
  editing: Partial<Item>;
  setEditing: (v: Partial<Item>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const title = `${editing.id ? "Edit" : "Baru"}: ${KATEGORI_LABEL[kategori]}`;

  return (
    <Modal title={title} onClose={onClose} onSave={onSave}>
      <Input
        label={kategori === "chart_layanan" ? "Label periode (contoh: Jan)" : kategori === "penduduk" ? "Kelompok (contoh: 18-35)" : kategori === "anggaran" ? "Sektor (contoh: Pendidikan)" : kategori === "dataset" ? "Judul dataset" : "Label KPI"}
        value={editing.label ?? ""}
        onChange={(v) => setEditing({ ...editing, label: v })}
      />

      {kategori === "kpi" && (
        <>
          <Input label="Nilai (teks, contoh: 1.42 Juta atau 67.8%)" value={editing.nilai_teks ?? ""} onChange={(v) => setEditing({ ...editing, nilai_teks: v })} />
          <Input label="Tren / keterangan kecil" value={editing.trend ?? ""} onChange={(v) => setEditing({ ...editing, trend: v })} placeholder="+1.2% YoY" />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ikon</label>
            <select value={editing.ikon ?? ""} onChange={(e) => setEditing({ ...editing, ikon: e.target.value || null })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
              <option value="">— Pilih ikon —</option>
              <option value="Users">Users (penduduk)</option>
              <option value="Database">Database (dataset)</option>
              <option value="Wallet">Wallet (anggaran)</option>
              <option value="TrendingUp">TrendingUp (ekonomi)</option>
            </select>
          </div>
        </>
      )}

      {kategori === "chart_layanan" && (
        <div className="grid gap-3 md:grid-cols-2">
          <NumberInput label="Permohonan masuk" value={editing.nilai_num} onChange={(v) => setEditing({ ...editing, nilai_num: v })} />
          <NumberInput label="Permohonan selesai" value={editing.nilai_num2} onChange={(v) => setEditing({ ...editing, nilai_num2: v })} />
        </div>
      )}

      {kategori === "penduduk" && (
        <NumberInput label="Persentase (%)" value={editing.nilai_num} onChange={(v) => setEditing({ ...editing, nilai_num: v })} />
      )}

      {kategori === "anggaran" && (
        <NumberInput label="Nilai (miliar rupiah)" value={editing.nilai_num} onChange={(v) => setEditing({ ...editing, nilai_num: v })} />
      )}

      {kategori === "dataset" && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="OPD penyedia" value={editing.opd ?? ""} onChange={(v) => setEditing({ ...editing, opd: v })} />
            <Input label="Format (CSV, XLSX, JSON, GeoJSON)" value={editing.format ?? ""} onChange={(v) => setEditing({ ...editing, format: v })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Ukuran (mis. 2.4 MB)" value={editing.ukuran ?? ""} onChange={(v) => setEditing({ ...editing, ukuran: v })} />
            <Input label="URL unduh" value={editing.url ?? ""} onChange={(v) => setEditing({ ...editing, url: v })} placeholder="https://…" />
          </div>
        </>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <NumberInput label="Urutan tampil" value={editing.urutan ?? 0} onChange={(v) => setEditing({ ...editing, urutan: v ?? 0 })} />
        <label className="flex items-center gap-2 self-end pb-1 text-sm">
          <input
            type="checkbox"
            checked={editing.aktif ?? true}
            onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })}
          />
          Tampilkan di halaman publik
        </label>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
          <button onClick={onSave} className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground">Simpan</button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
      />
    </div>
  );
}
