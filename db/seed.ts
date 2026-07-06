import { config } from "dotenv";
// Load .env.local first (takes precedence, mirrors Next.js), then .env fills gaps.
config({ path: ".env.local" });
config({ path: ".env" });
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as schema from "../src/db/schema";
import { DEFAULT_ROLES } from "../src/lib/rbac/roles";

const id = () => randomUUID();

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const db = drizzle(client, { schema });

  const labName = process.env.SEED_LAB_NAME || "Demo Diagnostic Laboratory";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@nidanyo.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

  console.log("Seeding Nidanyo…");

  // ── Lab ────────────────────────────────────────────────────────────────
  let lab = (await db.select().from(schema.labs).limit(1)).at(0);
  if (!lab) {
    const labId = id();
    await db.insert(schema.labs).values({
      id: labId,
      name: labName,
      code: "demo",
      isActive: true,
    });
    await db.insert(schema.labSettings).values({
      id: id(),
      labId,
      address: "Putalisadak, Kathmandu, Nepal",
      phone: "+977-1-4000000",
      email: "info@demolab.com",
      currency: "NPR",
      shortLinkBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });
    lab = (await db.select().from(schema.labs).where(eq(schema.labs.id, labId))).at(0);
    console.log("  ✓ Lab created:", labName);
  } else {
    console.log("  • Lab already exists:", lab.name);
  }
  const labId = lab!.id;

  // ── Roles ──────────────────────────────────────────────────────────────
  const roleIdByKey: Record<string, string> = {};
  for (const r of DEFAULT_ROLES) {
    const existing = (
      await db.select().from(schema.roles).where(eq(schema.roles.key, r.key))
    ).at(0);
    if (existing) {
      roleIdByKey[r.key] = existing.id;
      continue;
    }
    const rid = id();
    await db.insert(schema.roles).values({
      id: rid,
      labId: r.key === "super_admin" ? null : labId,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.isSystem,
      isActive: true,
    });
    roleIdByKey[r.key] = rid;
  }
  console.log("  ✓ Roles ready:", Object.keys(roleIdByKey).length);

  // ── Admin user ─────────────────────────────────────────────────────────
  const existingAdmin = (
    await db.select().from(schema.users).where(eq(schema.users.email, adminEmail))
  ).at(0);
  if (!existingAdmin) {
    await db.insert(schema.users).values({
      id: id(),
      labId,
      name: "Lab Administrator",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      roleId: roleIdByKey["lab_admin"],
      roleKey: "lab_admin",
      designation: "Administrator",
      isActive: true,
    });
    console.log(`  ✓ Admin user: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("  • Admin user already exists:", adminEmail);
  }

  // ── Demo staff (one per role) for testing permissions ───────────────────
  const demoStaff: { name: string; email: string; roleKey: string; designation?: string }[] = [
    { name: "Reena Reception", email: "reception@nidanyo.local", roleKey: "reception" },
    { name: "Sita Sample", email: "sample@nidanyo.local", roleKey: "sample_collection" },
    { name: "Tara Technician", email: "tech@nidanyo.local", roleKey: "lab_technician" },
    {
      name: "Dr. Pranav Pathologist",
      email: "pathologist@nidanyo.local",
      roleKey: "pathologist",
      designation: "MD, Pathologist",
    },
    { name: "Anil Accounts", email: "accounts@nidanyo.local", roleKey: "accounts" },
    { name: "Deepak Dispatch", email: "dispatch@nidanyo.local", roleKey: "dispatch" },
  ];
  for (const s of demoStaff) {
    const exists = (
      await db.select().from(schema.users).where(eq(schema.users.email, s.email))
    ).at(0);
    if (exists) continue;
    await db.insert(schema.users).values({
      id: id(),
      labId,
      name: s.name,
      email: s.email,
      passwordHash: await bcrypt.hash("Staff@12345", 10),
      roleId: roleIdByKey[s.roleKey],
      roleKey: s.roleKey,
      designation: s.designation,
      isActive: true,
    });
  }
  console.log("  ✓ Demo staff ready (password: Staff@12345)");

  // ── Departments ──────────────────────────────────────────────────────────
  const deptNames = ["Hematology", "Biochemistry", "Serology", "Microbiology", "Clinical Pathology"];
  const deptId: Record<string, string> = {};
  for (let i = 0; i < deptNames.length; i++) {
    const name = deptNames[i];
    const ex = (
      await db.select().from(schema.departments).where(eq(schema.departments.name, name))
    ).at(0);
    if (ex) {
      deptId[name] = ex.id;
      continue;
    }
    const d = id();
    await db.insert(schema.departments).values({ id: d, labId, name, displayOrder: i });
    deptId[name] = d;
  }

  // ── Sample types ─────────────────────────────────────────────────────────
  const sampleTypeDefs = [
    { name: "Blood (EDTA)", color: "#B91C1C" },
    { name: "Serum", color: "#D97706" },
    { name: "Plasma", color: "#16A34A" },
    { name: "Urine", color: "#CA8A04" },
    { name: "Stool", color: "#92400E" },
    { name: "Swab", color: "#2563EB" },
  ];
  const sampleTypeId: Record<string, string> = {};
  for (const st of sampleTypeDefs) {
    const ex = (
      await db.select().from(schema.sampleTypes).where(eq(schema.sampleTypes.name, st.name))
    ).at(0);
    if (ex) {
      sampleTypeId[st.name] = ex.id;
      continue;
    }
    const s = id();
    await db.insert(schema.sampleTypes).values({ id: s, labId, name: st.name, colorHex: st.color });
    sampleTypeId[st.name] = s;
  }

  // ── Payment modes ────────────────────────────────────────────────────────
  const modes: { name: string; category: "cash" | "digital" | "card" | "bank" | "other" }[] = [
    { name: "Cash", category: "cash" },
    { name: "eSewa", category: "digital" },
    { name: "Khalti", category: "digital" },
    { name: "QR / Fonepay", category: "digital" },
    { name: "Card", category: "card" },
    { name: "Bank Transfer", category: "bank" },
  ];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const ex = (
      await db.select().from(schema.paymentModes).where(eq(schema.paymentModes.name, m.name))
    ).at(0);
    if (ex) continue;
    await db.insert(schema.paymentModes).values({
      id: id(),
      labId,
      name: m.name,
      category: m.category,
      displayOrder: i,
    });
  }

  // ── Tests + parameters ───────────────────────────────────────────────────
  const testIdByCode: Record<string, string> = {};
  async function addTest(t: {
    name: string;
    code: string;
    dept: string;
    sample: string;
    price: number;
    resultType?: "numeric" | "text" | "select" | "pos_neg" | "multi";
    unit?: string;
    refLow?: number;
    refHigh?: number;
    refText?: string;
    criticalLow?: number;
    criticalHigh?: number;
    method?: string;
    description?: string;
    tatHours?: number;
    params?: {
      name: string;
      unit?: string;
      refLow?: number;
      refHigh?: number;
      refText?: string;
      criticalLow?: number;
      criticalHigh?: number;
      resultType?: "numeric" | "text" | "select" | "pos_neg";
      options?: string[];
    }[];
  }) {
    const ex = (
      await db.select().from(schema.tests).where(eq(schema.tests.shortCode, t.code))
    ).at(0);
    if (ex) {
      testIdByCode[t.code] = ex.id;
      return;
    }
    const tid = id();
    await db.insert(schema.tests).values({
      id: tid,
      labId,
      name: t.name,
      shortCode: t.code,
      departmentId: deptId[t.dept],
      sampleTypeId: sampleTypeId[t.sample],
      price: t.price,
      method: t.method,
      description: t.description,
      unit: t.unit,
      resultType: t.resultType ?? (t.params ? "multi" : "numeric"),
      refLow: t.refLow,
      refHigh: t.refHigh,
      refRangeText: t.refText,
      criticalLow: t.criticalLow,
      criticalHigh: t.criticalHigh,
      tatHours: t.tatHours ?? 24,
    });
    testIdByCode[t.code] = tid;
    if (t.params) {
      for (let i = 0; i < t.params.length; i++) {
        const p = t.params[i];
        await db.insert(schema.testParameters).values({
          id: id(),
          testId: tid,
          name: p.name,
          unit: p.unit,
          resultType: p.resultType ?? "numeric",
          selectOptions: p.options,
          refLow: p.refLow,
          refHigh: p.refHigh,
          refRangeText: p.refText,
          criticalLow: p.criticalLow,
          criticalHigh: p.criticalHigh,
          displayOrder: i,
        });
      }
    }
  }

  await addTest({
    name: "Complete Blood Count (CBC)",
    code: "CBC",
    dept: "Hematology",
    sample: "Blood (EDTA)",
    price: 600,
    method: "Automated Analyzer",
    description:
      "This test is performed on an advanced hematology analyzer using ScatterFlow technology. Results should be correlated clinically.",
    params: [
      { name: "Hemoglobin", unit: "g/dL", refLow: 13, refHigh: 17, criticalLow: 7, criticalHigh: 20 },
      { name: "Total WBC Count", unit: "cells/cmm", refLow: 4000, refHigh: 11000, criticalLow: 2000, criticalHigh: 30000 },
      { name: "RBC Count", unit: "million/cmm", refLow: 4.5, refHigh: 5.9 },
      { name: "Platelet Count", unit: "/cmm", refLow: 150000, refHigh: 410000, criticalLow: 20000, criticalHigh: 1000000 },
      { name: "Hematocrit (PCV)", unit: "%", refLow: 40, refHigh: 50 },
      { name: "Neutrophils", unit: "%", refLow: 40, refHigh: 75 },
      { name: "Lymphocytes", unit: "%", refLow: 20, refHigh: 45 },
      { name: "Monocytes", unit: "%", refLow: 2, refHigh: 10 },
      { name: "Eosinophils", unit: "%", refLow: 1, refHigh: 6 },
      { name: "Basophils", unit: "%", refLow: 0, refHigh: 2 },
    ],
  });

  await addTest({
    name: "Liver Function Test (LFT)",
    code: "LFT",
    dept: "Biochemistry",
    sample: "Serum",
    price: 1200,
    params: [
      { name: "Total Bilirubin", unit: "mg/dL", refLow: 0.2, refHigh: 1.2 },
      { name: "Direct Bilirubin", unit: "mg/dL", refLow: 0, refHigh: 0.3 },
      { name: "SGPT (ALT)", unit: "U/L", refLow: 0, refHigh: 45 },
      { name: "SGOT (AST)", unit: "U/L", refLow: 0, refHigh: 40 },
      { name: "Alkaline Phosphatase", unit: "U/L", refLow: 40, refHigh: 129 },
      { name: "Total Protein", unit: "g/dL", refLow: 6.4, refHigh: 8.3 },
      { name: "Albumin", unit: "g/dL", refLow: 3.5, refHigh: 5.2 },
    ],
  });

  await addTest({
    name: "Renal Function Test (RFT)",
    code: "RFT",
    dept: "Biochemistry",
    sample: "Serum",
    price: 1100,
    params: [
      { name: "Urea", unit: "mg/dL", refLow: 15, refHigh: 40 },
      { name: "Creatinine", unit: "mg/dL", refLow: 0.6, refHigh: 1.3, criticalHigh: 5 },
      { name: "Uric Acid", unit: "mg/dL", refLow: 3.5, refHigh: 7.2 },
      { name: "Sodium", unit: "mmol/L", refLow: 135, refHigh: 145, criticalLow: 120, criticalHigh: 160 },
      { name: "Potassium", unit: "mmol/L", refLow: 3.5, refHigh: 5.1, criticalLow: 2.5, criticalHigh: 6.5 },
    ],
  });

  await addTest({
    name: "Lipid Profile",
    code: "LIPID",
    dept: "Biochemistry",
    sample: "Serum",
    price: 900,
    params: [
      { name: "Total Cholesterol", unit: "mg/dL", refLow: 0, refHigh: 200 },
      { name: "Triglycerides", unit: "mg/dL", refLow: 0, refHigh: 150 },
      { name: "HDL Cholesterol", unit: "mg/dL", refLow: 40, refHigh: 60 },
      { name: "LDL Cholesterol", unit: "mg/dL", refLow: 0, refHigh: 100 },
      { name: "VLDL", unit: "mg/dL", refLow: 7, refHigh: 35 },
    ],
  });

  await addTest({
    name: "Thyroid Profile (T3 T4 TSH)",
    code: "THYROID",
    dept: "Biochemistry",
    sample: "Serum",
    price: 1000,
    params: [
      { name: "T3", unit: "ng/mL", refLow: 0.8, refHigh: 2.0 },
      { name: "T4", unit: "µg/dL", refLow: 5.1, refHigh: 14.1 },
      { name: "TSH", unit: "µIU/mL", refLow: 0.27, refHigh: 4.2 },
    ],
  });

  await addTest({
    name: "Fasting Blood Sugar (FBS)",
    code: "FBS",
    dept: "Biochemistry",
    sample: "Plasma",
    price: 150,
    resultType: "numeric",
    unit: "mg/dL",
    refLow: 70,
    refHigh: 110,
    criticalLow: 40,
    criticalHigh: 400,
  });

  await addTest({
    name: "HbA1c",
    code: "HBA1C",
    dept: "Biochemistry",
    sample: "Blood (EDTA)",
    price: 700,
    resultType: "numeric",
    unit: "%",
    refLow: 4,
    refHigh: 5.7,
  });

  await addTest({
    name: "Widal Test",
    code: "WIDAL",
    dept: "Serology",
    sample: "Serum",
    price: 300,
    resultType: "text",
    refText: "Titre < 1:80 — Non-significant",
  });

  await addTest({
    name: "HBsAg (Rapid)",
    code: "HBSAG",
    dept: "Serology",
    sample: "Serum",
    price: 250,
    resultType: "pos_neg",
    refText: "Negative",
  });

  await addTest({
    name: "Urine Routine Examination (R/E)",
    code: "URINE-RE",
    dept: "Clinical Pathology",
    sample: "Urine",
    price: 200,
    params: [
      { name: "Color", resultType: "text", refText: "Pale yellow" },
      { name: "Appearance", resultType: "text", refText: "Clear" },
      { name: "pH", unit: "", refLow: 5, refHigh: 8 },
      { name: "Albumin", resultType: "select", options: ["Nil", "Trace", "+", "++", "+++"], refText: "Nil" },
      { name: "Sugar", resultType: "select", options: ["Nil", "Trace", "+", "++", "+++"], refText: "Nil" },
      { name: "Pus Cells", unit: "/HPF", refLow: 0, refHigh: 5 },
      { name: "RBC", unit: "/HPF", refLow: 0, refHigh: 2 },
      { name: "Epithelial Cells", unit: "/HPF", refText: "Few" },
    ],
  });

  console.log("  ✓ Tests ready:", Object.keys(testIdByCode).length);

  // ── Test groups / profiles ───────────────────────────────────────────────
  async function addGroup(name: string, code: string, dept: string, price: number, members: string[]) {
    const ex = (
      await db.select().from(schema.testGroups).where(eq(schema.testGroups.name, name))
    ).at(0);
    if (ex) return;
    const gid = id();
    await db.insert(schema.testGroups).values({
      id: gid,
      labId,
      name,
      shortCode: code,
      departmentId: deptId[dept],
      pricingMode: "fixed",
      groupPrice: price,
    });
    for (let i = 0; i < members.length; i++) {
      const tcode = members[i];
      if (!testIdByCode[tcode]) continue;
      await db.insert(schema.testGroupItems).values({
        id: id(),
        groupId: gid,
        testId: testIdByCode[tcode],
        displayOrder: i,
      });
    }
  }

  await addGroup("Diabetes Profile", "DIAB", "Biochemistry", 1500, ["FBS", "HBA1C", "RFT"]);
  await addGroup("Fever Profile", "FEVER", "Serology", 1400, ["CBC", "WIDAL", "URINE-RE"]);
  await addGroup("Full Body Checkup (Basic)", "FBC", "Biochemistry", 3500, [
    "CBC",
    "LFT",
    "RFT",
    "LIPID",
    "THYROID",
    "FBS",
    "URINE-RE",
  ]);
  console.log("  ✓ Test groups ready");

  // ── Referring doctors ─────────────────────────────────────────────────────
  const doctorDefs = [
    { name: "Dr. Anjana Sharma", qualification: "MBBS, MD", clinic: "City Clinic" },
    { name: "Dr. Bibek Karki", qualification: "MBBS", clinic: "Kantipur Hospital" },
    { name: "Dr. Sunita Rai", qualification: "MD (Medicine)", clinic: "Norvic Hospital" },
  ];
  for (const doc of doctorDefs) {
    const ex = (await db.select().from(schema.referringDoctors).where(eq(schema.referringDoctors.name, doc.name))).at(0);
    if (!ex) await db.insert(schema.referringDoctors).values({ id: id(), labId, name: doc.name, qualification: doc.qualification, clinic: doc.clinic });
  }
  console.log("  ✓ Referring doctors ready");

  // ── Counters (so generated codes don't clash with any demo data) ──────────
  for (const entity of ["patient", "visit", "bill", "sample", "payment"]) {
    const ex = (
      await db
        .select()
        .from(schema.counters)
        .where(eq(schema.counters.entity, entity))
    ).at(0);
    if (!ex) {
      await db.insert(schema.counters).values({ id: id(), labId, entity, period: "all", value: 0 });
    }
  }

  console.log("\nSeed complete. Log in at /login");
  client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
