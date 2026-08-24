import type { GalleryPhoto } from "./gallery";

export function track(eventId: string, kind: "download" | "share") {
  fetch("/api/public/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId, kind }),
    keepalive: true,
  }).catch(() => {});
}

export async function downloadSingle(
  eventId: string,
  photo: GalleryPhoto,
  variant: "original" | "display" = "original",
) {
  const res = await fetch(
    variant === "display" ? photo.displayUrl : photo.originalUrl,
    // The lightbox's <img> tag loads this same URL without an Origin header
    // (no-cors), and R2 caches that response for 4h without CORS headers.
    // A cache-mode fetch() would reuse that cached response and fail CORS
    // instantly without ever hitting the network — force a real request.
    { cache: "reload" },
  );
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = photo.fileName || "photo.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  track(eventId, "download");
}

const ZIP_ERROR_MESSAGES: Record<number, string> = {
  400: "That download request was invalid — please try again.",
  403: "This gallery is PIN-protected — unlock it and try again.",
  404: "Those photos couldn't be found — try refreshing the page.",
};

// Workers has a hard 128MB memory ceiling (fixed on every plan — it can't be
// raised), and streaming a very large ZIP through a single request eventually
// trips it. Splitting a big selection into several smaller ZIP requests keeps
// each one comfortably clear of that ceiling regardless of total gallery size.
const MAX_BATCH_PHOTOS = 80;
const MAX_BATCH_BYTES = 300 * 1024 * 1024;

function batchPhotosForZip(photos: GalleryPhoto[]): GalleryPhoto[][] {
  const batches: GalleryPhoto[][] = [];
  let current: GalleryPhoto[] = [];
  let currentBytes = 0;
  for (const photo of photos) {
    const wouldOverflow =
      current.length >= MAX_BATCH_PHOTOS ||
      (current.length > 0 && currentBytes + photo.sizeBytes > MAX_BATCH_BYTES);
    if (wouldOverflow) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(photo);
    currentBytes += photo.sizeBytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, "_") || "photos";
}

/** Fetches one ZIP batch as a blob and triggers a client-side save. */
async function downloadZipBatch(
  eventId: string,
  photoIds: string[],
  variant: "original" | "display",
  filenameOverride?: string,
) {
  const res = await fetch("/api/public/zip", {
    method: "POST",
    body: new URLSearchParams({
      eventId,
      ids: photoIds.join(","),
      variant,
    }),
  });

  if (!res.ok) {
    throw new Error(ZIP_ERROR_MESSAGES[res.status] ?? "Download failed");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const serverFilename =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? "photos.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameOverride ?? serverFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads a selection as one or more ZIPs, splitting large selections into
 * multiple smaller downloads (see MAX_BATCH_* above) so no single request
 * risks the Worker's memory ceiling. Fetches each batch as a blob (rather
 * than a raw form POST) so failures and partial results can be reported
 * instead of the browser silently doing nothing.
 */
export async function downloadZipOf(
  eventId: string,
  eventName: string,
  photos: GalleryPhoto[],
  variant: "original" | "display" = "original",
  onProgress?: (part: number, total: number) => void,
) {
  const batches = batchPhotosForZip(photos);
  const multiPart = batches.length > 1;

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);
    const filename = multiPart
      ? `${sanitizeFilename(eventName)}-photos-part${i + 1}-of-${batches.length}.zip`
      : undefined;
    await downloadZipBatch(
      eventId,
      batches[i].map((p) => p.id),
      variant,
      filename,
    );
  }

  track(eventId, "download");
  return { parts: batches.length };
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !("canShare" in navigator)) {
    return false;
  }
  try {
    const probe = new File([""], "probe.jpg", { type: "image/jpeg" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

const SHARE_LIMIT = 10;

export async function sharePhotos(
  eventId: string,
  photos: GalleryPhoto[],
  title: string,
): Promise<"shared" | "too-many" | "unsupported" | "failed"> {
  if (photos.length > SHARE_LIMIT) return "too-many";
  if (!canShareFiles()) return "unsupported";

  let files: File[];
  try {
    // Share uses the compressed display variant (~1600px WebP), not the
    // full-resolution original — sharing is for quick viewing, not
    // archival, and originals can be 10MB+ each, making the share sheet
    // slow to open or falling back to a huge ZIP download.
    files = await Promise.all(
      photos.map(async (p) => {
        // See downloadSingle: force a real network request so the cached,
        // Origin-less <img> response (no CORS headers, 4h TTL) isn't reused.
        const res = await fetch(p.displayUrl, { cache: "reload" });
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const blob = await res.blob();
        const name = (p.fileName || "photo.jpg").replace(/\.\w+$/, ".webp");
        return new File([blob], name, {
          type: blob.type || "image/webp",
        });
      }),
    );
  } catch {
    // A fetch failing here used to throw straight out of sharePhotos,
    // uncaught by any caller — the Share button would just go silent with
    // no fallback. Report "failed" instead so callers fall back to a
    // regular download, same as when navigator.share() itself fails below.
    return "failed";
  }

  // Deliberately no `navigator.canShare({ files })` pre-check here: several
  // mobile browsers (notably Android Chrome/WebView) under-report `false`
  // for multi-file arrays even though the actual navigator.share() call
  // below succeeds with those same files — gating on it here blocked every
  // multi-photo share and forced the ZIP-download fallback. Just attempt
  // the real share and let the catch below handle genuine failures.
  try {
    await navigator.share({ files, title });
    track(eventId, "share");
    return "shared";
  } catch (err) {
    // AbortError = user closed the sheet; not a failure worth surfacing.
    if (err instanceof DOMException && err.name === "AbortError") {
      return "shared";
    }
    return "failed";
  }
}
