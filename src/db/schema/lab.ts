import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { idCol, timestamps, actorColumns } from "./_shared";

/**
 * labs — top-level tenant. The schema is multi-lab ready; the MVP seeds one lab.
 */
export const labs = sqliteTable("labs", {
  id: idCol(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // short slug, e.g. "demo"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

/**
 * lab_settings — per-lab profile + preferences. One row per lab.
 */
export const labSettings = sqliteTable("lab_settings", {
  id: idCol(),
  labId: text("lab_id")
    .notNull()
    .references(() => labs.id),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  panVat: text("pan_vat"),
  // Display preferences
  calendarSystem: text("calendar_system", { enum: ["AD", "BS"] }).notNull().default("AD"),
  // Financial preferences
  currency: text("currency").notNull().default("NPR"),
  taxEnabled: integer("tax_enabled", { mode: "boolean" }).notNull().default(false),
  taxPercent: integer("tax_percent").notNull().default(0),
  // Report/bill layout preferences (margins in mm)
  reportMarginTopMm: integer("report_margin_top_mm").notNull().default(38),
  reportMarginBottomMm: integer("report_margin_bottom_mm").notNull().default(30),
  reportMarginXMm: integer("report_margin_x_mm").notNull().default(12),
  // Public link base + number prefixes
  shortLinkBaseUrl: text("short_link_base_url"),
  patientPrefix: text("patient_prefix").notNull().default("P"),
  visitPrefix: text("visit_prefix").notNull().default("V"),
  billPrefix: text("bill_prefix").notNull().default("B"),
  samplePrefix: text("sample_prefix").notNull().default("S"),
  // Public report extra verification (ask phone last 4 before showing)
  requirePhoneVerification: integer("require_phone_verification", { mode: "boolean" })
    .notNull()
    .default(false),
  ...timestamps,
  ...actorColumns,
});

/**
 * lab_assets — uploaded header/footer/logo/signature images via storage adapter.
 * `kind` distinguishes asset usage; `ownerUserId` links signatures to a doctor.
 */
export const labAssets = sqliteTable(
  "lab_assets",
  {
    id: idCol(),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id),
    kind: text("kind", {
      enum: ["report_header", "report_footer", "bill_header", "bill_footer", "logo", "signature"],
    }).notNull(),
    ownerUserId: text("owner_user_id"), // for signatures
    storageKey: text("storage_key").notNull(), // adapter key/path
    url: text("url").notNull(), // resolved public/serving url
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
    ...actorColumns,
  },
  (t) => ({
    labKindIdx: index("lab_assets_lab_kind_idx").on(t.labId, t.kind),
  }),
);

/**
 * asset_blobs — raw bytes for uploaded assets when STORAGE_PROVIDER="db".
 * Kept separate from lab_assets so metadata queries never load blob bytes;
 * the bytes are streamed only by the /api/asset/[key] route. `key` matches
 * lab_assets.storage_key.
 */
export const assetBlobs = sqliteTable("asset_blobs", {
  key: text("key").primaryKey(),
  data: blob("data", { mode: "buffer" }).notNull(),
  mimeType: text("mime_type"),
  size: integer("size"),
  ...timestamps,
});
