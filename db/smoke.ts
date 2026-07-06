/**
 * Runtime smoke test for the data layer — exercises the trickiest SQL the app
 * relies on (aggregations, subqueries, date bucketing) against the seeded DB to
 * confirm none of the raw `sql` fragments are malformed. Not a substitute for UI
 * testing, but catches SQL errors that typecheck/build cannot.
 */
import { config } from "dotenv";
// Load .env.local first (takes precedence, mirrors Next.js), then .env fills gaps.
config({ path: ".env.local" });
config({ path: ".env" });
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { and, eq, sql, desc } from "drizzle-orm";
import * as schema from "../src/db/schema";

async function main() {
  const client = createClient({ url: process.env.DATABASE_URL || "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  const db = drizzle(client, { schema });
  const lab = (await db.select().from(schema.labs).limit(1)).at(0);
  if (!lab) throw new Error("No lab seeded");
  const labId = lab.id;
  let pass = 0;

  async function check(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      pass++;
    } catch (e) {
      console.error(`  ✗ ${name}:`, (e as Error).message);
      throw e;
    }
  }

  // Dashboard aggregations
  await check("dashboard: today billed/due sum", () =>
    db.select({ total: sql<number>`coalesce(sum(${schema.bills.grandTotal}),0)`, due: sql<number>`coalesce(sum(${schema.bills.dueAmount}),0)` }).from(schema.bills).where(eq(schema.bills.labId, labId)),
  );
  await check("dashboard: revenue trend (date bucket)", () =>
    db.select({ day: sql<string>`date(${schema.payments.paidAt}, 'unixepoch', 'localtime')`, total: sql<number>`coalesce(sum(${schema.payments.amount}),0)` }).from(schema.payments).where(eq(schema.payments.labId, labId)).groupBy(sql`date(${schema.payments.paidAt}, 'unixepoch', 'localtime')`),
  );
  await check("dashboard: top tests (group + order)", () =>
    db.select({ name: schema.visitTests.testName, n: sql<number>`count(*)` }).from(schema.visitTests).innerJoin(schema.visits, eq(schema.visitTests.visitId, schema.visits.id)).where(eq(schema.visits.labId, labId)).groupBy(schema.visitTests.testName).orderBy(desc(sql`count(*)`)).limit(6),
  );
  // Patient suggest subquery
  await check("patients: visit-count subquery", () =>
    db.select({ id: schema.patients.id, visits: sql<number>`(select count(*) from visits where visits.patient_id = ${schema.patients.id})` }).from(schema.patients).where(eq(schema.patients.labId, labId)).limit(5),
  );
  // Result queue grouped aggregation
  await check("results: queue group/having", () =>
    db.select({ visitId: schema.resultEntries.visitId, total: sql<number>`count(*)`, pending: sql<number>`sum(case when ${schema.resultEntries.status} in ('pending','draft') then 1 else 0 end)` }).from(schema.resultEntries).innerJoin(schema.visits, eq(schema.resultEntries.visitId, schema.visits.id)).where(eq(schema.resultEntries.labId, labId)).groupBy(schema.resultEntries.visitId),
  );
  // Finance EOD case sums
  await check("finance: EOD case aggregation", () =>
    db.select({ collected: sql<number>`coalesce(sum(case when ${schema.payments.kind} != 'refund' then ${schema.payments.amount} else 0 end),0)`, due: sql<number>`coalesce(sum(case when ${schema.payments.kind} = 'due_collection' then ${schema.payments.amount} else 0 end),0)` }).from(schema.payments).where(eq(schema.payments.labId, labId)),
  );
  // Dispatch correlated subqueries
  await check("dispatch: correlated subqueries", () =>
    db.select({ visitId: schema.visits.id, sms: sql<number>`(select count(*) from sms_logs where sms_logs.visit_id = ${schema.visits.id})`, disp: sql<number>`(select count(*) from report_dispatches where report_dispatches.visit_id = ${schema.visits.id})` }).from(schema.visits).where(eq(schema.visits.labId, labId)).limit(5),
  );
  // Numbering counter upsert + update returning
  await check("numbering: counter upsert + returning", async () => {
    await db.insert(schema.counters).values({ labId, entity: "smoke", period: "all", value: 0 }).onConflictDoNothing();
    const r = await db.update(schema.counters).set({ value: sql`${schema.counters.value} + 1` }).where(and(eq(schema.counters.labId, labId), eq(schema.counters.entity, "smoke"), eq(schema.counters.period, "all"))).returning({ value: schema.counters.value });
    if (!r[0]?.value) throw new Error("no value returned");
    await db.delete(schema.counters).where(and(eq(schema.counters.labId, labId), eq(schema.counters.entity, "smoke")));
  });

  // Dashboard: peak hours (strftime) + revenue by doctor (coalesce/nullif)
  await check("dashboard: peak hours (strftime bucket)", () =>
    db.select({ hour: sql<string>`strftime('%H', ${schema.visits.visitDate}, 'unixepoch', 'localtime')`, n: sql<number>`count(*)` }).from(schema.visits).where(eq(schema.visits.labId, labId)).groupBy(sql`strftime('%H', ${schema.visits.visitDate}, 'unixepoch', 'localtime')`),
  );
  await check("dashboard: revenue by doctor (coalesce/nullif)", () =>
    db.select({ doctor: sql<string>`coalesce(nullif(${schema.visits.referredBy}, ''), 'Self / Walk-in')`, rev: sql<number>`coalesce(sum(${schema.bills.grandTotal}),0)` }).from(schema.bills).innerJoin(schema.visits, eq(schema.bills.visitId, schema.visits.id)).where(eq(schema.bills.labId, labId)).groupBy(sql`coalesce(nullif(${schema.visits.referredBy}, ''), 'Self / Walk-in')`),
  );

  console.log(`\nAll ${pass} data-layer checks passed.`);
  client.close();
}

main().catch((e) => {
  console.error("\nSmoke test FAILED:", e);
  process.exit(1);
});
