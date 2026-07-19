import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTransactions, getTestRevenue, getEodSummary, getSalesInRange } from "@/lib/queries/finance";
import { getLab } from "@/lib/queries/lab";
import { fmtDateTime, fmtDate } from "@/lib/datetime";

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, PERMISSIONS.FINANCE_EXPORT)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const filters = {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    mode: sp.get("mode") ?? undefined,
    q: sp.get("q") ?? undefined,
  };

  const [{ dayRows, dayTotal, dueRows, dueTotal }, sales, testRev, eod, { lab }] = await Promise.all([
    listTransactions(user.labId, filters),
    getSalesInRange(user.labId, filters.from, filters.to),
    getTestRevenue(user.labId, filters.from, filters.to),
    getEodSummary(user.labId, filters.from, filters.to),
    getLab(user.labId),
  ]);

  const rangeLabel = filters.from || filters.to ? `${filters.from ?? "…"} to ${filters.to ?? filters.from ?? "…"}` : "All dates";

  const lines: string[] = [];
  // Report metadata
  lines.push(csvRow([lab?.name ?? "Laboratory", "— Transactions Report"]));
  lines.push(csvRow(["Date range", rangeLabel]));
  lines.push(csvRow(["Printed by", user.name]));
  lines.push(csvRow(["Printed at", fmtDateTime(new Date())]));
  lines.push("");

  // Sales — one row per bill RAISED in this range (accrual, by bill date). This
  // is the day's true sales regardless of when the money is collected.
  lines.push(csvRow(["Sales — Bills Raised (This Period)"]));
  lines.push(csvRow(["Visit", "Bill", "Date", "Patient", "Referred By", "Gross Sales", "Discount", "Tax", "Net Sales", "Collected", "Due"]));
  for (const r of sales.rows) {
    lines.push(csvRow([r.visitCode, r.billCode, fmtDateTime(r.createdAt), r.patientName, r.referredBy ?? "Walk-in", r.subtotal.toFixed(2), r.discount.toFixed(2), r.tax.toFixed(2), r.grandTotal.toFixed(2), r.paidAmount.toFixed(2), r.dueAmount.toFixed(2)]));
  }
  lines.push(csvRow(["", "", "", "", "Totals", sales.totals.gross.toFixed(2), sales.totals.discount.toFixed(2), sales.totals.tax.toFixed(2), sales.totals.net.toFixed(2), "", ""]));
  lines.push("");

  // Collections — money actually received in this range (cash view, by payment date).
  const emitCollections = (title: string, list: typeof dayRows, collected: number) => {
    lines.push(csvRow([title]));
    lines.push(csvRow(["Receipt", "Visit", "Date", "Patient", "Referred By", "Mode", "Type", "Received By", "Amount"]));
    for (const r of list) {
      lines.push(csvRow([r.code, r.visitCode, fmtDateTime(r.paidAt), r.patientName, r.referredBy ?? "Walk-in", r.mode, r.kind, r.receivedByName ?? "", r.amount.toFixed(2)]));
    }
    lines.push(csvRow(["", "", "", "", "", "", "", "Total", collected.toFixed(2)]));
    lines.push("");
  };
  emitCollections("Collections Received (This Period's Bills)", dayRows, dayTotal);
  emitCollections("Dues Collected Today (Previous Days' Bills)", dueRows, dueTotal);

  // Range summary
  lines.push(csvRow(["Summary"]));
  lines.push(csvRow(["Net collected", eod.net.toFixed(2)]));
  lines.push(csvRow(["Discounts given", eod.discount.toFixed(2)]));
  lines.push(csvRow(["Due collected", eod.dueCollected.toFixed(2)]));
  lines.push(csvRow(["Refunds", eod.refunded.toFixed(2)]));
  lines.push("");

  // Tests performed in the range — profiles rolled up, standalone tests on their own
  lines.push(csvRow(["Tests performed"]));
  lines.push(csvRow(["Test / Profile", "Type", "Times", "Revenue"]));
  for (const t of testRev) {
    lines.push(csvRow([t.name, t.kind === "group" ? "Profile" : "Test", t.count, t.revenue.toFixed(2)]));
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8 correctly
  const fileTag = filters.from ? `${filters.from}${filters.to && filters.to !== filters.from ? `_${filters.to}` : ""}` : fmtDate(new Date());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${fileTag}.csv"`,
    },
  });
}
