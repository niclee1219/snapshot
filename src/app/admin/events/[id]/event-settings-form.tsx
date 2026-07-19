"use client";

import { useActionState, useState, useTransition } from "react";
import {
  setEventPin,
  setSortMode,
  updateEvent,
  type ActionState,
} from "../../actions";

type EventSettings = {
  id: string;
  name: string;
  urlSlug: string;
  eventDate: string;
  welcomeMessage: string;
  accentColor: string;
  published: boolean;
  hasPin: boolean;
  sortMode: "capture" | "manual";
};

export function EventSettingsForm({ event }: { event: EventSettings }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEvent,
    null,
  );
  const [pinPending, startPin] = useTransition();
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Event settings
      </h2>
      <form
        action={formAction}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="eventId" value={event.id} />
        <div>
          <label className="block text-sm font-medium" htmlFor="ev-name">
            Site title
          </label>
          <input
            id="ev-name"
            name="name"
            defaultValue={event.name}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="ev-date">
            Event date
          </label>
          <input
            id="ev-date"
            name="eventDate"
            type="date"
            defaultValue={event.eventDate}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="ev-slug">
            URL slug{" "}
            {event.published && (
              <span className="font-normal text-zinc-400">
                (unpublish to change)
              </span>
            )}
          </label>
          <input
            id="ev-slug"
            name="urlSlug"
            defaultValue={event.urlSlug}
            disabled={event.published}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="ev-accent">
            Accent color
          </label>
          <input
            id="ev-accent"
            name="accentColor"
            type="color"
            defaultValue={event.accentColor || "#18181b"}
            className="mt-1 h-9 w-14 cursor-pointer rounded border border-zinc-300"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium" htmlFor="ev-welcome">
            Welcome message
          </label>
          <textarea
            id="ev-welcome"
            name="welcomeMessage"
            defaultValue={event.welcomeMessage}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            placeholder="Thanks for joining us! Tap any photo to view, select to download or share."
          />
        </div>
        {state?.error && (
          <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Gallery PIN</h3>
          {event.hasPin ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                PIN protection on
              </span>
              <button
                disabled={pinPending}
                onClick={() =>
                  startPin(async () => {
                    await setEventPin(event.id, null);
                  })
                }
                className="text-xs text-zinc-600 underline-offset-2 hover:underline"
              >
                Remove PIN
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="4-6 digits"
                className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <button
                disabled={pinPending || pinInput.length < 4}
                onClick={() =>
                  startPin(async () => {
                    const res = await setEventPin(event.id, pinInput);
                    setPinError(res?.error ?? null);
                    if (!res?.error) setPinInput("");
                  })
                }
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-40"
              >
                Set PIN
              </button>
            </div>
          )}
          {pinError && <p className="mt-1 text-xs text-red-600">{pinError}</p>}
        </div>

        <div>
          <h3 className="text-sm font-medium">Photo order</h3>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button
              disabled={pinPending || event.sortMode === "capture"}
              onClick={() =>
                startPin(async () => {
                  await setSortMode(event.id, "capture");
                })
              }
              className={`rounded-md px-3 py-1.5 text-xs ${
                event.sortMode === "capture"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              Capture time
            </button>
            <span
              className={`rounded-md px-3 py-1.5 text-xs ${
                event.sortMode === "manual"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 text-zinc-400"
              }`}
            >
              Manual (drag photos)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
