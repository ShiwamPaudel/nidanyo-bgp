import "server-only";
import { db } from "@/db/client";
import { tests, testParameters, testGroups, testGroupItems, departments, sampleTypes } from "@/db/schema";
import { and, asc, eq, like, or, sql } from "drizzle-orm";

export async function listTestsAdmin(labId: string, q?: string) {
  const term = q?.trim() ? `%${q.trim()}%` : null;
  const where = and(eq(tests.labId, labId), term ? or(like(tests.name, term), like(tests.shortCode, term)) : undefined);
  return (
    await db
      .select({
        id: tests.id,
        name: tests.name,
        shortCode: tests.shortCode,
        price: tests.price,
        resultType: tests.resultType,
        isActive: tests.isActive,
        deptName: departments.name,
        sampleName: sampleTypes.name,
        paramCount: sql<number>`(select count(*) from test_parameters where test_parameters.test_id = ${tests.id})`,
      })
      .from(tests)
      .leftJoin(departments, eq(tests.departmentId, departments.id))
      .leftJoin(sampleTypes, eq(tests.sampleTypeId, sampleTypes.id))
      .where(where)
      .orderBy(asc(tests.name))
      .limit(500)
  ).map((r) => ({ ...r, paramCount: Number(r.paramCount) }));
}

export async function getTestForEdit(labId: string, id: string) {
  const test = (await db.select().from(tests).where(and(eq(tests.id, id), eq(tests.labId, labId)))).at(0);
  if (!test) return null;
  const params = await db.select().from(testParameters).where(eq(testParameters.testId, id)).orderBy(asc(testParameters.displayOrder));
  return { test, params };
}

export async function listGroupsAdmin(labId: string, q?: string) {
  const term = q?.trim() ? `%${q.trim()}%` : null;
  const where = and(eq(testGroups.labId, labId), term ? like(testGroups.name, term) : undefined);
  const groups = await db.select().from(testGroups).where(where).orderBy(asc(testGroups.name)).limit(300);
  const items = await db.select().from(testGroupItems);
  const itemsByGroup = new Map<string, number>();
  for (const it of items) itemsByGroup.set(it.groupId, (itemsByGroup.get(it.groupId) ?? 0) + 1);
  return groups.map((g) => ({ ...g, memberCount: itemsByGroup.get(g.id) ?? 0 }));
}

export async function getGroupForEdit(labId: string, id: string) {
  const group = (await db.select().from(testGroups).where(and(eq(testGroups.id, id), eq(testGroups.labId, labId)))).at(0);
  if (!group) return null;
  const items = await db.select().from(testGroupItems).where(eq(testGroupItems.groupId, id)).orderBy(asc(testGroupItems.displayOrder));
  return { group, testIds: items.map((i) => i.testId) };
}
