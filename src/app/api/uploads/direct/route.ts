import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireCompany } from "@/lib/auth";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Dev / fallback upload path: streams the request body into the R2 binding.
 * Production uploads normally use presigned URLs and never hit this route.
 */
export async function PUT(req: NextRequest) {
  const company = await requireCompany();
  const key = req.nextUrl.searchParams.get("key") ?? "";

  // Admins may only write inside their own prefix.
  if (!key.startsWith(`${company.id}/`) || key.includes("..")) {
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
