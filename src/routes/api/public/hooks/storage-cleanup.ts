// Cron hook untuk membersihkan berkas storage lama (bucket: berkas-permohonan).
// Dijalankan setiap jam oleh pg_cron. No-op jika `storage_cleanup_enabled` = false.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/storage-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !service) return new Response("Server misconfigured", { status: 500 });
        if (!apikey || apikey !== anon) return new Response("Unauthorized", { status: 401 });

        const result = await runStorageCleanupServer();
        return Response.json(result);
      },
    },
  },
});

export async function runStorageCleanupServer(): Promise<Record<string, unknown>> {
  const url = process.env.SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: enabledRow } = await admin
    .from("app_setting").select("value").eq("key", "storage_cleanup_enabled").maybeSingle();
  const enabledVal = (enabledRow as { value?: unknown } | null)?.value;
  const enabled = enabledVal === true || enabledVal === "true";
  if (!enabled) return { skipped: true, reason: "disabled" };

  const { data: monthsRow } = await admin
    .from("app_setting").select("value").eq("key", "storage_cleanup_months").maybeSingle();
  const monthsVal = (monthsRow as { value?: unknown } | null)?.value;
  const months = Math.max(1, Math.min(120, Number(monthsVal) || 6));

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const storageAdmin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "storage" as never },
  });

  const { data: objs, error } = await (storageAdmin
    .from("objects" as never) as unknown as {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          lt: (k: string, v: string) => {
            limit: (n: number) => Promise<{ data: { name: string }[] | null; error: { message: string } | null }>;
          };
        };
      };
    })
    .select("name")
    .eq("bucket_id", "berkas-permohonan")
    .lt("created_at", cutoff.toISOString())
    .limit(1000);

  if (error) return { ok: false, error: error.message };
  const paths = (objs ?? []).map((o) => o.name).filter(Boolean);
  if (paths.length === 0) return { ok: true, deleted: 0, cutoff: cutoff.toISOString() };

  const { error: rmErr } = await admin.storage.from("berkas-permohonan").remove(paths);
  if (rmErr) return { ok: false, error: rmErr.message };

  await admin.from("audit_log").insert({
    aksi: "storage.auto_cleanup",
    entitas: "storage",
    data_sesudah: { deleted: paths.length, cutoff: cutoff.toISOString(), months } as never,
  });

  return { ok: true, deleted: paths.length, cutoff: cutoff.toISOString(), months };
}
