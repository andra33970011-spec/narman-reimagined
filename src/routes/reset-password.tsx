import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Portal Buton Selatan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password minimal 6 karakter");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password berhasil diperbarui");
    navigate({ to: "/" });
  }

  return (
    <PageShell>
      <section className="container-page py-16">
        <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-soft">
          <h1 className="font-display text-2xl font-bold">Atur Password Baru</h1>
          <input
            type="password"
            required
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password baru"
            className="input"
          />
          <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Menyimpan…" : "Simpan Password"}
          </button>
        </form>
      </section>
    </PageShell>
  );
}
