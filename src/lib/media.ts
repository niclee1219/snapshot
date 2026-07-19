import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Base URL photos are served from. In production this is the R2 bucket's
 * custom domain (free egress, edge-cached, zero Worker invocations).
 * Locally (or before the custom domain exists) MEDIA_BASE_URL is empty and
 * photos are streamed through /api/media/* from the R2 binding.
 */
export async function getMediaBase(): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  return env.MEDIA_BASE_URL || "/api/media";
}

export function mediaUrl(base: string, key: string): string {
  return `${base}/${key}`;
}

export type PhotoVariant = "original" | "display" | "thumb";

export function photoKey(
  companyId: string,
  eventId: string,
  photoUid: string,
  variant: PhotoVariant,
  ext: string,
): string {
  return `${companyId}/${eventId}/${photoUid}/${variant}.${ext}`;
}
