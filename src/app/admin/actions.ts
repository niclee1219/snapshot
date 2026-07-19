"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/db";
import { companies, events, photos } from "@/db/schema";
import { requireUserId, requireCompany, requireOwnedEvent } from "@/lib/auth";
import { slugify, validateCompanySlug } from "@/lib/slugs";
import { hashPin } from "@/lib/pin";

// ── Onboarding ────────────────────────────────────────────────────────────────

export type ActionState = { error?: string } | null;

export async function claimSlug(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (!name) return { error: "Company name is required." };
  const slugError = validateCompanySlug(slug);
  if (slugError) return { error: slugError };

  const db = await getDbAsync();
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.clerkUserId, userId))
    .get();
  if (existing) redirect("/admin");

  const taken = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .get();
  if (taken) return { error: "That subdomain is already taken." };

  await db.insert(companies).values({
    id: nanoid(),
    clerkUserId: userId,
    name,
    slug,
  });
  redirect("/admin");
}

// ── Company settings ──────────────────────────────────────────────────────────

export async function updateCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const company = await requireCompany();
  const name = String(formData.get("name") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "").trim() || null;
  const logoKey = formData.get("logoKey");

  if (!name) return { error: "Company name is required." };

  const db = await getDbAsync();
  await db
    .update(companies)
    .set({
      name,
      accentColor,
      ...(typeof logoKey === "string" && logoKey !== ""
        ? { logoKey }
        : {}),
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
  const company = await requireCompany();
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

  const db = await getDbAsync();
  await db
    .update(events)
    .set({ name, eventDate, welcomeMessage, accentColor, urlSlug })
    .where(eq(events.id, event.id));
  revalidatePath(`/admin/events/${event.id}`);
  return null;
}

export async function setEventPublished(eventId: string, published: boolean) {
  const { event } = await requireOwnedEvent(eventId);
  const db = await getDbAsync();
  await db
    .update(events)
    .set({ published })
    .where(eq(events.id, event.id));
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
  await db.update(events).set({ sortMode: mode }).where(eq(events.id, event.id));
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
    .orderBy(asc(photos.sortIndex), asc(photos.capturedAt), asc(photos.createdAt))
    .all();
}
