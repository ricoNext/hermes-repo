import type { SystemRole } from "@/lib/api/types";

export function canManageUsers(role: SystemRole | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
