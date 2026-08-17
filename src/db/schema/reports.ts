import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { idCol, timestamps, actorColumns } from "./_shared";
import { labs } from "./lab";
import { visits } from "./billing";

/**
 * report_links — one secure public link per visit. The `token` is a random,
 * non-guessable string used at /r/[token]. The link is only "active" once
 * results are approved AND dues are cleared.
 */
export const reportLinks = sqliteTable(
  "report_links",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    visitId: text("visit_id")
      .notNull()
      .references(() => visits.id),
    token: text("token").notNull().unique(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    activatedAt: integer("activated_at", { mode: "timestamp" }),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => ({
    // No separate index on `token`: the .unique() above already creates one
    // (report_links_token_unique), so a second was pure write overhead.
    visitIdx: index("report_links_visit_idx").on(t.visitId),
  }),
);

/** report_access_logs — every public view/download is logged (no PII leakage). */
export const reportAccessLogs = sqliteTable(
  "report_access_logs",
  {
    id: idCol(),
    reportLinkId: text("report_link_id")
      .notNull()
      .references(() => reportLinks.id),
    action: text("action", { enum: ["view", "download", "blocked"] }).notNull(),
    reason: text("reason"), // why blocked, if applicable
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    linkIdx: index("report_access_logs_link_idx").on(t.reportLinkId),
  }),
);

/** report_dispatches — record of each dispatch action for a visit's report. */
export const reportDispatches = sqliteTable(
  "report_dispatches",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    visitId: text("visit_id")
      .notNull()
      .references(() => visits.id),
    channel: text("channel", {
      enum: ["printed", "collected", "sms", "email", "downloaded"],
    }).notNull(),
    note: text("note"),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    visitIdx: index("report_dispatches_visit_idx").on(t.visitId),
  }),
);

/** report_templates — optional per-lab layout overrides (reserved for future). */
export const reportTemplates = sqliteTable("report_templates", {
  id: idCol(),
  labId: text("lab_id")
    .notNull()
    .references(() => labs.id),
  name: text("name").notNull(),
  config: text("config", { mode: "json" }),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
  ...actorColumns,
});
