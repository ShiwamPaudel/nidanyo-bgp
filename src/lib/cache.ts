import "server-only";

/**
 * Cache policy for the read-heavy dashboard/navigation queries.
 *
 * The rule this follows: **cache a hint, never a record.** A sidebar count or a
 * trend chart is a glance — a few seconds of staleness costs nothing. A ledger
 * (dues, transactions, end-of-day, a work queue a technician is about to act
 * on) must always be exact, and none of those are cached anywhere.
 *
 * Deliberately NOT cached, and they should stay that way:
 *   - `getCurrentUser` / permissions — security boundary; a revoked account has
 *     to lose access on the very next request.
 *   - dues, transactions, finance reports, bills, payments — money, reconciled
 *     against physical cash at the counter.
 *   - result / approval / dispatch queues — two technicians must never pick up
 *     the same visit from a stale list.
 */

export const CACHE_TAGS = {
  /**
   * Live operational counts. Expired on a timer AND flushed after any
   * successful server action (see `run()` in src/lib/action.ts), so a badge
   * always reflects the work you just did.
   */
  ops: "nidanyo:ops",
  /**
   * Long-window trends (all-time / 30-day). Time-based expiry only — these
   * cannot move meaningfully inside their window, so flushing them on every
   * action would just throw away the saving for no visible benefit.
   */
  trends: "nidanyo:trends",
} as const;

/** Seconds. */
export const CACHE_TTL = {
  /** Sidebar badges, today's stat cards, today's collection split, 14-day revenue. */
  ops: 60,
  /** Busiest hours over 30 days. */
  peakHours: 60 * 60,
  /** Revenue by referring doctor over 30 days. */
  revenueByDoctor: 60 * 60,
  /**
   * Most-performed tests. This one aggregates ALL history and is the single
   * most expensive dashboard query (it grows forever), while "most performed
   * test of all time" cannot realistically change within a working day.
   */
  topTests: 6 * 60 * 60,
} as const;
