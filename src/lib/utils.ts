import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pad a counter value into a human-readable code, e.g. ("P", 12) -> "P-000012". */
export function formatCode(prefix: string, value: number, width = 6) {
  return `${prefix}-${String(value).padStart(width, "0")}`;
}

/** Format money for display. Defaults to NPR-style grouping, no forced symbol. */
export function formatMoney(amount: number, currency = "NPR") {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

/** Compact money without currency code (for tight table cells). */
export function money(amount: number) {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Build a patient age label from value + unit. */
export function ageLabel(value?: number | null, unit?: string | null) {
  if (value == null) return "—";
  const u = unit ?? "years";
  return `${value} ${u === "years" ? "yrs" : u === "months" ? "mo" : "days"}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Today's date as a local "yyyy-mm-dd" string (matches the date-filter inputs). */
export function todayISO(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
