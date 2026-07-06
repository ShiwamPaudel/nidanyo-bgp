import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { idCol, timestamps, actorColumns } from "./_shared";
import { labs } from "./lab";

/**
 * roles — RBAC roles. `permissions` is a JSON array of permission keys
 * (see src/lib/rbac/permissions.ts). `key` is a stable machine name.
 * System roles cannot be deleted.
 */
export const roles = sqliteTable("roles", {
  id: idCol(),
  labId: text("lab_id").references(() => labs.id), // null => global/system role
  key: text("key").notNull(), // e.g. "lab_admin", "reception"
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default([]),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/**
 * users — staff accounts. No public registration; admins create users.
 * Passwords are bcrypt-hashed. `roleKey` denormalizes the primary role for
 * fast checks; `roleId` is the canonical FK.
 */
export const users = sqliteTable(
  "users",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    roleKey: text("role_key").notNull(),
    designation: text("designation"), // e.g. "MD Pathologist" — used on reports
    registrationNo: text("registration_no"), // medical council reg no for doctors
    signatureAssetId: text("signature_asset_id"), // -> lab_assets.id
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
    ...actorColumns,
  },
  (t) => ({
    labIdx: index("users_lab_idx").on(t.labId),
    roleIdx: index("users_role_idx").on(t.roleKey),
  }),
);

/**
 * sessions — server-side session records (cookie holds only the signed id).
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: idCol(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);
