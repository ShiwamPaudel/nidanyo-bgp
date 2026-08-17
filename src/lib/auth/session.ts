import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db/client";
import { sessions, users, roles, labSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { setServerCalendar } from "@/lib/datetime";

const COOKIE_NAME = "nidanyo_session";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Fail closed in production; allow a dev fallback so first boot works.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is not configured");
    }
    return new TextEncoder().encode("nidanyo-dev-secret-change-me-please-32x");
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  labId: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  designation: string | null;
  permissions: PermissionKey[];
}

/** Create a server-side session row + signed cookie. */
export async function createSession(userId: string, meta?: { ip?: string; ua?: string }) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      ip: meta?.ip,
      userAgent: meta?.ua,
      expiresAt,
      createdAt: new Date(),
    })
    .returning({ id: sessions.id });

  const token = await new SignJWT({ sid: row.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return row.id;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.sid) {
        await db.delete(sessions).where(eq(sessions.id, payload.sid as string));
      }
    } catch {
      /* ignore */
    }
  }
  jar.delete(COOKIE_NAME);
}

/**
 * Resolve the current authenticated user from the session cookie.
 * Returns null if missing/expired/invalid. Memoized per request via React cache
 * so concurrent requests/users never share state.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const sid = payload.sid as string;

    // One round trip instead of four. Every hop here is a primary-key lookup
    // that hangs off the session row (session → user → role, plus the lab's
    // calendar preference), so they resolve as a single join rather than four
    // sequential requests to Turso. The joins are LEFT so a missing role or
    // lab_settings row behaves exactly as before — roleName falls back to the
    // user's roleKey, permissions to none, calendar to AD.
    const row = (
      await db
        .select({
          expiresAt: sessions.expiresAt,
          user: users,
          roleName: roles.name,
          rolePermissions: roles.permissions,
          calendarSystem: labSettings.calendarSystem,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .leftJoin(roles, eq(roles.id, users.roleId))
        .leftJoin(labSettings, eq(labSettings.labId, users.labId))
        .where(eq(sessions.id, sid))
    ).at(0);

    if (!row || row.expiresAt.getTime() < Date.now()) return null;
    const user = row.user;
    if (!user || !user.isActive) return null;

    // Set the ambient display calendar (AD/BS) for this request from the lab setting.
    setServerCalendar((row.calendarSystem as "AD" | "BS") ?? "AD");

    return {
      id: user.id,
      labId: user.labId,
      name: user.name,
      email: user.email,
      roleKey: user.roleKey,
      roleName: row.roleName ?? user.roleKey,
      designation: user.designation ?? null,
      permissions: (row.rolePermissions ?? []) as PermissionKey[],
    };
  } catch {
    return null;
  }
});
