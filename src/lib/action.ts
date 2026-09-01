import "server-only";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";

/**
 * Standard server-action result. Never leak technical details to the UI —
 * `error` is always a human-friendly sentence.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Wrap an action body so thrown errors become friendly messages. Known
 * (authorization/validation) errors pass through their message; unknown errors
 * surface a generic line and are logged for developers only.
 *
 * A successful action also flushes the cached operational counts (sidebar
 * badges, today's dashboard figures) — see src/lib/cache.ts.
 */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const result = await fn();
    // Every mutation in the app funnels through here, so this is the one place
    // that cannot forget to flush the cached operational counts. Hooking it
    // centrally (rather than per action) means a badge is never stale after
    // work you just did, and a new action added later inherits it for free.
    // Over-invalidating is deliberate: the cost is one recomputed count, and
    // the alternative is a queue that silently disagrees with its badge.
    if (result.ok) {
      try {
        revalidateTag(CACHE_TAGS.ops);
      } catch {
        /* outside a revalidatable context — the TTL still covers it */
      }
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Authorization / validation errors are safe to show.
    const safe =
      message &&
      (message.includes("permission") ||
        message.includes("session") ||
        message.includes("not found") ||
        message.includes("already") ||
        message.startsWith("Please"));
    if (!safe) {
      console.error("[action error]", err);
      return fail("Something went wrong. Please try again.");
    }
    return fail(message);
  }
}
