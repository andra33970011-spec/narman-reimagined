import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { generateKodePermohonan } from "@/lib/permohonan";
import { logAudit } from "@/lib/audit";
import { compressImage } from "@/lib/compress-image";
import { getVerificationConfig } from "@/lib/verification.functions";
import { getPermohonanVerificationRequired } from "@/lib/site-settings";


type BaruSearch = { layanan?: string };

export const Route = createFileRoute("/permohonan/baru")({
  validateSearch: (search: Record<string, unknown>): BaruSearch => ({
    layanan: typeof search.layanan === "string" && search.layanan.length > 0 ? search.layanan : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ajukan Permohonan — Portal Buton Selatan" },
      { name: "description", content: "Ajukan permohonan layanan publik secara online ke OPD terkait Kabupaten Buton Selatan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BaruPage,
});

type Opd = { id: string; nama: string; singkatan: string; kategori: string[] };

const formSchema = z.object({
  opd_id: z.string().uuid("Pilih OPD"),
  kategori: z.string().min(1, "Pilih kategori"),
  judul: z.string().trim().min(5, "Judul minimal 5 karakter").max(200),
  deskripsi: z.string().trim().max(2000).optional().or(z.literal("")),
  prioritas: z.enum(["rendah", "normal", "tinggi"]),
});

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file (final, setelah kompresi gambar)
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB total semua berkas
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function BaruPage() {
  const { user, loading, isVerified } = useAuth();
  const navigate = useNavigate();
  const [verifBlock, setVerifBlock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVerificationConfig(), getPermohonanVerificationRequired()])
      .then(([cfg, required]) => {
        if (cancelled) return;
        const block = (cfg.enabled && cfg.mode === "block_permohonan" && !isVerified) || (required && !isVerified);
        setVerifBlock(block);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [isVerified]);
  const { layanan: layananSlug } = Route.useSearch();
  const [opdList, setOpdList] = useState<Opd[]>([]);
  const [form, setForm] = useState({
    opd_id: "",
    kategori: "",
    judul: "",
    deskripsi: "",
    prioritas: "normal" as "rendah" | "normal" | "tinggi",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [prefilling, setPrefilling] = useState<boolean>(!!layananSlug);
  const [kategoriLain, setKategoriLain] = useState("");
  const [slaHari, setSlaHari] = useState<number>(14);
  const [untukOrangLain, setUntukOrangLain] = useState(false);
  const [atasNama, setAtasNama] = useState({ nama: "", nik: "", hp: "" });
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const redirectPath = layananSlug
        ? `/permohonan/baru?layanan=${encodeURIComponent(layananSlug)}`
        : "/permohonan/baru";
      navigate({ to: "/auth", search: { redirect: redirectPath } as never });
    }
  }, [user, loading, navigate, layananSlug]);

  useEffect(() => {
    supabase.from("opd").select("id,nama,singkatan,kategori").order("nama").then(({ data }) => {
      setOpdList((data ?? []) as Opd[]);
    });
  }, []);

  // Prefill form berdasar slug layanan dari query string.
  useEffect(() => {
    if (!layananSlug) return;
    let cancelled = false;
    (async () => {
      setPrefilling(true);
      const { data } = await supabase
        .from("layanan_publik")
        .select("judul,opd_id,sla_hari")
        .eq("slug", layananSlug)
        .eq("aktif", true)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setForm((prev) => ({
          ...prev,
          opd_id: data.opd_id ?? prev.opd_id,
          judul: prev.judul || `Permohonan ${data.judul}`,
        }));
        if (typeof data.sla_hari === "number") setSlaHari(data.sla_hari);
      }
      setPrefilling(false);
    })();
    return () => { cancelled = true; };
  }, [layananSlug]);

  const opd = opdList.find((o) => o.id === form.opd_id);
  // Susun kategori: pisahkan "Lainnya" agar selalu di posisi terakhir & tidak duplikat.
  const kategoriOptions = (() => {
    if (!opd) return [] as string[];
    const base = opd.kategori.filter((k) => k.toLowerCase() !== "lainnya");
    return [...base, "Lainnya"];
  })();
  const isLainnya = form.kategori === "Lainnya";

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    setCompressing(true);
    try {
      const next: File[] = [...files];
      for (const raw of list) {
        if (!ALLOWED_MIME.has(raw.type)) {
          toast.error(`${raw.name}: tipe berkas tidak didukung (PDF/JPG/PNG/WebP).`);
          continue;
        }
        let f = raw;
        if (raw.type.startsWith("image/") && raw.size > MAX_FILE_BYTES) {
          try {
            f = await compressImage(raw, MAX_FILE_BYTES);
            if (f.size < raw.size) {
              toast.success(`${raw.name}: dikompresi ${(raw.size / 1024 / 1024).toFixed(1)}MB → ${(f.size / 1024 / 1024).toFixed(1)}MB`);
            }
          } catch {
            f = raw;
          }
        }
        if (f.size > MAX_FILE_BYTES) {
          toast.error(`${raw.name}: melebihi 10 MB setelah kompresi.`);
          continue;
        }
        next.push(f);
      }
      const total = next.reduce((acc, x) => acc + x.size, 0);
      if (total > MAX_TOTAL_BYTES) {
        toast.error(`Total ukuran berkas ${(total / 1024 / 1024).toFixed(1)} MB melebihi batas 10 MB. Hapus / kompres berkas terlebih dahulu.`);
        return;
      }
      setFiles(next);
    } finally {
      setCompressing(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const parsed = formSchema.parse(form);
      // Jika "Lainnya", wajib isi detail dan simpan ke kategori sebagai "Lainnya: <detail>".
      let kategoriFinal = parsed.kategori;
      if (parsed.kategori === "Lainnya") {
        const detail = kategoriLain.trim();
        if (detail.length < 3) throw new Error("Sebutkan jenis layanan untuk kategori Lainnya (min. 3 karakter).");
        kategoriFinal = `Lainnya: ${detail}`;
      }
      const kode = generateKodePermohonan();
      const tenggat = new Date(Date.now() + slaHari * 86400_000).toISOString();

      if (untukOrangLain) {
        if (atasNama.nama.trim().length < 3) throw new Error("Nama pemohon (orang lain) wajib diisi.");
        if (!/^\d{16}$/.test(atasNama.nik.trim())) throw new Error("NIK harus 16 digit angka.");
        if (atasNama.hp.trim().length < 8) throw new Error("Nomor telepon wajib diisi.");
      }
      const { data: row, error } = await supabase
        .from("permohonan")
        .insert({
          kode,
          pemohon_id: user.id,
          opd_id: parsed.opd_id,
          judul: parsed.judul,
          kategori: kategoriFinal,
          deskripsi: parsed.deskripsi || null,
          prioritas: parsed.prioritas,
          tenggat,
          untuk_orang_lain: untukOrangLain,
          atas_nama_nama: untukOrangLain ? atasNama.nama.trim() : null,
          atas_nama_nik: untukOrangLain ? atasNama.nik.trim() : null,
          atas_nama_hp: untukOrangLain ? atasNama.hp.trim() : null,
        })
        .select()
        .single();
      if (error) throw error;

      // Riwayat awal
      await supabase.from("permohonan_riwayat").insert({
        permohonan_id: row.id,
        oleh: user.id,
        aksi: "Permohonan diajukan",
        catatan: "Pengajuan melalui portal warga.",
      });

      // Upload berkas (jika ada) ke storage. Path: <userId>/<permohonanId>/<filename>
      for (const f of files) {
        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${row.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("berkas-permohonan")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) console.warn("Gagal upload", f.name, upErr.message);
      }

      await logAudit({ aksi: "permohonan.created", entitas: "permohonan", entitas_id: row.id });

      toast.success(`Permohonan ${kode} berhasil diajukan`);
      navigate({ to: "/permohonan" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <PageShell>
        <div className="container-page py-20 text-center text-muted-foreground">Memuat…</div>
      </PageShell>
    );
  }

  if (verifBlock) {
    return (
      <PageShell>
        <PageHero eyebrow="Verifikasi Diperlukan" title="Akun Anda belum diverifikasi" description="Pengajuan permohonan baru memerlukan verifikasi oleh Admin Desa." />
        <section className="container-page py-12">
          <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-muted-foreground">
              Silakan buka <strong>Akun Saya</strong> untuk menampilkan QR / kode verifikasi, lalu temui Admin Desa setempat untuk diverifikasi.
            </p>
            <Link to="/akun" className="mt-4 inline-flex h-10 items-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground">
              Buka Akun Saya
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }
  return (
    <PageShell>
      <PageHero
        eyebrow="Layanan Warga"
        title="Ajukan Permohonan Baru"
        description="Lengkapi form di bawah dan unggah berkas pendukung. Permohonan akan diteruskan ke OPD terkait."
      />
      <section className="container-page py-12">
        {prefilling && (
          <div className="mx-auto mb-4 max-w-2xl rounded-md border border-primary/20 bg-primary-soft px-4 py-2 text-xs font-medium text-primary">
            Mengisi otomatis berdasarkan layanan yang dipilih…
          </div>
        )}
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-soft">
          <Field label="Permohonan ini untuk" required>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setUntukOrangLain(false)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${!untukOrangLain ? "border-primary bg-primary-soft text-primary" : "border-border bg-background hover:bg-muted"}`}>Diri sendiri</button>
              <button type="button" onClick={() => setUntukOrangLain(true)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${untukOrangLain ? "border-primary bg-primary-soft text-primary" : "border-border bg-background hover:bg-muted"}`}>Orang lain</button>
            </div>
            {untukOrangLain && (
              <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
                <input className="input h-10 w-full" placeholder="Nama lengkap pemohon"
                  value={atasNama.nama} onChange={(e) => setAtasNama({ ...atasNama, nama: e.target.value })} maxLength={100} required />
                <input className="input h-10 w-full" placeholder="NIK (16 digit)" inputMode="numeric"
                  value={atasNama.nik} onChange={(e) => setAtasNama({ ...atasNama, nik: e.target.value.replace(/\D/g, "") })} maxLength={16} required />
                <input className="input h-10 w-full" placeholder="Nomor telepon" inputMode="tel"
                  value={atasNama.hp} onChange={(e) => setAtasNama({ ...atasNama, hp: e.target.value })} maxLength={20} required />
              </div>
            )}
          </Field>

          <Field label="OPD Tujuan" required>
            <select
              required
              value={form.opd_id}
              onChange={(e) => setForm({ ...form, opd_id: e.target.value, kategori: "" })}
              className="input h-11"
            >
              <option value="">— Pilih OPD —</option>
              {opdList.map((o) => (
                <option key={o.id} value={o.id}>{o.singkatan} — {o.nama}</option>
              ))}
            </select>
          </Field>

          <Field label="Kategori Layanan" required>
            <select
              required
              disabled={!opd}
              value={form.kategori}
              onChange={(e) => {
                setForm({ ...form, kategori: e.target.value });
                if (e.target.value !== "Lainnya") setKategoriLain("");
              }}
              className="input h-11"
            >
              <option value="">— Pilih kategori —</option>
              {kategoriOptions.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            {isLainnya && (
              <input
                required
                value={kategoriLain}
                onChange={(e) => setKategoriLain(e.target.value)}
                className="input h-11 mt-2"
                placeholder="Sebutkan jenis layanan yang dibutuhkan…"
                maxLength={100}
              />
            )}
          </Field>

          <Field label="Judul Permohonan" required>
            <input
              required
              maxLength={200}
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              className="input h-11"
              placeholder="Contoh: Permohonan Akta Kelahiran an. Budi"
            />
          </Field>

          <Field label="Deskripsi">
            <textarea
              rows={4}
              maxLength={2000}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              className="input"
              placeholder="Jelaskan kebutuhan Anda secara singkat…"
            />
          </Field>

          <Field label="Prioritas">
            <div className="flex gap-2">
              {(["rendah", "normal", "tinggi"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, prioritas: p })}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize ${
                    form.prioritas === p
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-surface-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Berkas Pendukung (total maks 10 MB, gambar dikompresi otomatis)`}>
            <div className="mb-2 text-xs text-muted-foreground">
              Terpakai: <strong className="text-foreground">{(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2)} MB</strong> / 10 MB
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background p-6 text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-4 w-4" />
              {compressing ? "Memproses…" : "Klik untuk pilih berkas"}
              <input type="file" multiple className="hidden" onChange={onPickFiles} accept=".pdf,.png,.jpg,.jpeg,.webp" />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Link to="/permohonan" className="text-sm text-primary hover:underline">← Lihat permohonan saya</Link>
            <button
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-gradient-primary px-6 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Mengajukan…" : "Ajukan Permohonan"}
            </button>
          </div>
        </form>
      </section>
    </PageShell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
