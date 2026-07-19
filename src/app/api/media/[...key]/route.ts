import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest } from "next/server";

/**
 * Dev / fallback media server: streams objects from the R2 binding.
 * In production, photos are served from the bucket's custom domain instead
 * (MEDIA_BASE_URL), so this route sees no traffic there.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const objectKey = key.map(decodeURIComponent).join("/");

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MEDIA.get(objectKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  if (!headers.has("content-type")) {
    headers.set("content-type", guessContentType(objectKey));
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

function guessContentType(key: string): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
