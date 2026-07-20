"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Lightbox } from "./lightbox";
import { JustifiedGrid } from "./justified-grid";
import { Intro } from "./intro";
import { formatEventDate } from "./format-date";
import {
  canShareFiles,
  downloadSingle,
  downloadZipOf,
  sharePhotos,
} from "./actions";

export type GalleryPhoto = {
  id: string;
  thumbUrl: string;
  displayUrl: string;
  originalUrl: string;
  fileName: string;
  width: number;
  height: number;
};

type Props = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  welcomeMessage: string | null;
  companyName: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accent?: string;
  photos: GalleryPhoto[];
};

export function Gallery({
  eventId,
  eventName,
  eventDate,
  welcomeMessage,
  companyName,
  logoUrl,
  coverUrl,
  accent,
  photos,
}: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareSupported = useMemo(() => canShareFiles(), []);

  // Cinematic intro plays whenever the event has a cover photo — sessionless (no
  // storage), so it plays every visit by design. `revealed` starts false in that
  // case (both on the server and on the client's first hydration render — the
  // check only depends on the `coverUrl` prop, so there's no SSR/client mismatch)
  // and content underneath stays free of entrance-animation classes until it flips.
  // The reduced-motion check itself lives inside <Intro>, not here: it needs a
  // browser-only matchMedia read, so it's deferred to an effect there and reported
  // back via onReveal/onDone — see intro.tsx for why that's the safe way to avoid
  // a hydration-mismatch while still showing no visible flash.
  //
  // `revealed` and `introMounted` are deliberately separate: `revealed` flips the
  // instant the intro's fade-out *starts* (its onReveal), so the gallery's
  // `.tile-in` stagger plays concurrently, underneath the still-dissolving
  // overlay — no un-animated flash-through, no snap-back. `introMounted` only
  // flips once the fade has visually finished (onDone), which is when <Intro>
  // actually unmounts.
  const hasIntro = Boolean(coverUrl);
  const [revealed, setRevealed] = useState(!hasIntro);
  const [introMounted, setIntroMounted] = useState(hasIntro);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function onTileClick(index: number, id: string) {
    if (selectMode) toggle(id);
    else setLightboxIndex(index);
  }

  function onTilePressStart(id: string) {
    longPress.current = setTimeout(() => {
      setSelectMode(true);
      setSelected((prev) => new Set(prev).add(id));
      if ("vibrate" in navigator) navigator.vibrate?.(10);
    }, 450);
  }

  function onTilePressEnd() {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  }

  const selectedPhotos = photos.filter((p) => selected.has(p.id));

  async function handleShare() {
    setBusy("share");
    try {
      const result = await sharePhotos(eventId, selectedPhotos, eventName);
      if (result === "too-many") {
        alert("Sharing works best with up to 10 photos — download instead.");
      } else if (result === "unsupported" || result === "failed") {
        await handleDownload();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy("download");
    try {
      if (selectedPhotos.length === 1) {
        await downloadSingle(eventId, selectedPhotos[0]);
      } else {
        downloadZipOf(
          eventId,
          selectedPhotos.map((p) => p.id),
        );
      }
    } catch {
      alert("Download failed — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={accent ? { ["--accent" as string]: accent } : undefined}>
      {/* ── Cinematic intro ── */}
      {hasIntro && introMounted && coverUrl && (
        <Intro
          coverUrl={coverUrl}
          eventName={eventName}
          eventDate={eventDate}
          onReveal={() => setRevealed(true)}
          onDone={() => setIntroMounted(false)}
        />
      )}

      {/* ── Hero ── */}
      <header className="relative">
        {coverUrl && (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[var(--paper)]" />
          </div>
        )}
        <div
          className={`relative mx-auto max-w-5xl px-5 ${
            coverUrl ? "pb-16 pt-36 sm:pt-52" : "pb-10 pt-16"
          }`}
        >
          <div className={revealed ? "tile-in" : undefined}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="mb-5 h-8 w-auto" />
            ) : (
              <p className="gallery-eyebrow mb-3">{companyName}</p>
            )}
            {eventDate && (
              <time className="gallery-eyebrow block">
                {formatEventDate(eventDate)}
              </time>
            )}
            <h1 className="gallery-display mt-2 text-4xl leading-tight sm:text-6xl">
              {eventName}
            </h1>
            {welcomeMessage && (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--mist)] sm:text-base">
                {welcomeMessage}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--paper)]/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5">
          <span className="text-xs text-[var(--mist)]">
            {photos.length} photos
          </span>
          <div className="flex items-center gap-3">
            {selectMode && photos.length > 0 && (
              <button
                onClick={() =>
                  setSelected(
                    selected.size === photos.length
                      ? new Set()
                      : new Set(photos.map((p) => p.id)),
                  )
                }
                className="text-xs text-[var(--mist)] hover:text-[var(--ink-strong)]"
              >
                {selected.size === photos.length ? "Clear all" : "Select all"}
              </button>
            )}
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                selectMode
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--hairline)] text-[var(--mist)] hover:text-[var(--ink-strong)]"
              }`}
            >
              {selectMode ? "Done" : "Select"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      {photos.length === 0 ? (
        <p className="px-5 py-24 text-center text-sm text-[var(--mist)]">
          Photos are on their way — check back soon.
        </p>
      ) : (
        <JustifiedGrid
          photos={photos}
          selectMode={selectMode}
          selected={selected}
          onTileClick={onTileClick}
          onTilePressStart={onTilePressStart}
          onTilePressEnd={onTilePressEnd}
          longPressActiveRef={longPress}
          revealed={revealed}
        />
      )}

      {/* ── Selection action bar ── */}
      {selected.size > 0 && (
        <div className="bar-up fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--panel)] px-2 py-2 shadow-2xl backdrop-blur">
          <span className="px-3 text-xs text-[var(--mist)]">
            {selected.size} selected
          </span>
          {shareSupported && (
            <button
              disabled={busy !== null}
              onClick={handleShare}
              className="rounded-full px-4 py-2 text-xs font-medium text-[var(--accent-ink)] disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {busy === "share" ? "Preparing…" : "Share"}
            </button>
          )}
          <button
            disabled={busy !== null}
            onClick={handleDownload}
            className={`rounded-full px-4 py-2 text-xs font-medium disabled:opacity-50 ${
              shareSupported
                ? "border border-[var(--hairline)] text-[var(--ink-strong)]"
                : "text-[var(--accent-ink)]"
            }`}
            style={shareSupported ? undefined : { background: "var(--accent)" }}
          >
            {busy === "download" ? "Preparing…" : "Download"}
          </button>
          <button
            onClick={exitSelect}
            aria-label="Clear selection"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--mist)] hover:text-[var(--ink-strong)]"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          eventId={eventId}
          eventName={eventName}
          shareSupported={shareSupported}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <footer className="pb-10 text-center text-xs text-[var(--mist)]">
        Powered by{" "}
        <a
          href="https://pixolateds.com"
          target="_blank"
          rel="noopener"
          className="text-[var(--mist)] transition-colors hover:text-[var(--ink-strong)] hover:underline"
        >
          pixolateds
        </a>
      </footer>
    </div>
  );
}
