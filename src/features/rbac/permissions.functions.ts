// Server fn: ambil daftar permission efektif user yang sedang login.
// Sumber kebenaran adalah fungsi SQL get_effective_permissions().
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEffectivePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .rpc("get_effective_permissions", { _user_id: userId });
    if (error) {
      // jangan throw — kembalikan kosong agar UI tetap render
      return { permissions: [] as string[] };
    }
    const permissions = (data ?? [])
      .map((r: { permission_code: string }) => r.permission_code)
      .filter(Boolean);
    return { permissions };
  });
