/** Result value flag derived from numeric value vs reference & critical ranges. */
export type ResultFlag = "normal" | "low" | "high" | "critical_low" | "critical_high" | "abnormal";

export function computeFlag(
  value: number | null,
  ref: { refLow?: number | null; refHigh?: number | null; criticalLow?: number | null; criticalHigh?: number | null },
): ResultFlag {
  if (value == null || Number.isNaN(value)) return "normal";
  const { refLow, refHigh, criticalLow, criticalHigh } = ref;
  if (criticalLow != null && value <= criticalLow) return "critical_low";
  if (criticalHigh != null && value >= criticalHigh) return "critical_high";
  if (refLow != null && value < refLow) return "low";
  if (refHigh != null && value > refHigh) return "high";
  return "normal";
}

export const isAbnormal = (f: ResultFlag) => f !== "normal";
export const isCritical = (f: ResultFlag) => f === "critical_low" || f === "critical_high";

/** Short symbol shown next to a flagged value on reports/tables. */
export function flagSymbol(f: ResultFlag): string {
  switch (f) {
    case "low":
      return "L";
    case "high":
      return "H";
    case "critical_low":
      return "LL";
    case "critical_high":
      return "HH";
    case "abnormal":
      return "*";
    default:
      return "";
  }
}

/** Build a readable reference range string. */
export function refRangeText(p: { refLow?: number | null; refHigh?: number | null; refRangeText?: string | null }): string {
  if (p.refRangeText) return p.refRangeText;
  if (p.refLow != null && p.refHigh != null) return `${p.refLow} – ${p.refHigh}`;
  if (p.refLow != null) return `> ${p.refLow}`;
  if (p.refHigh != null) return `< ${p.refHigh}`;
  return "—";
}
