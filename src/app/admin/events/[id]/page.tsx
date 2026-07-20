import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { requireOwnedEvent } from "@/lib/auth";
import { getDbAsync } from "@/db";
import { photos } from "@/db/schema";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { Separator } from "@/components/ui/separator";
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

  const storageRow = await db
    .select({ bytes: sql<number>`sum(${photos.sizeBytes})` })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .get();

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <EventHeader
          event={{
            id: event.id,
            name: event.name,
            published: event.published,
            publicUrl: `https://${company.slug}.pixolateds.com/${event.urlSlug}`,
            eventDate: event.eventDate,
            photoCount: rows.length,
            storageBytes: Number(storageRow?.bytes ?? 0),
            viewCount: event.viewCount,
            downloadCount: event.downloadCount,
          }}
        />
        <Separator />
      </div>

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
          theme: event.theme,
        }}
      />

      <PhotoManager eventId={event.id} photos={adminPhotos} />
    </div>
  );
}
