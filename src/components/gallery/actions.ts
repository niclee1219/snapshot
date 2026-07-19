import type { GalleryPhoto } from "./gallery";

export function track(eventId: string, kind: "download" | "share") {
  fetch("/api/public/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId, kind }),
    keepalive: true,
  }).catch(() => {});
}

export async function downloadSingle(eventId: string, photo: GalleryPhoto) {
  const res = await fetch(photo.originalUrl);
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
export function downloadZipOf(eventId: string, photoIds: string[]) {
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

  const files = await Promise.all(
    photos.map(async (p) => {
      const res = await fetch(p.originalUrl);
      const blob = await res.blob();
      return new File([blob], p.fileName || "photo.jpg", {
        type: blob.type || "image/jpeg",
      });
    }),
  );

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
