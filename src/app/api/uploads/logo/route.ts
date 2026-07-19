import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireCompany } from "@/lib/auth";

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "svg"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function PUT(req: NextRequest) {
  const company = await requireCompany();
  const ext = (req.nextUrl.searchParams.get("ext") ?? "png").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return new NextResponse("Unsupported file type", { status: 400 });
  }
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_LOGO_BYTES) {
    return new NextResponse("Logo must be under 2MB", { status: 400 });
  }

  const key = `${company.id}/logo/${nanoid()}.${ext}`;
  const { env } = await getCloudflareContext({ async: true });
  await env.MEDIA.put(key, body, {
    httpMetadata: { contentType: contentTypeFor(ext) },
  });
  return NextResponse.json({ key });
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}
