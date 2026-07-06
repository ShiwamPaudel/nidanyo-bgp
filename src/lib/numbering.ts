import "server-only";
import { db } from "@/db/client";
import { counters, labSettings } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { formatCode } from "@/lib/utils";

type Entity = "patient" | "visit" | "bill" | "sample" | "payment";

const PREFIX_FALLBACK: Record<Entity, string> = {
  patient: "P",
  visit: "V",
  bill: "B",
  sample: "S",
  payment: "R",
};

/**
 * Atomically increment the per-lab counter for an entity and return the next
 * human-readable code (e.g. "V-000123"). Uses an UPSERT + UPDATE…RETURNING so
 * concurrent callers never collide.
 */
export async function nextCode(labId: string, entity: Entity): Promise<string> {
  // Ensure a row exists.
  await db
    .insert(counters)
    .values({ labId, entity, period: "all", value: 0 })
    .onConflictDoNothing();

  const rows = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1` })
    .where(and(eq(counters.labId, labId), eq(counters.entity, entity), eq(counters.period, "all")))
    .returning({ value: counters.value });

  const value = rows[0]?.value ?? 1;

  // Resolve configured prefix (cheap; cached by libSQL).
  const settings = (await db.select().from(labSettings).where(eq(labSettings.labId, labId))).at(0);
  const prefix =
    entity === "patient"
      ? settings?.patientPrefix
      : entity === "visit"
        ? settings?.visitPrefix
        : entity === "bill"
          ? settings?.billPrefix
          : entity === "sample"
            ? settings?.samplePrefix
            : PREFIX_FALLBACK[entity];

  return formatCode(prefix || PREFIX_FALLBACK[entity], value);
}
