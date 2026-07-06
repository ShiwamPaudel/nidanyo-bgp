import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";
import type { PermissionKey } from "@/lib/rbac/permissions";

export function hasPermission(user: SessionUser | null, perm: PermissionKey): boolean {
  if (!user) return false;
  // super_admin / lab_admin hold every permission via seeded role.
  return user.permissions.includes(perm);
}

export function hasAny(user: SessionUser | null, perms: PermissionKey[]): boolean {
  if (!user) return false;
  return perms.some((p) => user.permissions.includes(p));
}

/** Require a logged-in user (for layouts / pages). Redirects to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a specific permission. Redirects to /login or /403. */
export async function requirePermission(perm: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, perm)) redirect("/no-access");
  return user;
}

/**
 * For server actions: throw on failure (caught and surfaced as a friendly
 * message). Never redirects.
 */
export async function authorize(perm: PermissionKey): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Your session has expired. Please sign in again.");
  if (!hasPermission(user, perm)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return user;
}
