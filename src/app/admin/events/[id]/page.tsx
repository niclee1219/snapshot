import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireOwnedEvent } from "@/lib/auth";
import { getDbAsync } from "@/db";
import { photos } from "@/db/schema";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { EventHeader } from "./event-header";
import { EventSettingsForm } from "./event-settings-form";
import { PhotoManager, type AdminPhoto } from "./photo-manager";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { company, event } = await requireOwnedEvent(id).catch(() => ({
    company: null,
    event: null,
  }));
  if (!company || !event) notFound();

  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .orderBy(asc(photos.sortIndex), asc(photos.capturedAt), asc(photos.createdAt))
    .all();

  const mediaBase = await getMediaBase();
  const adminPhotos: AdminPhoto[] = rows.map((p) => ({
    id: p.id,
    thumbUrl: mediaUrl(mediaBase, p.keyThumb),
    fileName: p.fileName,
    width: p.width,
    height: p.height,
    hidden: p.hidden,
    isCover: p.id === event.coverPhotoId,
  }));

  return (
    <div className="space-y-8">
      <EventHeader
        event={{
          id: event.id,
          name: event.name,
          published: event.published,
          publicUrl: `https://${company.slug}.pixolateds.com/${event.urlSlug}`,
          previewPath: `/s/${company.slug}/${event.urlSlug}`,
          viewCount: event.viewCount,
          downloadCount: event.downloadCount,
        }}
      />

      <EventSettingsForm
        event={{
          id: event.id,
          name: event.name,
          urlSlug: event.urlSlug,
          eventDate: event.eventDate ?? "",
          welcomeMessage: event.welcomeMessage ?? "",
          accentColor: event.accentColor ?? "",
          published: event.published,
          hasPin: !!event.pinHash,
          sortMode: event.sortMode as "capture" | "manual",
        }}
      />

      <PhotoManager eventId={event.id} photos={adminPhotos} />
    </div>
  );
}
