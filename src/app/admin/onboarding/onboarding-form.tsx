"use client";

import { useActionState, useEffect, useState } from "react";
import { claimSlug, type ActionState } from "../actions";
import { validateCompanySlug, slugify } from "@/lib/slugs";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason: string };

type ServerCheck = { slug: string; available: boolean; reason?: string };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    claimSlug,
    null,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name).slice(0, 30);
  const localError = effectiveSlug ? validateCompanySlug(effectiveSlug) : null;

  useEffect(() => {
    if (!effectiveSlug || validateCompanySlug(effectiveSlug)) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/slug-check?slug=${encodeURIComponent(effectiveSlug)}`,
        );
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        setServerCheck({ slug: effectiveSlug, ...data });
      } catch {
        // Leave the previous state; the server action re-validates anyway.
      }
    }, 350);
    return () => clearTimeout(t);
  }, [effectiveSlug]);

  // Availability is derived at render so effects never set state synchronously.
  const availability: Availability = !effectiveSlug
    ? { state: "idle" }
    : localError
      ? { state: "unavailable", reason: localError }
      : serverCheck?.slug === effectiveSlug
        ? serverCheck.available
          ? { state: "available" }
          : {
              state: "unavailable",
              reason: serverCheck.reason ?? "Not available.",
            }
        : { state: "checking" };

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Company name
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          placeholder="Acme Corp"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="slug">
          Subdomain
        </label>
        <div className="mt-1 flex items-center overflow-hidden rounded-md border border-zinc-300 focus-within:border-zinc-500">
          <input
            id="slug"
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            required
            className="w-full px-3 py-2 text-sm focus:outline-none"
            placeholder="acme"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="whitespace-nowrap bg-zinc-100 px-3 py-2 text-sm text-zinc-500">
            .pixolateds.com
          </span>
        </div>
        <p className="mt-1 min-h-5 text-xs">
          {availability.state === "checking" && (
            <span className="text-zinc-500">Checking availability…</span>
          )}
          {availability.state === "available" && (
            <span className="text-emerald-600">
              {effectiveSlug}.pixolateds.com is available
            </span>
          )}
          {availability.state === "unavailable" && (
            <span className="text-red-600">{availability.reason}</span>
          )}
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || availability.state !== "available"}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      >
        {pending ? "Claiming…" : "Claim subdomain"}
      </button>
    </form>
  );
}
