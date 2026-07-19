import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoKey: text("logo_key"),
  accentColor: text("accent_color"),
  plan: text("plan").notNull().default("unlimited"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    urlSlug: text("url_slug").notNull(),
    eventDate: text("event_date"), // ISO yyyy-mm-dd
    welcomeMessage: text("welcome_message"),
    coverPhotoId: text("cover_photo_id"),
    accentColor: text("accent_color"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    pinHash: text("pin_hash"),
    sortMode: text("sort_mode").notNull().default("capture"), // 'capture' | 'manual'
    viewCount: integer("view_count").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("events_company_slug_idx").on(t.companyId, t.urlSlug),
    index("events_company_idx").on(t.companyId),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    keyOriginal: text("key_original").notNull(),
    keyDisplay: text("key_display").notNull(),
    keyThumb: text("key_thumb").notNull(),
    fileName: text("file_name").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }),
    sortIndex: integer("sort_index").notNull().default(0),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("photos_event_idx").on(t.eventId)],
);

export type Company = typeof companies.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Photo = typeof photos.$inferSelect;
