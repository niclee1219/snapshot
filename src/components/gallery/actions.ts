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
  const res = await fetch(variant === "display" ? photo.displayUrl : photo.originalUrl);
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

/** Streams a ZIP via form POST so the browser downloads without buffering in JS. */
export function downloadZipOf(
  eventId: string,
  photoIds: string[],
  variant: "original" | "display" = "original",
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/public/zip";
  form.style.display = "none";
  const add = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  add("eventId", eventId);
  add("ids", photoIds.join(","));
  add("variant", variant);
  document.body.appendChild(form);
  form.submit();
  form.remove();
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
        const res = await fetch(p.displayUrl);
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

  // Some share targets (notably the OS-level share sheet on certain
  // platforms) don't accept WebP even though the earlier jpg-probe in
  // canShareFiles() said sharing files was possible in general — checking
  // the real files here catches that up front instead of letting
  // navigator.share() throw.
  if (!navigator.canShare({ files })) return "failed";

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
