import { processImage } from "./process-image";

export type UploadItemStatus =
  | "queued"
  | "processing"
  | "uploading"
  | "done"
  | "failed";

export type UploadItem = {
  id: string;
  file: File;
  status: UploadItemStatus;
  error?: string;
};

type PresignedFile = {
  uid: string;
  keys: { original: string; display: string; thumb: string };
  urls: { original: string; display: string; thumb: string };
};

export type UploadedMeta = {
  uid: string;
  ext: string;
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  capturedAt: number | null;
};

const CONCURRENCY = 3;
const PRESIGN_BATCH = 20;
const METADATA_BATCH = 20;

function extOf(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(ext)) return ext;
  // Fall back on MIME type when the extension is missing/odd.
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function putBlob(url: string, blob: Blob, contentType: string) {
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "content-type": contentType },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

/**
 * Runs the full pipeline for a set of files:
 * presign (batched) -> per file: resize in browser + 3 PUTs (pooled) ->
 * metadata POST (batched). Calls onItemUpdate as items progress.
 */
export async function uploadFiles(
  eventId: string,
  items: UploadItem[],
  onItemUpdate: (id: string, patch: Partial<UploadItem>) => void,
): Promise<{ done: number; failed: number }> {
  // 1. Presign everything up front, in batches.
  const presigned = new Map<string, PresignedFile>();
  for (let i = 0; i < items.length; i += PRESIGN_BATCH) {
    const batch = items.slice(i, i + PRESIGN_BATCH);
    const res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        files: batch.map((it) => ({
          ext: extOf(it.file),
          sizeBytes: it.file.size,
        })),
      }),
    });
    if (!res.ok) {
      const msg = await res.text();
      batch.forEach((it) =>
        onItemUpdate(it.id, { status: "failed", error: msg }),
      );
      continue;
    }
    const data = (await res.json()) as { files: PresignedFile[] };
    batch.forEach((it, idx) => presigned.set(it.id, data.files[idx]));
  }

  // 2. Process + upload with a small worker pool. Items sit at "uploading"
  // (not "done") until their metadata is actually persisted in step 3 — an
  // item is only really "done" once the gallery can show it.
  const completed: (UploadedMeta & { itemId: string })[] = [];
  const queue = items.filter((it) => presigned.has(it.id));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      const signed = presigned.get(item.id)!;
      try {
        onItemUpdate(item.id, { status: "processing" });
        const processed = await processImage(item.file);

        onItemUpdate(item.id, { status: "uploading" });
        await Promise.all([
          putBlob(
            signed.urls.original,
            item.file,
            item.file.type || "image/jpeg",
          ),
          putBlob(signed.urls.display, processed.displayBlob, "image/webp"),
          putBlob(signed.urls.thumb, processed.thumbBlob, "image/webp"),
        ]);

        completed.push({
          itemId: item.id,
          uid: signed.uid,
          ext: extOf(item.file),
          fileName: item.file.name,
          width: processed.width,
          height: processed.height,
          sizeBytes: item.file.size,
          capturedAt: processed.capturedAt,
        });
      } catch (err) {
        onItemUpdate(item.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
  );

  // 3. Record metadata for everything that made it. Only now do items become
  // "done" — if this fails, the affected items flip to "failed" instead of
  // silently staying "done" while their DB rows never exist.
  let done = 0;
  for (let i = 0; i < completed.length; i += METADATA_BATCH) {
    const batch = completed.slice(i, i + METADATA_BATCH);
    const res = await fetch("/api/admin/photos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        uploaded: batch.map(({ itemId: _itemId, ...meta }) => meta),
      }),
    });
    if (!res.ok) {
      // R2 objects exist but rows failed — mark visibly failed so the admin retries.
      batch.forEach((it) =>
        onItemUpdate(it.itemId, {
          status: "failed",
          error: "Failed to record uploaded photo. Please retry.",
        }),
      );
      continue;
    }
    batch.forEach((it) => onItemUpdate(it.itemId, { status: "done" }));
    done += batch.length;
  }

  const failed = items.length - done;
  return { done, failed };
}
