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
    const session = (await db.select().from(sessions).where(eq(sessions.id, sid))).at(0);
    if (!session || session.expiresAt.getTime() < Date.now()) return null;

    const user = (await db.select().from(users).where(eq(users.id, session.userId))).at(0);
    if (!user || !user.isActive) return null;

    const role = (await db.select().from(roles).where(eq(roles.id, user.roleId))).at(0);

    // Set the ambient display calendar (AD/BS) for this request from the lab setting.
    const setting = (await db.select({ cal: labSettings.calendarSystem }).from(labSettings).where(eq(labSettings.labId, user.labId))).at(0);
    setServerCalendar((setting?.cal as "AD" | "BS") ?? "AD");

    return {
      id: user.id,
      labId: user.labId,
      name: user.name,
      email: user.email,
      roleKey: user.roleKey,
      roleName: role?.name ?? user.roleKey,
      designation: user.designation ?? null,
      permissions: (role?.permissions ?? []) as PermissionKey[],
    };
  } catch {
    return null;
  }
});
