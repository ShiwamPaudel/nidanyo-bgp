"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/schema/_shared";
import {
  visits,
  visitTests,
  bills,
  billItems,
  payments,
  patients,
  tests,
  testGroups,
  testGroupItems,
  sampleTypes,
  samples,
  resultEntries,
  paymentModes,
  labSettings,
  departments,
  reportLinks,
} from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { nextCode } from "@/lib/numbering";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";
import { recomputeBill, round2 } from "@/lib/billing-engine";
import { ensureReportLink, activateReportLinkIfReady } from "@/lib/report-engine";
import { newVisitSchema, paymentSchema, cancelVisitSchema, type NewVisitInput, type PaymentInput } from "@/lib/validators/billing";

/** Create a visit with its bill, expanding groups into individual tests + samples + result stubs. */
export async function createVisitWithBill(input: NewVisitInput): Promise<ActionResult<{ visitId: string }>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.VISIT_CREATE);
    const parsed = newVisitSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0] ?? "items")] = i.message;
      return fail(parsed.error.issues[0]?.message ?? "Please check the form.", fe);
    }
    const d = parsed.data;

    // Resolve the patient — either an existing one, or create a new one inline.
    let patient;
    if (d.patientId) {
      patient = (await db.select().from(patients).where(and(eq(patients.id, d.patientId), eq(patients.labId, user.labId)))).at(0);
      if (!patient) return fail("Patient not found.");
    } else if (d.newPatient) {
      const np = d.newPatient;
      const patientCode = await nextCode(user.labId, "patient");
      const [created] = await db
        .insert(patients)
        .values({
          labId: user.labId,
          code: patientCode,
          fullName: np.fullName,
          gender: np.gender,
          ageValue: np.ageValue ?? null,
          ageUnit: np.ageUnit,
          phone: np.phone || null,
          email: np.email || null,
          address: np.address || null,
          referredBy: d.referredBy || null,
          createdBy: user.id,
        })
        .returning();
      patient = created;
      await activity(user, "patient_registered", `Registered patient ${np.fullName} (${patientCode})`, { entity: "patient", entityId: created.id });
    } else {
      return fail("Select an existing patient or enter new patient details.");
    }

    // Resolve catalog
    const [allTests, allGroups, allGroupItems, allSampleTypes, settingsRows, allDepartments] = await Promise.all([
      db.select().from(tests).where(and(eq(tests.labId, user.labId), eq(tests.isActive, true))),
      db.select().from(testGroups).where(eq(testGroups.labId, user.labId)),
      db.select().from(testGroupItems),
      db.select().from(sampleTypes).where(eq(sampleTypes.labId, user.labId)),
      db.select().from(labSettings).where(eq(labSettings.labId, user.labId)),
      db.select().from(departments).where(eq(departments.labId, user.labId)),
    ]);
    const settings = settingsRows.at(0);
    const testById = new Map(allTests.map((t) => [t.id, t]));
    // Billing-only departments are charged but never reported on: they get no
    // sample, no result entry, and cannot hold back the visit's report.
    const billingOnlyDeptIds = new Set(allDepartments.filter((dep) => dep.billingOnly).map((dep) => dep.id));
    const isReportable = (t: { departmentId: string | null }) => !t.departmentId || !billingOnlyDeptIds.has(t.departmentId);
    const groupById = new Map(allGroups.map((g) => [g.id, g]));
    const sampleTypeById = new Map(allSampleTypes.map((s) => [s.id, s]));
    const itemsByGroup = new Map<string, string[]>();
    for (const it of allGroupItems) {
      const arr = itemsByGroup.get(it.groupId) ?? [];
      arr.push(it.testId);
      itemsByGroup.set(it.groupId, arr);
    }

    // Build line items + the flat list of tests to order
    type Line = { label: string; kind: "test" | "group"; lineTotal: number; testIds: string[]; groupId?: string; groupName?: string };
    const lines: Line[] = [];
    const seenTests = new Set<string>();
    // Per-bill unit price for individual tests (catalog price unless the biller
    // overrode the rate at billing time). Only used for this visit's snapshots.
    const unitPriceByTest = new Map<string, number>();

    for (const item of d.items) {
      if (item.kind === "test") {
        const t = testById.get(item.refId);
        if (!t || seenTests.has(t.id)) continue;
        seenTests.add(t.id);
        const unit = item.priceOverride != null ? round2(item.priceOverride) : round2(t.price);
        unitPriceByTest.set(t.id, unit);
        lines.push({ label: t.name, kind: "test", lineTotal: unit, testIds: [t.id] });
      } else {
        const g = groupById.get(item.refId);
        if (!g) continue;
        const memberIds = (itemsByGroup.get(g.id) ?? []).filter((id) => testById.has(id));
        const price =
          item.priceOverride != null
            ? round2(item.priceOverride)
            : g.pricingMode === "sum"
              ? round2(memberIds.reduce((s, id) => s + (testById.get(id)?.price ?? 0), 0))
              : round2(g.groupPrice);
        for (const id of memberIds) seenTests.add(id);
        lines.push({ label: g.name, kind: "group", lineTotal: price, testIds: memberIds, groupId: g.id, groupName: g.name });
      }
    }

    if (lines.length === 0) return fail("Add at least one test or profile.");

    // A visit made up purely of billing-only lines (consultation, dental…) has
    // nothing to collect, process or report.
    const hasReportable = [...seenTests].some((id) => {
      const t = testById.get(id);
      return t ? isReportable(t) : false;
    });

    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discount = round2(Math.min(d.discountAmount ?? 0, subtotal));
    const taxPercent = settings?.taxEnabled ? settings.taxPercent : 0;
    const taxable = round2(subtotal - discount);
    const taxAmount = round2((taxable * taxPercent) / 100);
    const grandTotal = round2(taxable + taxAmount);

    // Generate codes
    const visitCode = await nextCode(user.labId, "visit");
    const billCode = await nextCode(user.labId, "bill");

    // Insert visit
    const [visit] = await db
      .insert(visits)
      .values({
        labId: user.labId,
        code: visitCode,
        patientId: patient.id,
        referredBy: d.referredBy ?? patient.referredBy ?? null,
        priority: d.priority ?? "normal",
        status: hasReportable ? "sample_pending" : "registered",
        createdBy: user.id,
      })
      .returning({ id: visits.id });

    // Insert visit tests (expanded) + result entry stubs, grouped by sample type for samples
    const orderedTests = [...seenTests].map((id) => testById.get(id)!).filter(Boolean);
    const reportableTests = orderedTests.filter(isReportable);

    // Create one sample per distinct sample type — billing-only tests are never
    // collected, so they must not open a sample.
    const distinctSampleTypeIds = [...new Set(reportableTests.map((t) => t.sampleTypeId).filter(Boolean))] as string[];
    const sampleIdByType = new Map<string, string>();
    for (const stId of distinctSampleTypeIds) {
      const st = sampleTypeById.get(stId);
      const code = await nextCode(user.labId, "sample");
      const [s] = await db
        .insert(samples)
        .values({
          labId: user.labId,
          code,
          visitId: visit.id,
          sampleTypeId: stId,
          sampleTypeName: st?.name ?? "Sample",
          status: "waiting",
          createdBy: user.id,
        })
        .returning({ id: samples.id });
      sampleIdByType.set(stId, s.id);
    }

    // group membership lookup for visit_test tagging
    const groupOfTest = new Map<string, { groupId: string; groupName: string }>();
    for (const l of lines) {
      if (l.kind === "group") {
        for (const tid of l.testIds) groupOfTest.set(tid, { groupId: l.groupId!, groupName: l.groupName! });
      }
    }

    // Build every visit-test + result-entry row up front. Because ids are
    // generated in JS, a result entry can reference its visit test without a
    // round-trip, so both sets go in as one atomic batch instead of 2×N inserts.
    const visitTestRows = orderedTests.map((t) => {
      const grp = groupOfTest.get(t.id);
      return {
        id: newId(),
        visitId: visit.id,
        testId: t.id,
        testName: t.name,
        departmentId: t.departmentId,
        sampleTypeId: t.sampleTypeId,
        groupId: grp?.groupId ?? null,
        groupName: grp?.groupName ?? null,
        price: unitPriceByTest.get(t.id) ?? t.price,
        status: "ordered" as const,
      };
    });
    // Only reportable tests get a result entry. A billing-only line still bills
    // and still appears as a visit test, but never enters the results queue —
    // otherwise its stub would sit "pending" forever and block the visit's
    // report from ever being released.
    const resultEntryRows = visitTestRows
      .filter((vt) => isReportable(vt))
      .map((vt) => ({
        labId: user.labId,
        visitId: visit.id,
        visitTestId: vt.id,
        testId: vt.testId,
        testName: vt.testName,
        sampleId: vt.sampleTypeId ? sampleIdByType.get(vt.sampleTypeId) : null,
        status: "pending" as const,
      }));
    if (visitTestRows.length > 0) {
      await db.batch([
        db.insert(visitTests).values(visitTestRows),
        ...(resultEntryRows.length > 0 ? [db.insert(resultEntries).values(resultEntryRows)] : []),
      ]);
    }

    // Insert bill
    const [bill] = await db
      .insert(bills)
      .values({
        labId: user.labId,
        code: billCode,
        visitId: visit.id,
        patientId: patient.id,
        subtotal,
        discountAmount: discount,
        discountReason: d.discountReason ?? null,
        taxPercent,
        taxAmount,
        grandTotal,
        paidAmount: 0,
        dueAmount: grandTotal,
        paymentStatus: "unpaid",
        remarks: d.remarks ?? null,
        createdBy: user.id,
      })
      .returning({ id: bills.id });

    // Bill items — single multi-row insert instead of one insert per line.
    await db.insert(billItems).values(
      lines.map((l) => ({
        billId: bill.id,
        label: l.label,
        kind: l.kind,
        qty: 1,
        unitPrice: l.lineTotal,
        lineTotal: l.lineTotal,
      })),
    );

    // Optional initial payment
    if ((d.paymentAmount ?? 0) > 0) {
      const mode = d.paymentModeId
        ? (await db.select().from(paymentModes).where(eq(paymentModes.id, d.paymentModeId))).at(0)
        : undefined;
      const payCode = await nextCode(user.labId, "payment");
      await db.insert(payments).values({
        labId: user.labId,
        code: payCode,
        billId: bill.id,
        patientId: patient.id,
        amount: round2(Math.min(d.paymentAmount, grandTotal)),
        modeId: mode?.id ?? null,
        mode: mode?.name ?? "Cash",
        kind: "payment",
        reference: d.paymentReference ?? null,
        receivedBy: user.id,
        receivedByName: user.name,
      });
      await recomputeBill(bill.id);
    }

    // No reportable test ⇒ no report ⇒ no link, and therefore no QR on the bill.
    if (hasReportable) await ensureReportLink(visit.id, user.labId);
    await audit(user, "visit.create", { entity: "visit", entityId: visit.id, summary: `Created visit ${visitCode} for ${patient.fullName}`, meta: { grandTotal } });
    await activity(user, "visit_created", `Created visit ${visitCode} for ${patient.fullName} (${lines.length} item${lines.length > 1 ? "s" : ""})`, { entity: "visit", entityId: visit.id });

    revalidatePath("/billing");
    revalidatePath("/sample-collection");
    revalidatePath("/patients");
    revalidatePath(`/patients/${patient.id}`);
    return ok({ visitId: visit.id }, "Visit and bill created successfully");
  });
}

/** Receive a payment or due collection against a bill. */
export async function receivePayment(input: PaymentInput): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.PAYMENT_RECEIVE);
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      return fail(parsed.error.issues[0]?.message ?? "Please check the amount.", fe);
    }
    const d = parsed.data;
    const bill = (await db.select().from(bills).where(and(eq(bills.id, d.billId), eq(bills.labId, user.labId)))).at(0);
    if (!bill) return fail("Bill not found.");
    if (bill.status === "cancelled") return fail("This bill has been cancelled.");
    if (bill.dueAmount <= 0) return fail("This bill is already fully paid.");

    // Optional discount granted while collecting the due — waives part of the
    // outstanding amount. Applied to the bill's discount so the totals stay
    // consistent (tax, if any, is recomputed off the new taxable subtotal).
    const discount = round2(Math.max(0, Math.min(d.discount ?? 0, bill.dueAmount)));
    let grandTotal = bill.grandTotal;
    if (discount > 0) {
      const newDiscount = round2(bill.discountAmount + discount);
      const taxable = round2(Math.max(0, bill.subtotal - newDiscount));
      const taxAmount = round2((taxable * bill.taxPercent) / 100);
      grandTotal = round2(taxable + taxAmount);
      await db
        .update(bills)
        .set({
          discountAmount: newDiscount,
          taxAmount,
          grandTotal,
          discountReason: [bill.discountReason, d.remarks].filter(Boolean).join(" · ") || bill.discountReason,
        })
        .where(eq(bills.id, bill.id));
    }

    const newDue = round2(Math.max(0, grandTotal - bill.paidAmount));
    const amount = round2(Math.min(d.amount ?? 0, newDue));
    const mode = amount > 0 && d.modeId ? (await db.select().from(paymentModes).where(eq(paymentModes.id, d.modeId))).at(0) : undefined;
    const isDueCollection = bill.paidAmount > 0;

    if (amount > 0) {
      const payCode = await nextCode(user.labId, "payment");
      await db.insert(payments).values({
        labId: user.labId,
        code: payCode,
        billId: bill.id,
        patientId: bill.patientId,
        amount,
        modeId: mode?.id ?? null,
        mode: mode?.name ?? "Cash",
        kind: isDueCollection ? "due_collection" : "payment",
        reference: d.reference ?? null,
        remarks: d.remarks ?? null,
        receivedBy: user.id,
        receivedByName: user.name,
      });
    }

    const res = await recomputeBill(bill.id);
    const summary = discount > 0 ? `Received ${amount}, discount ${discount} on ${bill.code}` : `Received ${amount} on ${bill.code}`;
    await audit(user, "payment.receive", { entity: "bill", entityId: bill.id, summary, meta: { amount, discount, mode: mode?.name } });
    await activity(user, "payment_received", `${discount > 0 ? `Discounted ${discount} and received` : "Received"} payment of ${amount} on bill ${bill.code}`, { entity: "bill", entityId: bill.id });

    revalidatePath("/dues");
    revalidatePath("/billing");
    revalidatePath("/transactions");
    return ok(undefined, res?.due === 0 ? "Payment received — bill fully paid" : "Payment received");
  });
}

/** Safely void/cancel a visit + bill with a required reason (never hard-deletes). */
export async function cancelVisit(input: { visitId: string; reason: string }): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.VISIT_CANCEL);
    const parsed = cancelVisitSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "A reason is required.");
    const visit = (await db.select().from(visits).where(and(eq(visits.id, parsed.data.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");
    if (visit.status === "cancelled") return fail("This visit is already cancelled.");
    if (visit.status === "dispatched") return fail("A dispatched visit cannot be cancelled.");

    await db
      .update(visits)
      .set({ status: "cancelled", cancelledReason: parsed.data.reason, cancelledAt: new Date(), cancelledBy: user.id })
      .where(eq(visits.id, visit.id));
    await db.update(bills).set({ status: "cancelled", paymentStatus: "cancelled", cancelledReason: parsed.data.reason }).where(eq(bills.visitId, visit.id));
    await db.update(visitTests).set({ status: "cancelled" }).where(eq(visitTests.visitId, visit.id));

    await audit(user, "visit.cancel", { entity: "visit", entityId: visit.id, summary: `Cancelled visit ${visit.code}: ${parsed.data.reason}` });
    await activity(user, "visit_cancelled", `Cancelled visit ${visit.code}`, { entity: "visit", entityId: visit.id });

    revalidatePath("/billing");
    revalidatePath(`/visits/${visit.id}`);
    revalidatePath("/patients");
    revalidatePath(`/patients/${visit.patientId}`);
    return ok(undefined, "Visit cancelled and recorded");
  });
}

export { activateReportLinkIfReady };

/**
 * Add tests to an existing visit ("add-on" tests).
 *
 * Exists because a visit is a snapshot of what was ordered: editing a test
 * group later deliberately does NOT rewrite past visits, so a visit created
 * before a group gained members has no way to pick them up. This is that way.
 *
 * Rules (agreed with the lab):
 *  - The bill is NEVER touched. Added tests carry price 0 so the "Tests
 *    Performed" revenue report keeps matching what was actually billed.
 *  - The visit reopens: new tests come in as `pending`, so the report is only
 *    released again once they are entered and approved. Already-approved
 *    results are left completely alone.
 */
export async function addTestsToVisit(input: { visitId: string; testIds: string[] }): Promise<ActionResult<{ added: number; reopened: boolean }>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.VISIT_CREATE);
    const visit = (await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");
    if (visit.status === "cancelled") return fail("This visit is cancelled — tests cannot be added to it.");

    const wanted = [...new Set((input.testIds ?? []).filter(Boolean))];
    if (wanted.length === 0) return fail("Select at least one test to add.");

    // Never double-add something already ordered here.
    const existing = await db.select().from(visitTests).where(eq(visitTests.visitId, visit.id));
    const alreadyHave = new Set(existing.map((e) => e.testId));
    const toAddIds = wanted.filter((id) => !alreadyHave.has(id));
    if (toAddIds.length === 0) return fail("Those tests are already on this visit.");

    const testRows = await db
      .select()
      .from(tests)
      .where(and(inArray(tests.id, toAddIds), eq(tests.labId, user.labId), eq(tests.isActive, true)));
    if (testRows.length === 0) return fail("No matching active tests found.");

    const allDepartments = await db.select().from(departments).where(eq(departments.labId, user.labId));
    const billingOnlyDeptIds = new Set(allDepartments.filter((dep) => dep.billingOnly).map((dep) => dep.id));
    const isReportable = (t: { departmentId: string | null }) => !t.departmentId || !billingOnlyDeptIds.has(t.departmentId);

    // If the test belongs to a group this visit already ordered, inherit that
    // group's tag so it prints under the same heading as its siblings.
    const orderedGroups = new Map<string, string>();
    for (const e of existing) if (e.groupId && e.groupName) orderedGroups.set(e.groupId, e.groupName);
    const groupOfTest = new Map<string, { groupId: string; groupName: string }>();
    if (orderedGroups.size > 0) {
      const items = await db.select().from(testGroupItems).where(inArray(testGroupItems.groupId, [...orderedGroups.keys()]));
      for (const it of items) {
        const name = orderedGroups.get(it.groupId);
        if (name) groupOfTest.set(it.testId, { groupId: it.groupId, groupName: name });
      }
    }

    // Reuse the specimen already drawn for this visit where the type matches;
    // only open a new sample when the test needs a type nobody collected yet.
    const existingSamples = await db.select().from(samples).where(eq(samples.visitId, visit.id));
    const sampleByType = new Map<string, string>();
    for (const s of existingSamples) if (s.sampleTypeId) sampleByType.set(s.sampleTypeId, s.id);
    const allSampleTypes = await db.select().from(sampleTypes).where(eq(sampleTypes.labId, user.labId));
    const sampleTypeById = new Map(allSampleTypes.map((s) => [s.id, s]));

    let newSampleNeeded = false;
    let added = 0;

    for (const t of testRows) {
      const reportable = isReportable(t);
      let sampleId: string | null = null;

      if (reportable && t.sampleTypeId) {
        if (!sampleByType.has(t.sampleTypeId)) {
          const code = await nextCode(user.labId, "sample");
          const [s] = await db
            .insert(samples)
            .values({
              labId: user.labId,
              code,
              visitId: visit.id,
              sampleTypeId: t.sampleTypeId,
              sampleTypeName: sampleTypeById.get(t.sampleTypeId)?.name ?? "Sample",
              status: "waiting",
              createdBy: user.id,
            })
            .returning({ id: samples.id });
          sampleByType.set(t.sampleTypeId, s.id);
          newSampleNeeded = true;
        }
        sampleId = sampleByType.get(t.sampleTypeId) ?? null;
      }

      const grp = groupOfTest.get(t.id);
      const vtId = newId();
      await db.insert(visitTests).values({
        id: vtId,
        visitId: visit.id,
        testId: t.id,
        testName: t.name,
        departmentId: t.departmentId,
        sampleTypeId: t.sampleTypeId,
        groupId: grp?.groupId ?? null,
        groupName: grp?.groupName ?? null,
        price: 0, // bill is never changed — keep revenue reports honest
        status: "ordered",
      });

      if (reportable) {
        await db.insert(resultEntries).values({
          labId: user.labId,
          visitId: visit.id,
          visitTestId: vtId,
          testId: t.id,
          testName: t.name,
          sampleId,
          status: "pending",
        });
      }
      added++;
    }

    // Reopen the visit: there is unfinished work on it again.
    const newStatus = newSampleNeeded ? "sample_pending" : "result_pending";
    await db.update(visits).set({ status: newStatus, updatedBy: user.id }).where(eq(visits.id, visit.id));

    // The issued report is no longer complete — pull the public link until the
    // new results are approved, at which point the normal flow re-activates it.
    await db.update(reportLinks).set({ isActive: false }).where(eq(reportLinks.visitId, visit.id));

    await audit(user, "visit.add_tests", {
      entity: "visit",
      entityId: visit.id,
      summary: `Added ${added} test${added === 1 ? "" : "s"} to ${visit.code} (bill unchanged)`,
      meta: { tests: testRows.map((t) => t.name), newStatus },
    });
    await activity(user, "visit_tests_added", `Added ${added} test${added === 1 ? "" : "s"} to ${visit.code}`, { entity: "visit", entityId: visit.id });

    revalidatePath(`/visits/${visit.id}`);
    revalidatePath("/results");
    revalidatePath("/approval");
    revalidatePath("/sample-collection");
    revalidatePath("/dispatch");
    return ok(
      { added, reopened: true },
      `${added} test${added === 1 ? "" : "s"} added. The bill is unchanged and the visit is back to ${newSampleNeeded ? "sample collection" : "result entry"}.`,
    );
  });
}
