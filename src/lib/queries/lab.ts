import "server-only";
import { cache } from "react";
import { db } from "@/db/client";
import { labs, labSettings, labAssets } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const getLab = cache(async (labId: string) => {
  const lab = (await db.select().from(labs).where(eq(labs.id, labId))).at(0);
  const settings = (await db.select().from(labSettings).where(eq(labSettings.labId, labId))).at(0);
  return { lab, settings };
});

/** Resolve the active asset url for a given kind (header/footer/logo). */
export async function getLabAsset(labId: string, kind: string) {
  const row = (
    await db
      .select()
      .from(labAssets)
      .where(and(eq(labAssets.labId, labId), eq(labAssets.kind, kind as never), eq(labAssets.isActive, true)))
  ).at(0);
  return row ?? null;
}

export async function getAssetById(id: string) {
  return (await db.select().from(labAssets).where(eq(labAssets.id, id))).at(0) ?? null;
}
