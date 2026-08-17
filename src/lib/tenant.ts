import { and, asc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db";
import { companies, events, photos, segments } from "@/db/schema";

export async function getCompanyBySlug(slug: string) {
  const db = await getDbAsync();
  return (
    (await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug.toLowerCase()))
      .get()) ?? null
  );
}

export async function getPublishedEvents(companyId: string) {
  const db = await getDbAsync();
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.companyId, companyId),
        eq(events.published, true),
        eq(events.showOnHomepage, true),
      ),
    )
    .orderBy(asc(events.eventDate))
    .all();
}

export async function getPublishedEvent(companyId: string, urlSlug: string) {
  const db = await getDbAsync();
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.companyId, companyId), eq(events.urlSlug, urlSlug)))
    .get();
  if (!event || !event.published) return null;
  return event;
}

/** Visible photos in the event's configured order. */
export async function getVisiblePhotos(eventId: string, sortMode: string) {
  const db = await getDbAsync();
  const orderBy =
    sortMode === "manual"
      ? [asc(photos.sortIndex), asc(photos.createdAt)]
      : [asc(photos.capturedAt), asc(photos.createdAt)];
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.eventId, eventId), eq(photos.hidden, false)))
    .orderBy(...orderBy)
    .all();
}

/** The event's designated cover photo, falling back to the first visible photo
 * in the event's configured sort order (including when the designated cover
 * has been hidden or deleted). Returns null for an event with no photos. */
export async function getEventCoverPhoto(event: {
  id: string;
  coverPhotoId: string | null;
  sortMode: string;
}) {
  const db = await getDbAsync();
  if (event.coverPhotoId) {
    const cover = await db
      .select()
      .from(photos)
      .where(eq(photos.id, event.coverPhotoId))
      .get();
    if (cover) return cover;
  }
  const orderBy =
    event.sortMode === "manual"
      ? [asc(photos.sortIndex), asc(photos.createdAt)]
      : [asc(photos.capturedAt), asc(photos.createdAt)];
  return (
    (await db
      .select()
      .from(photos)
      .where(and(eq(photos.eventId, event.id), eq(photos.hidden, false)))
      .orderBy(...orderBy)
      .limit(1)
      .get()) ?? null
  );
}

/** Segments for an event, in configured display order. */
export async function getEventSegments(eventId: string) {
  const db = await getDbAsync();
  return db
    .select()
    .from(segments)
    .where(eq(segments.eventId, eventId))
    .orderBy(asc(segments.sortIndex))
    .all();
}
