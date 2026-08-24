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

/**
 * Fetches the ZIP as a blob rather than a raw form POST so failures (bad
 * PIN, unpublished event, server error) and partial results (the server's
 * MAX_ZIP_PHOTOS cap) can be reported instead of the browser silently doing
 * nothing.
 */
export async function downloadZipOf(
  eventId: string,
  photoIds: string[],
  variant: "original" | "display" = "original",
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
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "photos.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  track(eventId, "download");

  if (res.headers.get("x-zip-truncated") === "1") {
    const total = res.headers.get("x-zip-total");
    const included = res.headers.get("x-zip-included");
    return { truncated: true as const, total, included };
  }
  return { truncated: false as const };
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
