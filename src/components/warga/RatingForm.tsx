// src/components/warga/RatingForm.tsx
import { useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  permohonanId: string;
  pemohonId: string;
  sudahRating: boolean;
  onRatingSubmit?: () => void;
};

export function RatingForm({ permohonanId, pemohonId, sudahRating, onRatingSubmit }: Props) {
  const [skor, setSkor] = useState(0);
  const [hover, setHover] = useState(0);
  const [komentar, setKomentar] = useState("");
  const [loading, setLoading] = useState(false);

  if (sudahRating) {
    return (
      <div className="mt-4 rounded-lg bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <ThumbsUp className="mx-auto mb-2 h-6 w-6 text-success" />
        Terima kasih! Anda sudah memberi rating untuk permohonan ini.
      </div>
    );
  }

  async function submitRating() {
    if (skor === 0) {
      toast.error("Pilih bintang untuk memberi rating");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("permohonan_rating").insert({
      permohonan_id: permohonanId,
      user_id: pemohonId,
      skor,
      komentar: komentar.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Rating berhasil disimpan. Terima kasih atas masukannya!");
      onRatingSubmit?.();
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft">
      <h3 className="font-display text-base font-semibold">Berikan Penilaian</h3>
      <p className="text-sm text-muted-foreground">
        Seberapa puas Anda dengan layanan ini?
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setSkor(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none"
          >
            <Star
              className={`h-7 w-7 transition-all ${
                (hover || skor) >= star
                  ? "fill-gold text-gold"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
      {skor > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">{skor}/10 bintang</div>
      )}

      <textarea
        rows={3}
        value={komentar}
        onChange={(e) => setKomentar(e.target.value)}
        placeholder="Tulis komentar/saran (opsional)..."
        className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        maxLength={500}
      />

      <button
        onClick={submitRating}
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Menyimpan..." : "Kirim Rating"}
      </button>
    </div>
  );
}
