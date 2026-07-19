"use client";

import { useState, useTransition } from "react";
import { deleteEvent, setEventPublished } from "../../actions";

export function EventHeader({
  event,
}: {
  event: {
    id: string;
    name: string;
    published: boolean;
    publicUrl: string;
    previewPath: string;
    viewCount: number;
    downloadCount: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
            {event.publicUrl}
          </code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(event.publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs text-zinc-600 underline-offset-2 hover:underline"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={event.previewPath}
            target="_blank"
            className="text-xs text-zinc-600 underline-offset-2 hover:underline"
          >
            Preview ↗
          </a>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {event.viewCount} views · {event.downloadCount} downloads
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(() => setEventPublished(event.id, !event.published))
          }
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 ${
            event.published
              ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          {event.published ? "Unpublish" : "Publish"}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                "Delete this event and all its photos? This cannot be undone.",
              )
            ) {
              startTransition(() => deleteEvent(event.id));
            }
          }}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
