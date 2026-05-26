// Server-side guard utilities. Pakai di handler createServerFn untuk menolak
// akses sebelum query. RLS tetap menjadi backstop.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Permission } from "./constants";

type SB = SupabaseClient<Database>;

export async function userHasPermission(
  supabase: SB,
  userId: string,
  code: Permission,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _code: code,
  });
  if (error) return false;
  return Boolean(data);
}

export async function requirePermissionOrThrow(
  supabase: SB,
  userId: string,
  code: Permission,
): Promise<void> {
  const ok = await userHasPermission(supabase, userId, code);
  if (!ok) throw new Error(`Akses ditolak: izin '${code}' tidak dimiliki.`);
}
