import { integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

/** Generate a collision-resistant internal id. */
export const newId = () => randomUUID();

/** Standard primary key column (internal UUID, never shown to users). */
export const idCol = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId());

/** Audit timestamp columns shared by most tables. */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdateFn(() => new Date()),
};

/** Who-did-it columns (nullable text user ids). */
export const actorColumns = {
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
};
