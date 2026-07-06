import "server-only";
import { db } from "@/db/client";
import { auditLogs, activityLogs } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

/** Record a security-sensitive action (cancellations, user/role changes…). */
export async function audit(
  actor: SessionUser | null,
  action: string,
  opts: {
    entity?: string;
    entityId?: string;
    summary?: string;
    meta?: Record<string, unknown>;
  } = {},
) {
  try {
    await db.insert(auditLogs).values({
      labId: actor?.labId,
      actorId: actor?.id,
      actorName: actor?.name,
      action,
      entity: opts.entity,
      entityId: opts.entityId,
      summary: opts.summary,
      meta: opts.meta ?? null,
    });
  } catch {
    // Never let audit failures break the main flow.
  }
}

/** Record a lightweight activity-feed entry shown on dashboards. */
export async function activity(
  actor: SessionUser | null,
  type: string,
  message: string,
  opts: { entity?: string; entityId?: string } = {},
) {
  if (!actor) return;
  try {
    await db.insert(activityLogs).values({
      labId: actor.labId,
      actorId: actor.id,
      actorName: actor.name,
      type,
      message,
      entity: opts.entity,
      entityId: opts.entityId,
    });
  } catch {
    /* ignore */
  }
}
