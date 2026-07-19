"use client";

import { useActionState, useState } from "react";
import { createEvent, type ActionState } from "./actions";

export function CreateEventForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEvent,
    null,
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        New event
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <label className="block text-sm font-medium" htmlFor="event-name">
        Event name
      </label>
      <input
        id="event-name"
        name="name"
        required
        autoFocus
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        placeholder="Summer Gala 2026"
      />
      <label className="mt-3 block text-sm font-medium" htmlFor="event-date">
        Event date
      </label>
      <input
        id="event-date"
        name="eventDate"
        type="date"
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
      {state?.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
