"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { segmentSwatchClass } from "@/lib/segment-colors";

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
  const sensors = useSensors(
    // Dedicated grip handle has no competing click/scroll gesture, so a small
    // distance threshold is fine and keeps drag start responsive.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = (order ?? ordered.map((s) => s.id)).slice();
    const fromIdx = ids.indexOf(String(active.id));
    const toIdx = ids.indexOf(String(over.id));
    if (fromIdx === -1 || toIdx === -1) return;
    setOrder(arrayMove(ids, fromIdx, toIdx));
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
              Each segment renders as one continuous section in the gallery.
              Drag to reorder — this changes the order sections appear in;
              unassigned photos always come last.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordered.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {ordered.map((segment) => {
                    const colorIndex = segments.findIndex(
                      (s) => s.id === segment.id,
                    );
                    return (
                      <SegmentRow
                        key={segment.id}
                        segment={segment}
                        swatchClass={
                          colorIndex >= 0
                            ? segmentSwatchClass(colorIndex)
                            : null
                        }
                        isEditing={editingId === segment.id}
                        editName={editName}
                        onEditNameChange={setEditName}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditingId(null)}
                        onStartEdit={() => startEdit(segment)}
                        onDelete={() => {
                          if (
                            confirm(
                              `Delete segment "${segment.name}"? Photos in it will become unassigned.`,
                            )
                          ) {
                            runAction(() => deleteSegment(segment.id));
                          }
                        }}
                        actionPending={actionPending}
                      />
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SegmentRow({
  segment,
  swatchClass,
  isEditing,
  editName,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  actionPending,
}: {
  segment: AdminSegment;
  swatchClass: string | null;
  isEditing: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  actionPending: boolean;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 ${
        isDragging ? "z-10 opacity-70 shadow-lg" : ""
      }`}
    >
      <GripVertical
        {...listeners}
        className="h-4 w-4 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      />
      {isEditing ? (
        <>
          {swatchClass && (
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatchClass}`}
            />
          )}
          <Input
            autoFocus
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === "Escape") {
                onCancelEdit();
              }
            }}
            className="h-8 flex-1"
          />
          <Button
            size="sm"
            disabled={actionPending || !editName.trim()}
            onClick={onSaveEdit}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          {swatchClass && (
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatchClass}`}
            />
          )}
          <span className="flex-1 text-sm">{segment.name}</span>
          <Button variant="outline" size="sm" onClick={onStartEdit}>
            Rename
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={actionPending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </>
      )}
    </li>
  );
}
