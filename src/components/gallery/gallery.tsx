"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Lightbox } from "./lightbox";
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
  accent: string;
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
    <div style={{ ["--accent" as string]: accent }}>
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
          <div className="tile-in">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="mb-5 h-8 w-auto" />
            ) : (
              <p className="gallery-eyebrow mb-3">{companyName}</p>
            )}
            {eventDate && (
              <time className="gallery-eyebrow block">{formatDate(eventDate)}</time>
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
                className="text-xs text-[var(--mist)] hover:text-white"
              >
                {selected.size === photos.length ? "Clear all" : "Select all"}
              </button>
            )}
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                selectMode
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--hairline)] text-[var(--mist)] hover:text-white"
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
        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-0.5 px-0 pb-32 pt-0.5 sm:grid-cols-3 sm:gap-1 sm:px-5 md:grid-cols-4">
          {photos.map((photo, i) => {
            const isSelected = selected.has(photo.id);
            return (
              <li
                key={photo.id}
                className="tile-in relative aspect-square"
                style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
              >
                <button
                  className="group block h-full w-full"
                  onClick={() => onTileClick(i, photo.id)}
                  onTouchStart={() => onTilePressStart(photo.id)}
                  onTouchEnd={onTilePressEnd}
                  onTouchMove={onTilePressEnd}
                  onContextMenu={(e) => {
                    if (longPress.current) e.preventDefault();
                  }}
                  aria-label={
                    selectMode
                      ? `Select photo ${i + 1}`
                      : `Open photo ${i + 1}`
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    loading={i < 8 ? "eager" : "lazy"}
                    className={`h-full w-full object-cover transition-[transform,opacity] duration-300 ${
                      isSelected ? "scale-[0.93] opacity-80" : ""
                    }`}
                  />
                  <span
                    className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-opacity ${
                      isSelected
                        ? "border-transparent text-black opacity-100"
                        : selectMode
                          ? "border-white/60 bg-black/30 text-transparent opacity-100"
                          : "border-transparent opacity-0"
                    }`}
                    style={isSelected ? { background: "var(--accent)" } : undefined}
                  >
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Selection action bar ── */}
      {selected.size > 0 && (
        <div className="bar-up fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--hairline)] bg-black/85 px-2 py-2 shadow-2xl backdrop-blur">
          <span className="px-3 text-xs text-[var(--mist)]">
            {selected.size} selected
          </span>
          {shareSupported && (
            <button
              disabled={busy !== null}
              onClick={handleShare}
              className="rounded-full px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
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
                ? "border border-[var(--hairline)] text-white"
                : "text-black"
            }`}
            style={shareSupported ? undefined : { background: "var(--accent)" }}
          >
            {busy === "download" ? "Preparing…" : "Download"}
          </button>
          <button
            onClick={exitSelect}
            aria-label="Clear selection"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--mist)] hover:text-white"
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
        Powered by pixolateds
      </footer>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
