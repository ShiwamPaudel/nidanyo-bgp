import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTransactions, getTestRevenue, getEodSummary } from "@/lib/queries/finance";
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

  const [{ dayRows, dayTotal, dueRows, dueTotal }, testRev, eod, { lab }] = await Promise.all([
    listTransactions(user.labId, filters),
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

  // The bill-level figures (gross/discount/tax/net) belong to the whole bill,
  // shown once per bill so each column totals honestly (a bill can appear on
  // several payment rows). "Amount" is the per-payment collection.
  const emitTable = (title: string, list: typeof dayRows, collected: number) => {
    lines.push(csvRow([title]));
    lines.push(csvRow(["Visit", "Date", "Patient", "Referred By", "Mode", "Type", "Received By", "Gross Sales", "Discount", "Tax", "Net Sales", "Amount"]));
    const seen = new Set<string>();
    const t = { gross: 0, discount: 0, tax: 0, net: 0 };
    for (const r of list) {
      const first = !seen.has(r.billCode);
      if (first) {
        seen.add(r.billCode);
        t.gross += r.billSubtotal;
        t.discount += r.billDiscount;
        t.tax += r.billTax;
        t.net += r.billGrandTotal;
      }
      lines.push(csvRow([
        r.visitCode, fmtDateTime(r.paidAt), r.patientName, r.referredBy ?? "Walk-in", r.mode, r.kind, r.receivedByName ?? "",
        first ? r.billSubtotal.toFixed(2) : "", first ? r.billDiscount.toFixed(2) : "", first ? r.billTax.toFixed(2) : "", first ? r.billGrandTotal.toFixed(2) : "",
        r.amount.toFixed(2),
      ]));
    }
    lines.push(csvRow(["", "", "", "", "", "", "Totals", t.gross.toFixed(2), t.discount.toFixed(2), t.tax.toFixed(2), t.net.toFixed(2), collected.toFixed(2)]));
    lines.push("");
  };

  // Payments & due collections against bills raised in this range
  emitTable("Payments & Due Collections (This Period's Bills)", dayRows, dayTotal);
  // Dues collected today against bills raised on an earlier day
  emitTable("Dues Collected Today (Previous Days' Bills)", dueRows, dueTotal);

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
