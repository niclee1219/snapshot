"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSegment,
  deleteSegment,
  renameSegment,
  reorderSegments,
} from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type AdminSegment = {
  id: string;
  name: string;
  sortIndex: number;
};

export function SegmentManager({
  eventId,
  segments,
}: {
  eventId: string;
  segments: AdminSegment[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [actionPending, startAction] = useTransition();
  const dragId = useRef<string | null>(null);

  const ordered = order
    ? order
        .map((id) => segments.find((s) => s.id === id))
        .filter((s): s is AdminSegment => !!s)
    : segments;

  function runAction(fn: () => Promise<unknown>) {
    startAction(async () => {
      await fn();
      router.refresh();
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    runAction(() => createSegment(eventId, name));
    setNewName("");
  }

  function startEdit(segment: AdminSegment) {
    setEditingId(segment.id);
    setEditName(segment.name);
  }

  function saveEdit() {
    const name = editName.trim();
    if (!editingId || !name) return;
    runAction(() => renameSegment(editingId, name));
    setEditingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Segments ({segments.length})
          </h2>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="New segment name"
              className="h-8 w-48"
            />
            <Button
              size="sm"
              disabled={actionPending || !newName.trim()}
              onClick={handleCreate}
            >
              Add segment
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {order && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <Badge variant="outline">Order changed</Badge>
            <Button
              size="sm"
              disabled={actionPending}
              onClick={() =>
                startAction(async () => {
                  await reorderSegments(eventId, order);
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
          <p className="text-sm text-muted-foreground">
            No segments yet — add one to group this event&apos;s photos into
            sections.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Segments group photos in their existing display order — reordering
              here changes jump-nav order, not photo order. If a segment&apos;s
              photos aren&apos;t assigned as one contiguous block, the segment
              may appear more than once in the gallery.
            </p>
            <ul className="flex flex-col gap-2">
              {ordered.map((segment) => (
                <li
                  key={segment.id}
                  draggable
                  onDragStart={() => (dragId.current = segment.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const from = dragId.current;
                    if (!from || from === segment.id) return;
                    const ids = (order ?? ordered.map((s) => s.id)).slice();
                    const fromIdx = ids.indexOf(from);
                    const toIdx = ids.indexOf(segment.id);
                    ids.splice(fromIdx, 1);
                    ids.splice(toIdx, 0, from);
                    setOrder(ids);
                  }}
                  onDragEnd={() => (dragId.current = null)}
                  className="flex cursor-move items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  {editingId === segment.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        className="h-8 flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={actionPending || !editName.trim()}
                        onClick={saveEdit}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{segment.name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(segment)}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Delete segment "${segment.name}"? Photos in it will become unassigned.`,
                            )
                          ) {
                            runAction(() => deleteSegment(segment.id));
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
