/**
 * Single source of truth for the order tests appear in — on the printed report
 * and on the result entry screen, which must agree or the bench is entering in
 * one order and checking in another.
 *
 * Order, outermost first:
 *   1. department displayOrder, then department name (ties → alphabetical)
 *   2. within a department: standalone tests first, then each group's tests
 *      kept together, groups alphabetically
 *   3. within a group: the order configured on the group (its item displayOrder)
 *   4. otherwise: the test's own displayOrder, then its name
 *
 * Everything here is presentation only — nothing stored is changed.
 */
export interface OrderableEntry {
  testId: string;
  testName: string;
  /** Department of the test, if any. */
  departmentName: string | null;
  departmentOrder: number | null;
  /** Group tag snapshotted on the visit test, if the test came from a group. */
  groupName: string | null;
  /** displayOrder of this test inside that group. */
  groupItemOrder: number | null;
  /** The test's own catalog displayOrder. */
  testOrder: number | null;
}

const LAST = Number.MAX_SAFE_INTEGER;

/** Compare two entries by the report's canonical ordering. */
export function compareEntries(a: OrderableEntry, b: OrderableEntry): number {
  // 1. Department — configured order wins, name breaks ties, no-department last.
  const ao = a.departmentName == null ? LAST : a.departmentOrder ?? 0;
  const bo = b.departmentName == null ? LAST : b.departmentOrder ?? 0;
  if (ao !== bo) return ao - bo;
  const an = a.departmentName ?? "￿";
  const bn = b.departmentName ?? "￿";
  if (an !== bn) return an.localeCompare(bn);

  // 2. Standalone tests before grouped ones, then groups kept together.
  const ag = a.groupName ?? "";
  const bg = b.groupName ?? "";
  if (ag !== bg) return ag.localeCompare(bg);

  // 3. Inside a group: the order configured on the group.
  if (ag !== "") {
    const ai = a.groupItemOrder ?? LAST;
    const bi = b.groupItemOrder ?? LAST;
    if (ai !== bi) return ai - bi;
    return a.testName.localeCompare(b.testName);
  }

  // 4. Standalone: the test's own catalog order, then name.
  const at = a.testOrder ?? 0;
  const bt = b.testOrder ?? 0;
  if (at !== bt) return at - bt;
  return a.testName.localeCompare(b.testName);
}
