// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  created: text("created").notNull(),
});
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    endpoint: text("endpoint").notNull(),
    created: text("created").notNull(),
  },
  (t) => [
    uniqueIndex("subscriptions_endpoint").on(t.endpoint),
    index("subscriptions_owner").on(t.owner),
  ],
);
export const runtimeStatus = sqliteTable("runtime_status", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
});
export const pets = sqliteTable(
  "pets",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    data: text("data").notNull(),
  },
  (t) => [index("pets_owner").on(t.owner)],
);
export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    petId: text("pet_id").notNull(),
    data: text("data").notNull(),
    cutoff: text("cutoff"),
    version: integer("version").notNull().default(1),
    deleted: integer("deleted").notNull().default(0),
    sourceKey: text("source_key"),
  },
  (t) => [
    index("schedules_owner").on(t.owner),
    uniqueIndex("schedule_source").on(t.owner, t.sourceKey),
  ],
);
export const instances = sqliteTable(
  "instances",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    scheduleId: text("schedule_id").notNull(),
    at: text("at").notNull(),
    status: text("status").notNull().default("pending"),
    override: text("override"),
    snooze: text("snooze"),
    updated: text("updated").notNull(),
  },
  (t) => [
    uniqueIndex("instance_occurrence").on(t.scheduleId, t.at),
    index("instances_owner").on(t.owner),
  ],
);
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    petId: text("pet_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    hash: text("hash").notNull(),
    objectKey: text("object_key").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull(),
    data: text("data").notNull().default("{}"),
    created: text("created").notNull(),
  },
  (t) => [
    uniqueIndex("document_hash").on(t.owner, t.petId, t.hash, t.purpose),
    index("documents_owner").on(t.owner),
  ],
);
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    petId: text("pet_id").notNull(),
    documentId: text("document_id").notNull(),
    data: text("data").notNull(),
    created: text("created").notNull(),
  },
  (t) => [
    uniqueIndex("record_document").on(t.owner, t.documentId),
    index("records_owner").on(t.owner),
  ],
);
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    scheduleId: text("schedule_id").notNull(),
    at: text("at").notNull(),
    due: text("due").notNull(),
    title: text("title").notNull(),
    state: text("state").notNull().default("pending"),
    deviceClaim: text("device_claim"),
    version: integer("version").notNull(),
  },
  (t) => [index("notifications_due").on(t.owner, t.state, t.due)],
);
