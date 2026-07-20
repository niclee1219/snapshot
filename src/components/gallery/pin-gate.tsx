"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinGate({
  slug,
  eventSlug,
  eventName,
  accent,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  accent?: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, eventSlug, pin }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError("That PIN isn't right — try again.");
        setPin("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={accent ? { ["--accent" as string]: accent } : undefined}
    >
      <div className="tile-in w-full max-w-xs text-center">
        <p className="gallery-eyebrow">Private gallery</p>
        <h1 className="gallery-display mt-3 text-3xl">{eventName}</h1>
        <p className="mt-3 text-sm text-[var(--mist)]">
          Enter the PIN from your host to view the photos.
        </p>
        <form onSubmit={submit} className="mt-8">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="••••"
            className="w-full rounded-sm border border-[var(--hairline)] bg-transparent px-4 py-3 text-center text-2xl tracking-[0.5em] text-[var(--ink-strong)] placeholder:text-[var(--placeholder-ink)] focus:border-[var(--accent)] focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="mt-4 w-full rounded-sm px-4 py-3 text-sm font-medium text-[var(--accent-ink)] transition-opacity disabled:opacity-30"
            style={{ background: "var(--accent)" }}
          >
            {busy ? "Checking…" : "View gallery"}
          </button>
        </form>
      </div>
    </div>
  );
}
