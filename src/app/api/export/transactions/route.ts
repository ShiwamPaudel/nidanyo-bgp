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

  const [{ rows, total }, testRev, eod, { lab }] = await Promise.all([
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

  // Transactions
  lines.push(csvRow(["Receipt", "Date", "Patient", "Bill", "Mode", "Type", "Reference", "Received By", "Amount"]));
  for (const r of rows) {
    lines.push(csvRow([r.code, fmtDateTime(r.paidAt), r.patientName, r.billCode, r.mode, r.kind, r.reference ?? "", r.receivedByName ?? "", r.amount.toFixed(2)]));
  }
  lines.push(csvRow(["", "", "", "", "", "", "", "Net collected", total.toFixed(2)]));
  lines.push("");

  // Range summary
  lines.push(csvRow(["Summary"]));
  lines.push(csvRow(["Net collected", eod.net.toFixed(2)]));
  lines.push(csvRow(["Discounts given", eod.discount.toFixed(2)]));
  lines.push(csvRow(["Due collected", eod.dueCollected.toFixed(2)]));
  lines.push(csvRow(["Refunds", eod.refunded.toFixed(2)]));
  lines.push("");

  // Tests performed in the range
  lines.push(csvRow(["Tests performed"]));
  lines.push(csvRow(["Test", "Times", "Revenue"]));
  for (const t of testRev) {
    lines.push(csvRow([t.name, t.count, t.revenue.toFixed(2)]));
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
