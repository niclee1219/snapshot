"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  uploadFiles,
  type UploadItem,
} from "@/lib/client/uploader";
import {
  deletePhotos,
  reorderPhotos,
  setCoverPhoto,
  setPhotosHidden,
} from "../../actions";

export type AdminPhoto = {
  id: string;
  thumbUrl: string;
  fileName: string;
  width: number;
  height: number;
  hidden: boolean;
  isCover: boolean;
};

export function PhotoManager({
  eventId,
  photos,
}: {
  eventId: string;
  photos: AdminPhoto[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[] | null>(null);
  const [actionPending, startAction] = useTransition();
  const dragId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const ordered = order
    ? order
        .map((id) => photos.find((p) => p.id === id))
        .filter((p): p is AdminPhoto => !!p)
    : photos;

  const patchItem = useCallback(
    (id: string, patch: Partial<UploadItem>) =>
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      ),
    [],
  );

  async function startUpload(files: FileList | File[]) {
    const accepted = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type),
    );
    if (accepted.length === 0) return;
    const newItems: UploadItem[] = accepted.map((file) => ({
      id: nanoid(),
      file,
      status: "queued",
    }));
    setItems(newItems);
    setUploading(true);
    try {
      await uploadFiles(eventId, newItems, patchItem);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runAction(fn: () => Promise<unknown>) {
    startAction(async () => {
      await fn();
      setSelected(new Set());
      router.refresh();
    });
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedItems = items.filter((i) => i.status === "failed");
  const selectedPhotos = ordered.filter((p) => selected.has(p.id));
  const allSelectedHidden =
    selectedPhotos.length > 0 && selectedPhotos.every((p) => p.hidden);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Photos ({photos.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) startUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {uploading
              ? `Uploading ${doneCount}/${items.length}…`
              : "Upload photos"}
          </button>
        </div>
      </div>

      {failedItems.length > 0 && !uploading && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {failedItems.length} file(s) failed:{" "}
          {failedItems
            .slice(0, 3)
            .map((f) => f.file.name)
            .join(", ")}
          {failedItems.length > 3 && "…"} — select them again to retry.
        </div>
      )}

      {uploading && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-zinc-900 transition-all"
            style={{
              width: `${items.length ? (doneCount / items.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm shadow-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button
            disabled={actionPending}
            onClick={() =>
              runAction(() =>
                setPhotosHidden(eventId, [...selected], !allSelectedHidden),
              )
            }
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-white"
          >
            {allSelectedHidden ? "Unhide" : "Hide"}
          </button>
          {selected.size === 1 && (
            <button
              disabled={actionPending}
              onClick={() =>
                runAction(() => setCoverPhoto(eventId, [...selected][0]))
              }
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-white"
            >
              Set as cover
            </button>
          )}
          <button
            disabled={actionPending}
            onClick={() => {
              if (confirm(`Delete ${selected.size} photo(s) permanently?`)) {
                runAction(() => deletePhotos(eventId, [...selected]));
              }
            }}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-800"
          >
            Clear
          </button>
        </div>
      )}

      {order && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Order changed.</span>
          <button
            disabled={actionPending}
            onClick={() =>
              startAction(async () => {
                await reorderPhotos(eventId, order);
                setOrder(null);
                router.refresh();
              })
            }
            className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500"
          >
            Save order
          </button>
          <button
            onClick={() => setOrder(null)}
            className="text-xs underline-offset-2 hover:underline"
          >
            Discard
          </button>
        </div>
      )}

      {ordered.length === 0 ? (
        <button
          onClick={() => fileInput.current?.click()}
          className="mt-4 block w-full rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 hover:border-zinc-400"
        >
          Drop photos here or click to upload
        </button>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {ordered.map((photo) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => (dragId.current = photo.id)}
              onDragOver={(e) => {
                e.preventDefault();
                const from = dragId.current;
                if (!from || from === photo.id) return;
                const ids = (order ?? ordered.map((p) => p.id)).slice();
                const fromIdx = ids.indexOf(from);
                const toIdx = ids.indexOf(photo.id);
                ids.splice(fromIdx, 1);
                ids.splice(toIdx, 0, from);
                setOrder(ids);
              }}
              onDragEnd={() => (dragId.current = null)}
              className={`group relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 ${
                selected.has(photo.id)
                  ? "border-zinc-900"
                  : "border-transparent"
              }`}
              onClick={() => toggleSelect(photo.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={photo.fileName}
                loading="lazy"
                className={`h-full w-full object-cover transition-opacity ${
                  photo.hidden ? "opacity-30" : ""
                }`}
              />
              {photo.isCover && (
                <span className="absolute left-1 top-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </span>
              )}
              {photo.hidden && (
                <span className="absolute right-1 top-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Hidden
                </span>
              )}
              <span
                className={`absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                  selected.has(photo.id)
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-white/70 bg-black/30 text-white opacity-0 group-hover:opacity-100"
                }`}
              >
                ✓
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        Drag photos to reorder. Click to select. JPEG/PNG/WebP up to 30MB each.
      </p>
    </section>
  );
}
