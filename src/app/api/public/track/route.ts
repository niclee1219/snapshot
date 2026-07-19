import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDbAsync } from "@/db";
import { events } from "@/db/schema";

export async function POST(req: NextRequest) {
  const { eventId, kind } = (await req.json()) as {
    eventId: string;
    kind: string;
  };
  if (typeof eventId !== "string" || !["download", "share"].includes(kind)) {
    return new NextResponse("Bad request", { status: 400 });
  }
  const db = await getDbAsync();
  await db
    .update(events)
    .set({ downloadCount: sql`${events.downloadCount} + 1` })
    .where(eq(events.id, eventId));
  return NextResponse.json({ ok: true });
}
