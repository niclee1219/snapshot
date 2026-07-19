"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatEventDate } from "./gallery";

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
  onDone: () => void;
};

const AUTO_DISMISS_MS = 2200;
const FADE_MS = 300;

/**
 * Full-screen cinematic intro shown once per gallery visit (sessionless — no storage).
 *
 * Timing: auto-dismiss fires at AUTO_DISMISS_MS, which starts the CSS fade-out
 * (`gallery-intro-fade-out`, FADE_MS). `onDone` is called AFTER the fade finishes,
 * not when it starts — there's no exit-animation library in this project, so once
 * the parent unmounts this component (in response to onDone) any in-flight CSS
 * transition is discarded immediately. Waiting for the fade to complete keeps the
 * dismiss visually whole. The reveal still feels connected because the gallery's
 * own `.tile-in` stagger begins the instant this component is gone — there's no
 * added pause between "intro finished fading" and "grid starts animating in".
 */
export function Intro({ coverUrl, eventName, eventDate, onDone }: Props) {
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
  const onDoneRef = useRef(onDone);

  // Keep the ref current without mutating it during render (refs may only be
  // written in effects/handlers). Runs before the effects below in the same
  // commit, since hooks fire in declaration order.
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // JS-layer reduced-motion guard: once useSyncExternalStore reports reduced
  // motion, call onDone immediately so the parent reveals the gallery without
  // ever waiting on the intro's timers.
  useEffect(() => {
    if (reducedMotion) onDoneRef.current();
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

  // Once fading starts (auto-dismiss or skip), call onDone after the fade finishes.
  useEffect(() => {
    if (!fading) return;
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
