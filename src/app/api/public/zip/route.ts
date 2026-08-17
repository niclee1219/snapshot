import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { downloadZip } from "client-zip";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbAsync } from "@/db";
import { events, photos } from "@/db/schema";
import { pinCookieName, verifyAccessCookieValue } from "@/lib/pin";

const MAX_ZIP_PHOTOS = 500;

/**
 * Streams a ZIP of photos straight from R2 through the Worker — no
 * buffering, no compression (photos are already compressed), free egress.
 * Invoked via form POST so the browser natively streams the download.
 *
 * `variant` picks which R2 object per photo: "original" (full-res, as
 * uploaded, up to 30MB) for genuine downloads, or "display" (resized
 * ~1600px WebP) for the Share button's fallback path, where the point is
 * speed, not archival quality.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const eventId = String(form.get("eventId") ?? "");
  const variant = form.get("variant") === "display" ? "display" : "original";
  const ids = String(form.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_ZIP_PHOTOS);

  if (!eventId || ids.length === 0) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const db = await getDbAsync();
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .get();
  if (!event || !event.published) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (event.pinHash) {
    const ok = await verifyAccessCookieValue(
      event.id,
      req.cookies.get(pinCookieName(event.id))?.value,
    );
    if (!ok) return new NextResponse("PIN required", { status: 403 });
  }

  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.eventId, event.id),
        eq(photos.hidden, false),
        inArray(photos.id, ids),
      ),
    )
    .all();
  if (rows.length === 0) {
    return new NextResponse("No photos", { status: 404 });
  }

  const { env, ctx } = await getCloudflareContext({ async: true });

  ctx.waitUntil(
    db
      .update(events)
      .set({ downloadCount: sql`${events.downloadCount} + 1` })
      .where(eq(events.id, event.id))
      .then(() => {}),
  );

  const seen = new Map<string, number>();
  async function* entries() {
    for (const row of rows) {
      const key = variant === "display" ? row.keyDisplay : row.keyOriginal;
      const object = await env.MEDIA.get(key);
      if (!object) continue;
      let name = row.fileName || "photo.jpg";
      if (variant === "display") name = name.replace(/\.\w+$/, ".webp");
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      if (n > 1) {
        const dot = name.lastIndexOf(".");
        name =
          dot > 0
            ? `${name.slice(0, dot)} (${n})${name.slice(dot)}`
            : `${name} (${n})`;
      }
      yield {
        name,
        lastModified: row.capturedAt ?? row.createdAt,
        input: object.body as ReadableStream,
      };
    }
  }

  const zip = downloadZip(entries());
  const headers = new Headers(zip.headers);
  headers.set(
    "content-disposition",
    `attachment; filename="${sanitize(event.urlSlug)}-photos.zip"`,
  );
  return new Response(zip.body, { headers });
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, "_") || "photos";
}
