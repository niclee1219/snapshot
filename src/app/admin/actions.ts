"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/db";
import { companies, events, photos, segments } from "@/db/schema";
import {
  ACTIVE_SPACE_COOKIE,
  assertAllowedAdmin,
  requireUserId,
  requireActiveCompany,
  requireOwnedEvent,
} from "@/lib/auth";
import { slugify, validateCompanySlug } from "@/lib/slugs";
import { hashPin } from "@/lib/pin";

// ── Spaces ────────────────────────────────────────────────────────────────────

export type ActionState = { error?: string } | null;

async function setActiveSpaceCookie(companyId: string) {
  const store = await cookies();
  store.set(ACTIVE_SPACE_COOKIE, companyId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Switches the active space cookie to a company the user owns. */
export async function setActiveSpace(companyId: string): Promise<void> {
  const userId = await requireUserId();
  const db = await getDbAsync();
  const company = await db
    .select({ id: companies.id, clerkUserId: companies.clerkUserId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company || company.clerkUserId !== userId) {
    throw new Error("Space not found");
  }
  await setActiveSpaceCookie(companyId);
  redirect("/admin");
}

/** Creates a new space for the signed-in user and makes it active. */
export async function createSpace(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAllowedAdmin();
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (!name) return { error: "Company name is required." };
  const slugError = validateCompanySlug(slug);
  if (slugError) return { error: slugError };

  const db = await getDbAsync();
  const taken = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .get();
  if (taken) return { error: "That subdomain is already taken." };

  const id = nanoid();
  await db.insert(companies).values({
    id,
    clerkUserId: userId,
    name,
    slug,
  });
  await setActiveSpaceCookie(id);
  redirect("/admin");
}

/** Thin alias kept so the existing onboarding form keeps working unchanged. */
export async function claimSlug(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return createSpace(prev, formData);
}

/** Deletes a space: R2 objects under its prefix, then the DB row (FK cascade). */
export async function deleteSpace(
  companyId: string,
  confirmText: string,
): Promise<ActionState> {
  const userId = await requireUserId();
  const db = await getDbAsync();
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company || company.clerkUserId !== userId) {
    throw new Error("Space not found");
  }
  if (confirmText !== company.slug) {
    return { error: "Confirmation text does not match the space's subdomain." };
  }

  const { env } = await getCloudflareContext({ async: true });
  // Very large spaces (>~250k objects) would need a queue/waitUntil pattern
  // instead of blocking the action on this loop.
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({
      prefix: `${company.id}/`,
      cursor,
      limit: 1000,
    });
    if (page.objects.length) {
      await env.MEDIA.delete(page.objects.map((o) => o.key));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  await db.delete(companies).where(eq(companies.id, companyId));

  const store = await cookies();
  if (store.get(ACTIVE_SPACE_COOKIE)?.value === companyId) {
    store.delete(ACTIVE_SPACE_COOKIE);
  }
  redirect("/admin");
}

// ── Company settings ──────────────────────────────────────────────────────────

export async function updateCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const company = await requireActiveCompany();
  const name = String(formData.get("name") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "").trim() || null;
  const logoKey = formData.get("logoKey");

  if (!name) return { error: "Company name is required." };

  const themeField = formData.get("theme");
  let themeUpdate: { theme?: "dark" | "light" } = {};
  if (themeField !== null) {
    const themeStr = String(themeField);
    if (themeStr !== "dark" && themeStr !== "light") {
      return { error: "Invalid theme." };
    }
    themeUpdate = { theme: themeStr };
  }

  const db = await getDbAsync();
  await db
    .update(companies)
    .set({
      name,
      accentColor,
      ...themeUpdate,
      ...(typeof logoKey === "string" && logoKey !== "" ? { logoKey } : {}),
    })
    .where(eq(companies.id, company.id));
  revalidatePath("/admin");
  return null;
}

// ── Events ────────────────────────────────────────────────────────────────────

async function uniqueEventSlug(
  companyId: string,
  base: string,
  excludeEventId?: string,
): Promise<string> {
  const db = await getDbAsync();
  const rows = await db
    .select({ id: events.id, urlSlug: events.urlSlug })
    .from(events)
    .where(eq(events.companyId, companyId))
    .all();
  const taken = new Set(
    rows.filter((r) => r.id !== excludeEventId).map((r) => r.urlSlug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const company = await requireActiveCompany();
  const name = String(formData.get("name") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim() || null;

  if (!name) return { error: "Event name is required." };
  const base = slugify(name);
  if (!base) return { error: "Event name must contain letters or numbers." };

  const db = await getDbAsync();
  const id = nanoid();
  await db.insert(events).values({
    id,
    companyId: company.id,
    name,
    urlSlug: await uniqueEventSlug(company.id, base),
    eventDate,
  });
  redirect(`/admin/events/${id}`);
}

export async function updateEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { company, event } = await requireOwnedEvent(eventId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Event name is required." };

  const eventDate = String(formData.get("eventDate") ?? "").trim() || null;
  const welcomeMessage =
    String(formData.get("welcomeMessage") ?? "").trim() || null;
  const accentColor = String(formData.get("accentColor") ?? "").trim() || null;

  let urlSlug = event.urlSlug;
  const requestedSlug = slugify(String(formData.get("urlSlug") ?? ""));
  if (requestedSlug && requestedSlug !== event.urlSlug) {
    if (event.published) {
      return { error: "Unpublish the event before changing its URL." };
    }
    urlSlug = await uniqueEventSlug(company.id, requestedSlug, event.id);
  }

  const themeField = formData.get("theme");
  let themeUpdate: { theme?: "dark" | "light" | null } = {};
  if (themeField !== null) {
    const themeStr = String(themeField);
    if (themeStr === "" || themeStr === "default") {
      themeUpdate = { theme: null };
    } else if (themeStr === "dark" || themeStr === "light") {
      themeUpdate = { theme: themeStr };
    } else {
      return { error: "Invalid theme." };
    }
  }

  const db = await getDbAsync();
  await db
    .update(events)
    .set({
      name,
      eventDate,
      welcomeMessage,
      accentColor,
      urlSlug,
      ...themeUpdate,
    })
    .where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
  return null;
}

export async function setEventPublished(eventId: string, published: boolean) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  await db.update(events).set({ published }).where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
  revalidatePath("/admin");
}

export async function setEventPin(eventId: string, pin: string | null) {
  const { event } = await requireOwnedEvent(eventId);
  if (pin !== null && !/^\d{4,6}$/.test(pin)) {
    return { error: "PIN must be 4-6 digits." };
  }
  const db = await getDbAsync();
  await db
    .update(events)
    .set({ pinHash: pin === null ? null : await hashPin(pin) })
    .where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
  return null;
}

export async function deleteEvent(eventId: string) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  const rows = await db
    .select({
      original: photos.keyOriginal,
      display: photos.keyDisplay,
      thumb: photos.keyThumb,
    })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .all();

  const keys = rows.flatMap((r) => [r.original, r.display, r.thumb]);
  const { env } = await getCloudflareContext({ async: true });
  for (let i = 0; i < keys.length; i += 1000) {
    await env.MEDIA.delete(keys.slice(i, i + 1000));
  }

  await db.delete(photos).where(eq(photos.eventId, event.id));
  await db.delete(events).where(eq(events.id, event.id));
  redirect("/admin");
}

// ── Photos ────────────────────────────────────────────────────────────────────

export async function deletePhotos(eventId: string, photoIds: string[]) {
  const { event } = await requireOwnedEvent(eventId);
  if (photoIds.length === 0) return;
  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.eventId, event.id), inArray(photos.id, photoIds)))
    .all();

  const keys = rows.flatMap((r) => [r.keyOriginal, r.keyDisplay, r.keyThumb]);
  const { env } = await getCloudflareContext({ async: true });
  for (let i = 0; i < keys.length; i += 1000) {
    await env.MEDIA.delete(keys.slice(i, i + 1000));
  }

  await db
    .delete(photos)
    .where(and(eq(photos.eventId, event.id), inArray(photos.id, photoIds)));

  if (event.coverPhotoId && photoIds.includes(event.coverPhotoId)) {
    await db
      .update(events)
      .set({ coverPhotoId: null })
      .where(eq(events.id, event.id));
  }
  revalidatePath(`/admin/events/${event.id}`);
}

export async function setPhotosHidden(
  eventId: string,
  photoIds: string[],
  hidden: boolean,
) {
  const { event } = await requireOwnedEvent(eventId);
  if (photoIds.length === 0) return;
  const db = await getDbAsync();
  await db
    .update(photos)
    .set({ hidden })
    .where(and(eq(photos.eventId, event.id), inArray(photos.id, photoIds)));
  revalidatePath(`/admin/events/${event.id}`);
}

export async function setCoverPhoto(eventId: string, photoId: string | null) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  await db
    .update(events)
    .set({ coverPhotoId: photoId })
    .where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
}

export async function reorderPhotos(eventId: string, orderedIds: string[]) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  // Manual ordering becomes the sort mode once the admin rearranges.
  await db
    .update(events)
    .set({ sortMode: "manual" })
    .where(eq(events.id, event.id));
  const updates = orderedIds.map((id, i) =>
    db
      .update(photos)
      .set({ sortIndex: i })
      .where(and(eq(photos.eventId, event.id), eq(photos.id, id))),
  );
  // D1 batch keeps this a single round-trip per chunk instead of N queries.
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    await db.batch([chunk[0], ...chunk.slice(1)]);
  }
  revalidatePath(`/admin/events/${event.id}`);
}

export async function setSortMode(eventId: string, mode: "capture" | "manual") {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  await db
    .update(events)
    .set({ sortMode: mode })
    .where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
}

// Shared ordered-photo query used by admin page.
export async function listEventPhotos(eventId: string) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  return db
    .select()
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .orderBy(
      asc(photos.sortIndex),
      asc(photos.capturedAt),
      asc(photos.createdAt),
    )
    .all();
}

// ── Segments ──────────────────────────────────────────────────────────────────

/**
 * Looks up a segment by id and enforces the same ownership check as every
 * other action in this file, keyed via the segment's parent event. There's
 * no `requireOwnedEvent`-equivalent helper keyed by segment id in
 * `@/lib/auth`, so segment-id-scoped actions resolve ownership inline here.
 */
async function requireOwnedSegment(segmentId: string) {
  const db = await getDbAsync();
  const segment = await db
    .select()
    .from(segments)
    .where(eq(segments.id, segmentId))
    .get();
  if (!segment) throw new Error("Segment not found");
  const { company, event } = await requireOwnedEvent(segment.eventId);
  return { company, event, segment };
}

export async function createSegment(eventId: string, name: string) {
  const { event } = await requireOwnedEvent(eventId);
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Segment name is required.");
  const db = await getDbAsync();
  const existing = await db
    .select({ sortIndex: segments.sortIndex })
    .from(segments)
    .where(eq(segments.eventId, event.id))
    .all();
  const nextSortIndex =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((s) => s.sortIndex)) + 1;

  const id = nanoid();
  await db.insert(segments).values({
    id,
    eventId: event.id,
    name: trimmedName,
    sortIndex: nextSortIndex,
  });
  revalidatePath(`/admin/events/${event.id}`);
  return db.select().from(segments).where(eq(segments.id, id)).get();
}

export async function renameSegment(segmentId: string, name: string) {
  const { event, segment } = await requireOwnedSegment(segmentId);
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Segment name is required.");
  const db = await getDbAsync();
  await db
    .update(segments)
    .set({ name: trimmedName })
    .where(eq(segments.id, segment.id));
  revalidatePath(`/admin/events/${event.id}`);
}

export async function deleteSegment(segmentId: string) {
  const { event, segment } = await requireOwnedSegment(segmentId);
  const db = await getDbAsync();
  // The generated ADD-COLUMN migration for photos.segment_id does not carry
  // an ON DELETE SET NULL clause (a drizzle-kit/SQLite limitation), so the
  // FK will not cascade this automatically. Null out referencing photos
  // first, then delete the segment row, to avoid violating the FK (or
  // silently dangling if FK enforcement is off).
  await db
    .update(photos)
    .set({ segmentId: null })
    .where(eq(photos.segmentId, segment.id));
  await db.delete(segments).where(eq(segments.id, segment.id));
  revalidatePath(`/admin/events/${event.id}`);
}

export async function reorderSegments(eventId: string, orderedIds: string[]) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  const updates = orderedIds.map((id, i) =>
    db
      .update(segments)
      .set({ sortIndex: i })
      .where(and(eq(segments.eventId, event.id), eq(segments.id, id))),
  );
  // D1 batch keeps this a single round-trip per chunk instead of N queries.
  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    await db.batch([chunk[0], ...chunk.slice(1)]);
  }
  revalidatePath(`/admin/events/${event.id}`);
}

export async function assignPhotosToSegment(
  eventId: string,
  photoIds: string[],
  segmentId: string | null,
) {
  const { event } = await requireOwnedEvent(eventId);
  if (photoIds.length === 0) return;
  const db = await getDbAsync();

  if (segmentId !== null) {
    const segment = await db
      .select({ id: segments.id })
      .from(segments)
      .where(and(eq(segments.id, segmentId), eq(segments.eventId, event.id)))
      .get();
    if (!segment) throw new Error("Segment not found");
  }

  await db
    .update(photos)
    .set({ segmentId })
    .where(and(eq(photos.eventId, event.id), inArray(photos.id, photoIds)));
  revalidatePath(`/admin/events/${event.id}`);
}
