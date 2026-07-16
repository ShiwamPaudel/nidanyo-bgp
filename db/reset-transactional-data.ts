import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { createClient } from "@libsql/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * One-off: wipe TRANSACTIONAL/workflow data so the lab can start real operations
 * on a clean slate. Backs every affected table up to ./backups/<timestamp>/ first.
 *
 *   npx tsx db/reset-transactional-data.ts --dry     # preview, writes nothing
 *   npx tsx db/reset-transactional-data.ts           # backup + delete
 *
 * KEPT (untouched): patients, labs, lab_settings, users, roles, permissions,
 * departments, sample_types, tests, test_parameters, test_groups, rates,
 * sms_logs, email_logs, audit_logs, activity_logs, app_settings.
 *
 * The `patient` counter is deliberately PRESERVED (it holds 2375 from the legacy
 * import); only visit/bill/sample/payment counters reset to 0.
 */

const DRY = process.argv.includes("--dry");

/**
 * Delete order matters: children before parents, or SQLite/Turso rejects the
 * DELETE with FOREIGN KEY constraint failed.
 */
const DELETE_ORDER = [
  "report_access_logs", // -> report_links
  "report_links", // -> visits
  "report_dispatches", // -> visits
  "result_values", // -> result_entries
  "result_versions", // -> result_entries
  "result_approvals", // -> result_entries
  "result_entries", // -> visits
  "sample_events", // -> samples
  "samples", // -> visits
  "payments", // -> bills
  "bill_items", // -> bills
  "bills", // -> visits, patients
  "visit_tests", // -> visits
  "visits", // -> patients
];

const RESET_COUNTERS = ["visit", "bill", "sample", "payment"];

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

  console.log(`mode: ${DRY ? "DRY-RUN (nothing will be written)" : "WRITE"}\n`);

  // ── Report current state ────────────────────────────────────────────────
  const before: Record<string, number> = {};
  for (const t of DELETE_ORDER) {
    const r = await client.execute(`select count(*) as n from "${t}"`);
    before[t] = Number(r.rows[0].n);
  }
  console.log("=== rows to delete ===");
  for (const t of DELETE_ORDER) console.log(String(before[t]).padStart(7), t);
  const totalRows = Object.values(before).reduce((a, b) => a + b, 0);
  console.log(`  total: ${totalRows}`);

  // Sanity: prove we are not touching preserved data.
  const keep = await client.execute("select count(*) as n from patients");
  console.log(`\npatients (PRESERVED): ${keep.rows[0].n}`);
  const ctrBefore = await client.execute("select entity, value from counters order by entity");
  console.log("counters before:", ctrBefore.rows);

  if (DRY) {
    console.log(`\nDRY-RUN — would back up then delete ${totalRows} rows across ${DELETE_ORDER.length} tables.`);
    console.log(`Counters ${RESET_COUNTERS.join(", ")} would reset to 0; 'patient' counter left as-is.`);
    process.exit(0);
  }

  // ── Backup ──────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("backups", stamp);
  mkdirSync(dir, { recursive: true });
  console.log(`\n=== backing up to ${dir} ===`);
  for (const t of DELETE_ORDER) {
    const r = await client.execute(`select * from "${t}"`);
    writeFileSync(join(dir, `${t}.json`), JSON.stringify(r.rows, null, 2));
    console.log(`  saved ${String(r.rows.length).padStart(6)} rows -> ${t}.json`);
  }
  // Back the counters up too, so the patient counter can be restored if needed.
  const ctrAll = await client.execute("select * from counters");
  writeFileSync(join(dir, "counters.json"), JSON.stringify(ctrAll.rows, null, 2));
  console.log(`  saved ${String(ctrAll.rows.length).padStart(6)} rows -> counters.json`);

  // ── Delete (children -> parents, one transaction) ────────────────────────
  console.log("\n=== deleting ===");
  const stmts = DELETE_ORDER.map((t) => `delete from "${t}"`);
  for (const e of RESET_COUNTERS) {
    stmts.push(`update counters set value = 0 where entity = '${e}'`);
  }
  // batch() runs all statements in a single transaction: all succeed or all roll back.
  await client.batch(stmts, "write");
  for (const t of DELETE_ORDER) console.log(`  cleared ${String(before[t]).padStart(6)} rows from ${t}`);

  // ── Verify ──────────────────────────────────────────────────────────────
  console.log("\n=== verify ===");
  let bad = 0;
  for (const t of DELETE_ORDER) {
    const r = await client.execute(`select count(*) as n from "${t}"`);
    const n = Number(r.rows[0].n);
    if (n !== 0) { console.log(`  ✗ ${t} still has ${n} rows`); bad++; }
  }
  if (bad === 0) console.log("  ✓ all target tables empty");

  const keepAfter = await client.execute("select count(*) as n from patients");
  console.log(`  patients still present: ${keepAfter.rows[0].n}`);
  const ctrAfter = await client.execute("select entity, value from counters order by entity");
  console.log("  counters after:", ctrAfter.rows);
  console.log(`\n✓ Done. Backup: ${dir}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n✗ FAILED — nothing was committed if the batch failed.\n", e);
  process.exit(1);
});
