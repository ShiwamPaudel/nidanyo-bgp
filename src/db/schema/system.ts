import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { idCol, timestamps } from "./_shared";
import { labs } from "./lab";

/**
 * counters — atomic human-readable number generation per lab + entity + period.
 * e.g. (lab, "visit", "2026") -> incrementing value. Updated in a transaction.
 */
export const counters = sqliteTable(
  "counters",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    entity: text("entity").notNull(), // patient | visit | bill | sample | payment
    period: text("period").notNull().default("all"), // e.g. year or "all"
    value: integer("value").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    uniq: unique("counters_lab_entity_period_uniq").on(t.labId, t.entity, t.period),
  }),
);

/** sms_logs — every SMS attempt with provider status for retry/audit. */
export const smsLogs = sqliteTable(
  "sms_logs",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    visitId: text("visit_id"),
    toPhone: text("to_phone").notNull(),
    body: text("body").notNull(),
    purpose: text("purpose", {
      enum: ["report_ready", "due_cleared", "manual_resend", "other"],
    })
      .notNull()
      .default("other"),
    provider: text("provider").notNull().default("mock"),
    status: text("status", { enum: ["queued", "sent", "failed"] })
      .notNull()
      .default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    sentBy: text("sent_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    visitIdx: index("sms_logs_visit_idx").on(t.visitId),
    statusIdx: index("sms_logs_status_idx").on(t.status),
  }),
);

/** email_logs — every email attempt with provider status (mirrors sms_logs). */
export const emailLogs = sqliteTable(
  "email_logs",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    visitId: text("visit_id"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    purpose: text("purpose", {
      enum: ["report_ready", "due_cleared", "manual_resend", "test", "other"],
    })
      .notNull()
      .default("other"),
    provider: text("provider").notNull().default("mock"),
    status: text("status", { enum: ["queued", "sent", "failed"] })
      .notNull()
      .default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentBy: text("sent_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    visitIdx: index("email_logs_visit_idx").on(t.visitId),
    statusIdx: index("email_logs_status_idx").on(t.status),
  }),
);

/** audit_logs — security-sensitive changes (who/what/when, before/after). */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: idCol(),
    labId: text("lab_id").references(() => labs.id),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    action: text("action").notNull(), // e.g. "visit.cancel", "user.create"
    entity: text("entity"), // table/domain name
    entityId: text("entity_id"),
    summary: text("summary"),
    meta: text("meta", { mode: "json" }),
    ip: text("ip"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    entityIdx: index("audit_logs_entity_idx").on(t.entity, t.entityId),
    actorIdx: index("audit_logs_actor_idx").on(t.actorId),
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
  }),
);

/** activity_logs — lightweight user activity feed for dashboards. */
export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    type: text("type").notNull(), // e.g. "patient_registered"
    message: text("message").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    labCreatedIdx: index("activity_logs_lab_created_idx").on(t.labId, t.createdAt),
  }),
);

/** app_settings — global key/value (super-admin scope). */
export const appSettings = sqliteTable("app_settings", {
  id: idCol(),
  key: text("key").notNull().unique(),
  value: text("value", { mode: "json" }),
  ...timestamps,
});
