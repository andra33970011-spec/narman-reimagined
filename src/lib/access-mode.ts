// Helper untuk mode akses menu publik: "public" (tanpa login) atau "auth" (perlu login).
// Setting disimpan di app_setting dengan key terkait, value berbentuk { mode: "public" | "auth" }.
// Kompatibilitas mundur: nilai legacy `true` → "public", `false` → "auth".
import { supabase } from "@/integrations/supabase/client";

export type AccessMode = "public" | "auth";

export type AccessSettingKey = "data_terpadu_visible_public" | "kinerja_opd_visible_public";

export function parseAccessMode(value: unknown): AccessMode {
  if (value === true || value === "true") return "public";
  if (value === false || value === "false") return "auth";
  if (typeof value === "object" && value !== null) {
    const m = (value as { mode?: unknown }).mode;
    if (m === "auth") return "auth";
    if (m === "public") return "public";
  }
  return "public";
}

export async function getAccessMode(key: AccessSettingKey): Promise<AccessMode> {
  const { data } = await supabase
    .from("app_setting")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return parseAccessMode(data?.value);
}

export async function setAccessMode(key: AccessSettingKey, mode: AccessMode): Promise<void> {
  const { error } = await supabase
    .from("app_setting")
    .upsert({ key, value: { mode } as unknown as never }, { onConflict: "key" });
  if (error) throw error;
}
