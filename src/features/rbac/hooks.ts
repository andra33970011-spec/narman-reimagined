// Hook konsumsi permission dari AuthProvider. Komponen baru pakai useCan().
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "./constants";

export function usePermissions(): Set<string> {
  return useAuth().permissions ?? new Set<string>();
}

export function useCan(permission: Permission | Permission[]): boolean {
  const perms = usePermissions();
  const list = Array.isArray(permission) ? permission : [permission];
  // super_admin selalu true (defensive — biasanya sudah ada via seed)
  if (useAuth().isSuperAdmin) return true;
  return list.some((p) => perms.has(p));
}

export function useCanAll(permissions: Permission[]): boolean {
  const perms = usePermissions();
  if (useAuth().isSuperAdmin) return true;
  return permissions.every((p) => perms.has(p));
}
