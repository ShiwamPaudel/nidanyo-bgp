import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { createClient } from "@libsql/client";

/**
 * One-off: flag the departments that are billed but never reported on by this
 * system, so their tests skip sample collection + result entry and their bills
 * carry no report QR.
 *
 *   npx tsx db/set-billing-only-departments.ts --dry
 *   npx tsx db/set-billing-only-departments.ts
 *
 * Matching is case/space-insensitive against the names below. Anything not
 * listed is left reportable. Re-runnable: it just re-asserts the same flags.
 * After this, the flag is editable per-department in Settings → Departments,
 * so it never needs to be run again.
 */

// Names as they actually appear in the catalog. "Doctor Consultation" has no
// possessive apostrophe there, so both spellings are listed rather than relying
// on the normaliser to bridge the difference.
const BILLING_ONLY = [
  "Dental",
  "Procedure",
  "Suture",
  "Radiology",
  "Doctor Consultation",
  "Doctor's Consultation",
  "Physiotherapy",
  "Others",
];

const DRY = process.argv.includes("--dry");
const norm = (s: string) => s.toLowerCase().replace(/[\s'’.-]/g, "");

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

  const rows = (await client.execute("select id, name, billing_only from departments")).rows;
  console.log(`mode: ${DRY ? "DRY-RUN" : "WRITE"}  •  ${rows.length} departments in catalog\n`);

  const wanted = new Set(BILLING_ONLY.map(norm));
  const matched = rows.filter((r) => wanted.has(norm(String(r.name))));
  const matchedNames = new Set(matched.map((r) => norm(String(r.name))));
  const missing = BILLING_ONLY.filter((n) => !matchedNames.has(norm(n)));

  console.log("=== will be BILLING-ONLY ===");
  for (const r of matched) {
    const already = Number(r.billing_only) === 1;
    console.log(`  ${already ? "•" : "→"} ${r.name}${already ? " (already set)" : ""}`);
  }
  console.log("\n=== stays REPORTABLE ===");
  for (const r of rows.filter((r) => !wanted.has(norm(String(r.name))))) console.log(`  • ${r.name}`);

  if (missing.length) {
    console.log("\n! not found in the catalog (check spelling, or the department does not exist yet):");
    for (const m of missing) console.log(`  ? ${m}`);
  }

  if (DRY) {
    console.log(`\nDRY-RUN — would flag ${matched.length} department(s). Re-run without --dry to apply.`);
    process.exit(0);
  }

  if (matched.length === 0) {
    console.log("\nNothing to update.");
    process.exit(0);
  }

  // Explicitly set both directions for the listed names only; untouched
  // departments keep whatever they already have.
  await client.batch(
    matched.map((r) => ({
      sql: "update departments set billing_only = 1 where id = ?",
      args: [r.id],
    })),
    "write",
  );

  const after = (await client.execute("select name, billing_only from departments order by name")).rows;
  console.log("\n=== after ===");
  for (const r of after) console.log(`  ${Number(r.billing_only) === 1 ? "[billing-only]" : "[reportable]  "} ${r.name}`);
  console.log(`\n✓ Flagged ${matched.length} department(s) as billing-only.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
