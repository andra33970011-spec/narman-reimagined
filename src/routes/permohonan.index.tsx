import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Inbox, Star, BarChart3, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, fmtTanggal, type StatusPermohonan } from "@/lib/permohonan";
import { RatingForm } from "@/components/warga/RatingForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { setWakilAmbil, clearWakilAmbil } from "@/lib/admin-actions.functions";


export const Route = createFileRoute("/permohonan/")({
  head: () => ({
    meta: [
      { title: "Permohonan Saya — Portal Buton Selatan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ListPage,
});

type Row = {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: StatusPermohonan;
  tanggal_masuk: string;
  opd: { singkatan: string } | null;
  catatanAdmin?: string | null;
  rating?: { skor: number; komentar: string | null } | null;
  wakil_ambil_nama?: string | null;
  wakil_ambil_nik?: string | null;
};

function ListPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [openRatingFor, setOpenRatingFor] = useState<Row | null>(null);
  const [openWakilFor, setOpenWakilFor] = useState<Row | null>(null);
  const [wakilNama, setWakilNama] = useState("");
  const [wakilNik, setWakilNik] = useState("");
  const [savingWakil, setSavingWakil] = useState(false);
  // Grace period: jangan redirect sampai benar-benar yakin user tidak login.
  // Penting di PWA standalone Android di mana restore sesi dari storage bisa
  // sedikit telat sehingga `user` masih null beberapa ratus ms setelah loading=false.
  const [authSettled, setAuthSettled] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      setAuthSettled(true);
      return;
    }
    // Tunggu 1.2 detik & coba getSession sekali lagi sebelum memutuskan logout.
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!data.session) {
          navigate({ to: "/auth" });
        }
        setAuthSettled(true);
      } catch {
        if (!cancelled) setAuthSettled(true);
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user, loading, navigate]);

  async function loadData(uid: string) {
    setLoadingList(true);
    const { data } = await supabase
      .from("permohonan")
      .select("id, kode, judul, kategori, status, tanggal_masuk, wakil_ambil_nama, wakil_ambil_nik, opd:opd!opd_id(singkatan)")
      .eq("pemohon_id", uid)
      .order("tanggal_masuk", { ascending: false });
    const rows = (data ?? []) as unknown as Row[];

    const finalIds = rows.filter((r) => r.status === "selesai" || r.status === "ditolak" || r.status === "diproses").map((r) => r.id);
    if (finalIds.length > 0) {
      const [{ data: rws }, { data: rts }] = await Promise.all([
        supabase
          .from("permohonan_riwayat")
          .select("permohonan_id, catatan, created_at")
          .in("permohonan_id", finalIds)
          .not("catatan", "is", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("permohonan_rating")
          .select("permohonan_id, skor, komentar")
          .in("permohonan_id", finalIds)
          .eq("user_id", uid),
      ]);

      const latest: Record<string, string> = {};
      ((rws ?? []) as { permohonan_id: string; catatan: string | null }[]).forEach((r) => {
        if (r.catatan && !latest[r.permohonan_id]) latest[r.permohonan_id] = r.catatan;
      });
      const ratingMap: Record<string, { skor: number; komentar: string | null }> = {};
      ((rts ?? []) as { permohonan_id: string; skor: number; komentar: string | null }[]).forEach((r) => {
        ratingMap[r.permohonan_id] = { skor: r.skor, komentar: r.komentar };
      });

      rows.forEach((r) => {
        r.catatanAdmin = latest[r.id] ?? null;
        r.rating = ratingMap[r.id] ?? null;
      });
    }

    setItems(rows);
    setLoadingList(false);
  }

  useEffect(() => {
    if (!user) return;
    loadData(user.id);
  }, [user]);

  return (
    <PageShell>
      <PageHero eyebrow="Akun Saya" title="Permohonan Saya" description="Pantau status pengajuan layanan publik Anda." />
      <section className="container-page py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Daftar Permohonan</h2>
          <Link
            to="/permohonan/baru"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <Plus className="h-4 w-4" /> Ajukan Baru
          </Link>
        </div>

        {loadingList ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">Belum ada permohonan</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mulai ajukan permohonan layanan publik pertama Anda.</p>
            <Link to="/permohonan/baru" className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Ajukan Baru
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Judul</th>
                  <th className="px-4 py-3 font-medium">OPD</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-surface/60 align-top">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        to="/permohonan/$id"
                        params={{ id: p.id }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {p.kode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.judul}</div>
                      <div className="text-xs text-muted-foreground">{p.kategori}</div>
                      {(p.status === "selesai" || p.status === "ditolak" || p.status === "diproses") && p.catatanAdmin && (
                        <div className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${p.status === "selesai" ? "border-success/30 bg-success/5 text-success" : p.status === "ditolak" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-gold/30 bg-gold/5 text-gold-foreground"}`}>
                          <span className="font-semibold">Catatan Admin: </span>
                          <span className="text-foreground/80">{p.catatanAdmin}</span>
                        </div>
                      )}
                      {p.status === "selesai" && p.rating && (
                        <div className="mt-2 rounded-md border border-gold/30 bg-gold/5 p-2 text-xs">
                          <div className="flex flex-wrap items-center gap-0.5">
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= p.rating!.skor ? "fill-gold text-gold" : "text-muted-foreground/40"}`} />
                            ))}
                            <span className="ml-1 font-medium text-foreground">{p.rating.skor}/10</span>
                          </div>
                          {p.rating.komentar && (
                            <div className="mt-1 italic text-muted-foreground">"{p.rating.komentar}"</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">{p.opd?.singkatan ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtTanggal(p.tanggal_masuk)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {p.status === "selesai" && !p.rating && (
                          <button
                            type="button"
                            onClick={() => setOpenRatingFor(p)}
                            className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-foreground border border-gold/30 hover:bg-gold/20"
                          >
                            <Star className="h-3.5 w-3.5" /> Beri Rating
                          </button>
                        )}
                        {p.status === "selesai" && p.rating && (
                          <Link
                            to="/kinerja-opd"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            <BarChart3 className="h-3.5 w-3.5" /> Kinerja OPD
                          </Link>
                        )}
                        {p.status === "selesai" && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenWakilFor(p);
                              setWakilNama(p.wakil_ambil_nama ?? "");
                              setWakilNik(p.wakil_ambil_nik ?? "");
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {p.wakil_ambil_nama ? "Ubah Wakil" : "Wakilkan Pengambilan"}
                          </button>
                        )}
                        {p.wakil_ambil_nama && (
                          <div className="text-[10px] text-muted-foreground">
                            Wakil: <span className="font-medium text-foreground">{p.wakil_ambil_nama}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Rating & ulasan Anda akan diagregasi pada halaman{" "}
          <Link to="/kinerja-opd" className="font-medium text-primary hover:underline">Kinerja OPD</Link>{" "}
          sebagai indikator kepuasan layanan publik.
        </p>
      </section>

      <Dialog open={!!openRatingFor} onOpenChange={(o) => !o && setOpenRatingFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Beri Rating Layanan</DialogTitle>
            <DialogDescription>
              {openRatingFor?.judul} · {openRatingFor?.opd?.singkatan ?? "-"}
            </DialogDescription>
          </DialogHeader>
          {openRatingFor && user && (
            <RatingForm
              permohonanId={openRatingFor.id}
              pemohonId={user.id}
              sudahRating={false}
              onRatingSubmit={() => {
                setOpenRatingFor(null);
                if (user) loadData(user.id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openWakilFor} onOpenChange={(o) => !o && setOpenWakilFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wakilkan Pengambilan Berkas</DialogTitle>
            <DialogDescription>
              Isi nama dan NIK orang yang akan mewakili Anda mengambil berkas yang sudah selesai di dinas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nama Wakil</label>
              <input
                value={wakilNama}
                onChange={(e) => setWakilNama(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="Nama lengkap sesuai KTP"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">NIK Wakil</label>
              <input
                value={wakilNik}
                onChange={(e) => setWakilNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                inputMode="numeric"
                maxLength={16}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
                placeholder="16 digit NIK"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {openWakilFor?.wakil_ambil_nama && (
              <button
                type="button"
                disabled={savingWakil}
                onClick={async () => {
                  if (!openWakilFor) return;
                  setSavingWakil(true);
                  try {
                    await clearWakilAmbil({ data: { permohonan_id: openWakilFor.id } });
                    toast.success("Wakil dihapus");
                    setOpenWakilFor(null);
                    if (user) loadData(user.id);
                  } catch (e) { toast.error((e as Error).message); }
                  finally { setSavingWakil(false); }
                }}
                className="inline-flex h-9 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Hapus Wakil
              </button>
            )}
            <button
              type="button"
              disabled={savingWakil || !wakilNama.trim() || wakilNik.length !== 16}
              onClick={async () => {
                if (!openWakilFor) return;
                setSavingWakil(true);
                try {
                  await setWakilAmbil({ data: {
                    permohonan_id: openWakilFor.id,
                    nama: wakilNama.trim(),
                    nik: wakilNik,
                  }});
                  toast.success("Wakil tersimpan");
                  setOpenWakilFor(null);
                  if (user) loadData(user.id);
                } catch (e) { toast.error((e as Error).message); }
                finally { setSavingWakil(false); }
              }}
              className="inline-flex h-9 items-center rounded-md bg-gradient-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingWakil ? "Menyimpan…" : "Simpan"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
