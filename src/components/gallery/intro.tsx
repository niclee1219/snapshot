"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatEventDate } from "./format-date";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  // Can't know on the server; assume motion is fine so SSR HTML matches the
  // client's pre-hydration render. See the component doc comment for how the
  // client then corrects this without a hydration mismatch or a visible flash.
  return false;
}

type Props = {
  coverUrl: string;
  eventName: string;
  eventDate?: string | null;
  /** Fired the instant the fade-out starts (auto-dismiss or skip) — this is
   * when the parent should flip its `revealed` state so the gallery's
   * `.tile-in` stagger plays *underneath* the still-dissolving overlay. */
  onReveal: () => void;
  /** Fired FADE_MS later, once the fade-out has visually finished — this is
   * when the parent should unmount <Intro>. */
  onDone: () => void;
};

const AUTO_DISMISS_MS = 2200;
const FADE_MS = 300;

/**
 * Full-screen cinematic intro shown once per gallery visit (sessionless — no storage).
 *
 * Timing: auto-dismiss fires at AUTO_DISMISS_MS, which starts the CSS fade-out
 * (`gallery-intro-fade-out`, FADE_MS). `onReveal` fires at the START of that
 * fade (not the end): the parent flips `revealed` immediately, so the gallery's
 * `.tile-in` stagger begins playing concurrently, underneath the still-opaque
 * (and dissolving) overlay — a connected reveal, not a snap. `onDone` fires
 * FADE_MS later, once the fade has visually finished, and is the parent's cue
 * to unmount this component. Splitting the two matters because there's no
 * exit-animation library here: if the parent unmounted on `onReveal` alone,
 * the in-flight CSS opacity transition would be discarded mid-flight.
 */
export function Intro({
  coverUrl,
  eventName,
  eventDate,
  onReveal,
  onDone,
}: Props) {
  // useSyncExternalStore is the React-blessed way to read a browser-only media
  // query with an SSR fallback: it renders `getServerSnapshot` (false — motion
  // assumed fine) for both the server HTML and the client's first hydration
  // pass, so the two agree and there's no hydration mismatch. Immediately after
  // hydrating, React re-reads `getReducedMotionSnapshot` and re-renders with the
  // real value before the browser paints, so a reduced-motion visitor never
  // actually sees the intro flash in — reinforced by the CSS
  // `@media (prefers-reduced-motion: reduce) { .gallery-intro { display: none } }`
  // guard, which hides it regardless of JS timing (the two-layer guard the brief
  // asked for).
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [fading, setFading] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);

  // Keep the refs current without mutating them during render (refs may only
  // be written in effects/handlers). Runs before the effects below in the
  // same commit, since hooks fire in declaration order.
  useEffect(() => {
    onRevealRef.current = onReveal;
    onDoneRef.current = onDone;
  }, [onReveal, onDone]);

  // JS-layer reduced-motion guard: once useSyncExternalStore reports reduced
  // motion, skip straight to both callbacks — reveal and done, immediately,
  // once — so the parent shows the gallery without ever waiting on timers.
  useEffect(() => {
    if (reducedMotion) {
      onRevealRef.current();
      onDoneRef.current();
    }
  }, [reducedMotion]);

  const skip = useCallback(() => {
    if (fading) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setFading(true);
  }, [fading]);

  // Auto-dismiss timer.
  useEffect(() => {
    if (reducedMotion) return;
    dismissTimer.current = setTimeout(() => setFading(true), AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [reducedMotion]);

  // The moment fading starts (auto-dismiss or skip — both just set `fading`),
  // reveal the gallery underneath so its stagger plays concurrently with the
  // overlay dissolving above it, then unmount `FADE_MS` later once the fade
  // has visually finished.
  useEffect(() => {
    if (!fading) return;
    onRevealRef.current();
    fadeTimer.current = setTimeout(() => onDoneRef.current(), FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [fading]);

  // Scroll lock while mounted (including during the fade-out), restored on unmount.
  useEffect(() => {
    if (reducedMotion) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      className={`gallery-intro fixed inset-0 z-50 cursor-pointer overflow-hidden ${
        fading ? "gallery-intro-fade-out" : ""
      }`}
      style={{ background: "var(--paper)" }}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        className="gallery-intro-cover absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/55" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        {eventDate && (
          <time
            className="gallery-intro-eyebrow gallery-eyebrow mb-3"
            style={{ color: "rgba(242, 239, 233, 0.72)" }}
          >
            {formatEventDate(eventDate)}
          </time>
        )}
        <h1
          className="gallery-intro-title gallery-display text-4xl leading-tight sm:text-6xl"
          style={{ color: "#f2efe9" }}
        >
          {eventName}
        </h1>
      </div>
    </div>
  );
}
