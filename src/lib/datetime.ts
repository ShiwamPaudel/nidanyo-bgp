import { formatDistanceToNow } from "date-fns";
import { formatBsDate } from "./nepali-date";

export type CalendarSystem = "AD" | "BS";

/**
 * The lab's wall-clock timezone. Every date the app shows or groups by is in
 * this zone, never the runtime's.
 *
 * This matters because the server runs in UTC while the lab is in Nepal: using
 * the runtime zone made "Printed at" 5h45m early (often on the wrong date), and
 * put "today" on the dashboard over a UTC midnight-to-midnight window. Dev
 * machines are in Nepal, so it looked correct locally and only broke in prod.
 *
 * Nepal is UTC+05:45 and has never observed DST, so the fixed offset below is
 * exact; the IANA name is used for formatting so this stays correct even if the
 * process TZ changes.
 */
export const LAB_TZ = "Asia/Kathmandu";
const LAB_OFFSET_MS = 345 * 60 * 1000; // +05:45

// Intl formatters are costly to construct — build once.
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAB_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAB_TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: LAB_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

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

/** The calendar year/month/day at the lab, for a given instant. */
export function labYmd(d: Date): { y: number; m: number; d: number } {
  const p = partsFmt.formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * A Date whose *local* fields carry the lab's calendar date. Only for feeding
 * helpers that read getFullYear/getMonth/getDate (the BS converter) — its
 * instant is meaningless, its civil date is the point.
 */
function labCivilDate(d: Date): Date {
  const { y, m, d: day } = labYmd(d);
  return new Date(y, m - 1, day);
}

export function fmtDate(d?: Date | number | null, cal?: CalendarSystem) {
  if (!d) return "—";
  const date = new Date(d);
  if (resolve(cal) === "BS") {
    const bs = formatBsDate(labCivilDate(date));
    if (bs) return bs; // falls back to AD if the date is outside the BS table range
  }
  return dateFmt.format(date);
}

export function fmtDateTime(d?: Date | number | null, cal?: CalendarSystem) {
  if (!d) return "—";
  const date = new Date(d);
  if (resolve(cal) === "BS") {
    const bs = formatBsDate(labCivilDate(date));
    if (bs) return `${bs}, ${timeFmt.format(date)}`;
  }
  return `${dateFmt.format(date)}, ${timeFmt.format(date)}`;
}

export function fmtTime(d?: Date | number | null) {
  if (!d) return "—";
  return timeFmt.format(new Date(d));
}

export function fmtRelative(d?: Date | number | null) {
  if (!d) return "—";
  const date = new Date(d);
  // "Today"/"Yesterday" must mean today at the lab, not on the server.
  const a = labYmd(date);
  const now = new Date();
  const b = labYmd(now);
  const sameDay = a.y === b.y && a.m === b.m && a.d === b.d;
  if (sameDay) return `Today, ${timeFmt.format(date)}`;
  const yest = labYmd(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (a.y === yest.y && a.m === yest.m && a.d === yest.d) return `Yesterday, ${timeFmt.format(date)}`;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** The instant at which a given lab-local calendar day starts/ends. */
export function labDayBounds(y: number, m: number, d: number) {
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - LAB_OFFSET_MS);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - LAB_OFFSET_MS);
  return { start, end };
}

/** Start/end of the lab's day for a given date (defaults to now). */
export function dayBounds(d = new Date()) {
  const { y, m, d: day } = labYmd(d);
  return labDayBounds(y, m, day);
}

/**
 * The instant N lab-days ago began — the start of a rolling "last N days"
 * window, anchored to the lab's midnight rather than the server's.
 */
export function labDaysAgo(days: number, from = new Date()): Date {
  const { y, m, d } = labYmd(from);
  const back = new Date(Date.UTC(y, m - 1, d) - days * 86400000);
  return labDayBounds(back.getUTCFullYear(), back.getUTCMonth() + 1, back.getUTCDate()).start;
}

/**
 * Parse a "YYYY-MM-DD" filter value as a calendar day AT THE LAB. Plain
 * `new Date("2026-07-17")` parses as UTC midnight, which is 05:45 on the 17th
 * in Nepal — off by most of a morning.
 */
export function parseLabYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * SQLite modifiers that shift a unixepoch into the lab's wall clock. Needed
 * because 'localtime' is evaluated on the *Turso* server (UTC), so it is a
 * no-op — grouping by it bucketed rows into UTC days/hours.
 */
export const SQL_LAB_TZ_SHIFT = "'+5 hours', '+45 minutes'";
