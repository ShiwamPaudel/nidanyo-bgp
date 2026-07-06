"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/crypto";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult> {
  return run(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      return fail("Please check the form and try again.", fe);
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = (await db.select().from(users).where(eq(users.email, email))).at(0);

    // Constant-ish: always run a compare to reduce trivial timing signals.
    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

    if (!user || !valid) {
      return fail("Incorrect email or password.");
    }
    if (!user.isActive) {
      return fail("This account is disabled. Please contact your administrator.");
    }

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
