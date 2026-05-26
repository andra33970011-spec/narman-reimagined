// Hook konsumsi permission dari AuthProvider.
import { useAuth } from "@/lib/auth-context";
import type { Permission } from "./constants";

export function usePermissions(): Set<string> {
  return useAuth().permissions ?? new Set<string>();
}

export function useCan(permission: Permission | Permission[]): boolean {
  const { isSuperAdmin, permissions } = useAuth();
  if (isSuperAdmin) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => permissions.has(p));
}

export function useCanAll(permissions: Permission[]): boolean {
  const { isSuperAdmin, permissions: perms } = useAuth();
  if (isSuperAdmin) return true;
  return permissions.every((p) => perms.has(p));
}
