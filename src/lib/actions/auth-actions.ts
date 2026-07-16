"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword, dummyHashCompare } from "@/lib/crypto";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitReset, clientIp, retryAfterLabel } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Login throttling. Two buckets, because each stops a different attack:
 *  - per IP+email: slows guessing at one specific account.
 *  - per IP: stops one host spraying one password across many accounts.
 * Successful logins clear the IP+email bucket so a staff member who mistyped a
 * few times isn't locked out once they get it right.
 */
const LOGIN_MAX_PER_ACCOUNT = 5;
const LOGIN_MAX_PER_IP = 20;
const LOGIN_WINDOW_SEC = 15 * 60;

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult> {
  return run(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      return fail("Please check the form and try again.", fe);
    }
    const email = parsed.data.email.trim().toLowerCase();

    // Throttle BEFORE touching the password, so an attacker gets no signal and
    // no bcrypt work out of a blocked attempt.
    const ip = await clientIp();
    const accountKey = `login:${ip}:${email}`;
    const ipKey = `login:ip:${ip}`;
    const [perAccount, perIp] = await Promise.all([
      rateLimit(accountKey, LOGIN_MAX_PER_ACCOUNT, LOGIN_WINDOW_SEC),
      rateLimit(ipKey, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SEC),
    ]);
    if (!perAccount.ok || !perIp.ok) {
      const wait = Math.max(perAccount.retryAfter, perIp.retryAfter);
      return fail(`Too many sign-in attempts. Please try again in ${retryAfterLabel(wait)}.`);
    }

    const user = (await db.select().from(users).where(eq(users.email, email))).at(0);

    // Always spend a bcrypt compare, even when the email is unknown. Returning
    // early there would make "no such user" measurably faster than "wrong
    // password" and turn login into an account-enumeration oracle.
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : await dummyHashCompare(parsed.data.password);

    if (!user || !valid) {
      return fail("Incorrect email or password.");
    }
    if (!user.isActive) {
      return fail("This account is disabled. Please contact your administrator.");
    }

    await rateLimitReset(accountKey);
    await createSession(user.id);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await audit({ ...user, roleName: user.roleKey, permissions: [], roleKey: user.roleKey } as never, "auth.login", {
      entity: "user",
      entityId: user.id,
      summary: `${user.name} signed in`,
    });
    return ok(undefined, "Welcome back!");
  });
}

export async function logoutAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await getCurrentUser();
    if (user) {
      await audit(user, "auth.logout", { entity: "user", entityId: user.id, summary: `${user.name} signed out` });
    }
    await destroySession();
    return ok(undefined);
  });
}
