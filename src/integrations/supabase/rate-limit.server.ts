import { supabaseAdmin } from "./client.server";

export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - windowSec * 1000).toISOString();
  try {
    const { data: existing } = await supabaseAdmin
      .from("rate_limit")
      .select("id,count,window_start")
      .eq("identifier", identifier)
      .eq("bucket", bucket)
      .gte("window_start", windowStart)
      .maybeSingle();
    if (existing) {
      if ((existing.count ?? 0) >= limit) return { ok: false, remaining: 0 };
      await supabaseAdmin
        .from("rate_limit")
        .update({ count: (existing.count ?? 0) + 1 })
        .eq("id", existing.id);
      return { ok: true, remaining: limit - (existing.count ?? 0) - 1 };
    }
    await supabaseAdmin
      .from("rate_limit")
      .insert({ identifier, bucket, count: 1, window_start: new Date().toISOString() });
    return { ok: true, remaining: limit - 1 };
  } catch {
    return { ok: true, remaining: limit };
  }
}
