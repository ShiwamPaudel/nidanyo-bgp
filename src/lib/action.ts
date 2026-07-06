import "server-only";

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
 */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
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
