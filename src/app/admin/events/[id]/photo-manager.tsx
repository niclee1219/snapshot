"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  uploadFiles,
  type UploadItem,
} from "@/lib/client/uploader";
import {
  assignPhotosToSegment,
  deletePhotos,
  reorderPhotos,
  setCoverPhoto,
  setPhotosHidden,
} from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminPhoto = {
  id: string;
  thumbUrl: string;
  fileName: string;
  width: number;
  height: number;
  hidden: boolean;
  isCover: boolean;
  segmentId: string | null;
};

export function PhotoManager({
  eventId,
  photos,
  segments,
}: {
  eventId: string;
  photos: AdminPhoto[];
  segments: { id: string; name: string }[];
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
      toast.error(err instanceof Error ? err.message : "Upload failed");
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
            <Button disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading
                ? `Uploading ${doneCount}/${items.length}…`
                : "Upload photos"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {failedItems.length > 0 && !uploading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {failedItems.length} file(s) failed:{" "}
            {failedItems
              .slice(0, 3)
              .map((f) => f.file.name)
              .join(", ")}
            {failedItems.length > 3 && "…"} — select them again to retry.
          </div>
        )}

        {uploading && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${items.length ? (doneCount / items.length) * 100 : 0}%`,
              }}
            />
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-2 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm shadow-sm">
            <span className="font-medium">{selected.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              disabled={actionPending}
              onClick={() =>
                runAction(() =>
                  setPhotosHidden(eventId, [...selected], !allSelectedHidden),
                )
              }
            >
              {allSelectedHidden ? "Unhide" : "Hide"}
            </Button>
            {selected.size === 1 && (
              <Button
                variant="outline"
                size="sm"
                disabled={actionPending}
                onClick={() =>
                  runAction(() => setCoverPhoto(eventId, [...selected][0]))
                }
              >
                Set as cover
              </Button>
            )}
            {segments.length > 0 && (
              <Select
                value=""
                onValueChange={(value) =>
                  runAction(() =>
                    assignPhotosToSegment(
                      eventId,
                      [...selected],
                      value === "none" ? null : (value as string),
                    ),
                  )
                }
              >
                <SelectTrigger size="sm" disabled={actionPending}>
                  <SelectValue placeholder="Assign to segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={actionPending}
              onClick={() => {
                if (confirm(`Delete ${selected.size} photo(s) permanently?`)) {
                  runAction(() => deletePhotos(eventId, [...selected]));
                }
              }}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {order && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <Badge variant="outline">Order changed</Badge>
            <Button
              size="sm"
              disabled={actionPending}
              onClick={() =>
                startAction(async () => {
                  await reorderPhotos(eventId, order);
                  setOrder(null);
                  router.refresh();
                })
              }
            >
              Save order
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOrder(null)}>
              Discard
            </Button>
          </div>
        )}

        {ordered.length === 0 ? (
          <button
            onClick={() => fileInput.current?.click()}
            className="mt-4 block w-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground hover:border-foreground/30"
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
                    ? "border-foreground"
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
                  <Badge className="absolute left-1 top-1">Cover</Badge>
                )}
                {photo.hidden && (
                  <Badge variant="secondary" className="absolute right-1 top-1">
                    Hidden
                  </Badge>
                )}
                <span
                  className={`absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                    selected.has(photo.id)
                      ? "border-foreground bg-foreground text-background"
                      : "border-white/70 bg-black/30 text-white opacity-0 group-hover:opacity-100"
                  }`}
                >
                  ✓
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Drag photos to reorder. Click to select. JPEG/PNG/WebP up to 30MB each.
        </p>
      </CardContent>
    </Card>
  );
}
