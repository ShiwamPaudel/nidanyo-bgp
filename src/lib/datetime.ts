import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { formatBsDate } from "./nepali-date";

export type CalendarSystem = "AD" | "BS";

/**
 * Server-side ambient calendar, set once per request from the lab setting (see
 * `setServerCalendar`, called from the session resolver). This deployment is
 * single-lab, so a module-level default is safe; multi-tenant use would pass
 * `cal` explicitly instead. On the client this stays "AD" and the few client
 * date surfaces (the report sheet) pass `cal` explicitly.
 */
let serverCalendar: CalendarSystem = "AD";
export function setServerCalendar(c: CalendarSystem) {
  serverCalendar = c === "BS" ? "BS" : "AD";
}
export function getServerCalendar(): CalendarSystem {
  return serverCalendar;
}
function resolve(cal?: CalendarSystem): CalendarSystem {
  return cal ?? serverCalendar;
}

export function fmtDate(d?: Date | number | null, cal?: CalendarSystem) {
  if (!d) return "—";
  const date = new Date(d);
  if (resolve(cal) === "BS") {
    const bs = formatBsDate(date);
    if (bs) return bs; // falls back to AD if the date is outside the BS table range
  }
  return format(date, "dd MMM yyyy");
}

export function fmtDateTime(d?: Date | number | null, cal?: CalendarSystem) {
  if (!d) return "—";
  const date = new Date(d);
  if (resolve(cal) === "BS") {
    const bs = formatBsDate(date);
    if (bs) return `${bs}, ${format(date, "h:mm a")}`;
  }
  return format(date, "dd MMM yyyy, h:mm a");
}

export function fmtTime(d?: Date | number | null) {
  if (!d) return "—";
  return format(new Date(d), "h:mm a");
}

export function fmtRelative(d?: Date | number | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "h:mm a")}`;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** Start/end of the local day for a given date (defaults to now). */
export function dayBounds(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
