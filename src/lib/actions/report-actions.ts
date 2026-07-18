"use server";

import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ActionResult, ok, run } from "@/lib/action";
import { listReportTestOptions, type ReportTestOption } from "@/lib/queries/report";

/**
 * List a visit's tests (with status) for the "print selected tests" picker.
 * Read-only; requires report-view permission. Only approved tests are printable
 * — the caller shows the rest disabled with their status.
 */
export async function getVisitReportTests(visitId: string): Promise<ActionResult<ReportTestOption[]>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.REPORT_VIEW);
    const tests = await listReportTestOptions(user.labId, visitId);
    return ok(tests);
  });
}
