import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getCompanyBySlug,
  getEventCoverPhoto,
  getEventSegments,
  getPublishedEvent,
  getVisiblePhotos,
} from "@/lib/tenant";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { pinCookieName, verifyAccessCookieValue } from "@/lib/pin";
import { getDbAsync } from "@/db";
import { events, photos } from "@/db/schema";
import { Gallery, type GalleryPhoto } from "@/components/gallery/gallery";
import { PinGate } from "@/components/gallery/pin-gate";
import { cn } from "@/lib/utils";

type Params = Promise<{ slug: string; eventSlug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, eventSlug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};
  const event = await getPublishedEvent(company.id, eventSlug);
  if (!event) return { title: company.name };

  const [mediaBase, cover] = await Promise.all([
    getMediaBase(),
    getEventCoverPhoto(event),
  ]);
  const imageUrl = cover ? mediaUrl(mediaBase, cover.keyDisplay) : undefined;

  return {
    title: event.name,
    openGraph: {
      title: event.name,
      description: company.name,
      siteName: company.name,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description: company.name,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function EventGalleryPage({
  params,
}: {
  params: Params;
}) {
  const { slug, eventSlug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const event = await getPublishedEvent(company.id, eventSlug);
  if (!event) notFound();

  const accent = event.accentColor ?? company.accentColor ?? undefined;
  const theme = event.theme ?? company.theme;
  const surfaceClass = cn(
    "gallery-root gallery-surface",
    theme === "light" && "gallery-light",
  );

  if (event.pinHash) {
    const jar = await cookies();
    const ok = await verifyAccessCookieValue(
      event.id,
      jar.get(pinCookieName(event.id))?.value,
    );
    if (!ok) {
      return (
        <div className={surfaceClass}>
          <PinGate
            slug={slug}
            eventSlug={eventSlug}
            eventName={event.name}
            accent={accent}
          />
        </div>
      );
    }
  }

  const [rows, mediaBase, eventSegments] = await Promise.all([
    getVisiblePhotos(event.id, event.sortMode),
    getMediaBase(),
    getEventSegments(event.id),
  ]);

  // Count the gallery view without blocking the response.
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    const bump = (async () => {
      const db = await getDbAsync();
      await db
        .update(events)
        .set({ viewCount: sql`${events.viewCount} + 1` })
        .where(eq(events.id, event.id));
    })();
    ctx.waitUntil(bump);
  } catch {
    // next dev without a waitUntil context — not worth failing the page.
  }

  const galleryPhotos: GalleryPhoto[] = rows.map((p) => ({
    id: p.id,
    thumbUrl: mediaUrl(mediaBase, p.keyThumb),
    displayUrl: mediaUrl(mediaBase, p.keyDisplay),
    originalUrl: mediaUrl(mediaBase, p.keyOriginal),
    fileName: p.fileName,
    width: p.width,
    height: p.height,
    segmentId: p.segmentId,
  }));

  const cover = event.coverPhotoId
    ? rows.find((p) => p.id === event.coverPhotoId)
    : undefined;

  const db = await getDbAsync();
  const explicitCoverRow =
    !cover && event.coverPhotoId
      ? await db
          .select()
          .from(photos)
          .where(eq(photos.id, event.coverPhotoId))
          .get()
      : cover;

  // Fall back to the first visible photo (in the event's configured sort
  // order) when there's no explicit cover — or the explicit cover photo
  // no longer exists. Feeds both the hero image and the cinematic intro.
  const coverRow = explicitCoverRow ?? rows[0];

  return (
    <div className={surfaceClass}>
      <Gallery
        eventId={event.id}
        eventName={event.name}
        eventDate={event.eventDate}
        welcomeMessage={event.welcomeMessage}
        companyName={company.name}
        logoUrl={company.logoKey ? mediaUrl(mediaBase, company.logoKey) : null}
        coverUrl={coverRow ? mediaUrl(mediaBase, coverRow.keyDisplay) : null}
        accent={accent}
        photos={galleryPhotos}
        segments={eventSegments.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
