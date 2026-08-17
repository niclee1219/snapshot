import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDbAsync } from "@/db";
import { photos } from "@/db/schema";
import { requireOwnedEvent } from "@/lib/auth";
import { photoKey } from "@/lib/media";

type UploadedPhoto = {
  uid: string;
  ext: string;
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  capturedAt: number | null;
};

/** Records metadata after the browser has PUT all three variants to R2. */
export async function POST(req: NextRequest) {
  const { eventId, uploaded } = (await req.json()) as {
    eventId: string;
    uploaded: UploadedPhoto[];
  };
  const { company, event } = await requireOwnedEvent(eventId);

  if (!Array.isArray(uploaded) || uploaded.length === 0 || uploaded.length > 50) {
    return new NextResponse("Send 1-50 photos per request", { status: 400 });
  }

  const db = await getDbAsync();
  const last = await db
    .select({ sortIndex: photos.sortIndex })
    .from(photos)
    .where(eq(photos.eventId, event.id))
    .orderBy(desc(photos.sortIndex))
    .limit(1)
    .get();
  let nextIndex = (last?.sortIndex ?? -1) + 1;

  const rows = uploaded.map((p) => {
    const ext = p.ext.toLowerCase().replace("jpeg", "jpg");
    return {
      id: nanoid(),
      eventId: event.id,
      keyOriginal: photoKey(company.id, event.id, p.uid, "original", ext),
      keyDisplay: photoKey(company.id, event.id, p.uid, "display", "webp"),
      keyThumb: photoKey(company.id, event.id, p.uid, "thumb", "webp"),
      fileName: p.fileName.slice(0, 200),
      width: Math.max(1, Math.floor(p.width)),
      height: Math.max(1, Math.floor(p.height)),
      sizeBytes: Math.max(0, Math.floor(p.sizeBytes)),
      capturedAt: p.capturedAt ? new Date(p.capturedAt) : null,
      sortIndex: nextIndex++,
    };
  });

  // Each row binds 11 params; D1 caps bound parameters at 100 per statement, so
  // a single insert of >9 rows (>99 params) throws. Chunk into multiple insert
  // statements and submit them together via db.batch() to keep this one atomic
  // round-trip — mirrors the chunking pattern used for reorderPhotos/deletePhotos.
  const ROWS_PER_INSERT = 9;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    chunks.push(rows.slice(i, i + ROWS_PER_INSERT));
  }
  const statements = chunks.map((chunk) => db.insert(photos).values(chunk));
  await db.batch([statements[0], ...statements.slice(1)]);
  return NextResponse.json({ ok: true, count: rows.length });
}
