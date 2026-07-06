import "server-only";
import { db } from "@/db/client";
import { tests, testGroups, testGroupItems, departments, sampleTypes, paymentModes, testParameters } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

/** Orderable items (active tests + groups) for the billing selector. */
export async function getOrderableCatalog(labId: string) {
  const [testRows, groupRows, groupItems] = await Promise.all([
    db
      .select({
        id: tests.id,
        name: tests.name,
        shortCode: tests.shortCode,
        price: tests.price,
        departmentId: tests.departmentId,
        sampleTypeId: tests.sampleTypeId,
      })
      .from(tests)
      .where(and(eq(tests.labId, labId), eq(tests.isActive, true)))
      .orderBy(asc(tests.name)),
    db
      .select()
      .from(testGroups)
      .where(and(eq(testGroups.labId, labId), eq(testGroups.isActive, true)))
      .orderBy(asc(testGroups.name)),
    db.select().from(testGroupItems),
  ]);

  const itemsByGroup = new Map<string, string[]>();
  for (const it of groupItems) {
    const arr = itemsByGroup.get(it.groupId) ?? [];
    arr.push(it.testId);
    itemsByGroup.set(it.groupId, arr);
  }

  return {
    tests: testRows,
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      price: g.groupPrice,
      pricingMode: g.pricingMode,
      departmentId: g.departmentId,
      testIds: itemsByGroup.get(g.id) ?? [],
    })),
  };
}

export async function getPaymentModes(labId: string) {
  return db
    .select()
    .from(paymentModes)
    .where(and(eq(paymentModes.labId, labId), eq(paymentModes.isActive, true)))
    .orderBy(asc(paymentModes.displayOrder));
}

export async function getDepartments(labId: string) {
  return db.select().from(departments).where(eq(departments.labId, labId)).orderBy(asc(departments.displayOrder));
}

export async function getSampleTypes(labId: string) {
  return db.select().from(sampleTypes).where(eq(sampleTypes.labId, labId)).orderBy(asc(sampleTypes.name));
}

export async function getTestWithParameters(labId: string, testId: string) {
  const test = (await db.select().from(tests).where(and(eq(tests.id, testId), eq(tests.labId, labId)))).at(0);
  if (!test) return null;
  const params = await db
    .select()
    .from(testParameters)
    .where(eq(testParameters.testId, testId))
    .orderBy(asc(testParameters.displayOrder));
  return { test, params };
}
