import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { idCol, timestamps, actorColumns } from "./_shared";
import { labs } from "./lab";

/**
 * patients — master patient record. `code` is the human-readable UHID.
 * Age is stored as value+unit captured at registration; dob optional.
 */
export const patients = sqliteTable(
  "patients",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    code: text("code").notNull(), // UHID e.g. P-000123
    fullName: text("full_name").notNull(),
    gender: text("gender", { enum: ["male", "female", "other"] }).notNull(),
    ageValue: integer("age_value"),
    ageUnit: text("age_unit", { enum: ["years", "months", "days"] }).default("years"),
    dob: integer("dob", { mode: "timestamp" }),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    referredBy: text("referred_by"), // doctor/clinic/hospital
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
    ...actorColumns,
  },
  (t) => ({
    labCodeIdx: index("patients_lab_code_idx").on(t.labId, t.code),
    phoneIdx: index("patients_phone_idx").on(t.phone),
    nameIdx: index("patients_name_idx").on(t.fullName),
    // (lab_id, is_active, created_at) — the patient list is the busiest screen
    // in the app and is always "active patients, newest first". The lab+code
    // index above cannot serve that ordering, so every page load sorted the
    // whole patient table to return 20 rows.
    labActiveCreatedIdx: index("patients_lab_active_created_idx").on(t.labId, t.isActive, t.createdAt),
  }),
);
