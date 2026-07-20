import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { getDbAsync } from "@/db";
import { companies } from "@/db/schema";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Dev / fallback upload path: streams the request body into the R2 binding.
 * Production uploads normally use presigned URLs and never hit this route.
 *
 * Ownership is derived from the key's own company-id prefix (set by the
 * presign route from the event's own company) rather than the active-space
 * cookie, so this stays correct even if the admin switched spaces mid-upload.
 */
export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const companyId = key.split("/")[0] ?? "";

  if (!companyId || !key.startsWith(`${companyId}/`) || key.includes("..")) {
    return new NextResponse("Invalid key", { status: 403 });
  }

  const db = await getDbAsync();
  const company = await db
    .select({ id: companies.id, clerkUserId: companies.clerkUserId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  if (!company || company.clerkUserId !== userId) {
    return new NextResponse("Invalid key", { status: 403 });
  }

  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_FILE_BYTES) {
    return new NextResponse("File must be under 30MB", { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  await env.MEDIA.put(key, body, {
    httpMetadata: {
      contentType: req.headers.get("content-type") ?? "application/octet-stream",
    },
  });
  return NextResponse.json({ ok: true });
}
