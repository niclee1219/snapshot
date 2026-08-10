"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "./gallery";
import { downloadSingle, sharePhotos } from "./actions";

// Matches the `lightbox-photo-out` CSS animation duration in globals.css —
// the old photo fades out for this long before we swap the displayed index
// and let the freshly-mounted image play its `lightbox-photo-in` animation.
const PHOTO_SWAP_MS = 140;

export function Lightbox({
  photos,
  index,
  eventId,
  eventName,
  shareSupported,
  onNavigate,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  eventId: string;
  eventName: string;
  shareSupported: boolean;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Cross-fade on photo swap: mirrors the delayed-unmount/timed-class-swap
  // pattern used by <Intro> (fade out, then swap content, then let the new
  // content's own enter animation play). `displayIndex` lags `index` by
  // PHOTO_SWAP_MS, during which `leaving` is true and the outgoing photo
  // fades out before being replaced.
  const [displayIndex, setDisplayIndex] = useState(index);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Derived, not stateful: true exactly while the outgoing photo is fading
  // out and `displayIndex` hasn't caught up to `index` yet.
  const leaving = index !== displayIndex;

  useEffect(() => {
    if (index === displayIndex) return;
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => {
      setDisplayIndex(index);
    }, PHOTO_SWAP_MS);
    return () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, [index, displayIndex]);

  const photo = photos[displayIndex];
  // Share/Download always act on the target photo the user navigated to, not the one
  // still visually fading out during the cross-fade window (`photo`/`displayIndex` above
  // are for rendering only) — see PHOTO_SWAP_MS.
  const currentPhoto = photos[index];

  const go = useCallback(
    (delta: number) => {
      if (photos.length <= 1) return;
      const next = (index + delta + photos.length) % photos.length;
      onNavigate(next);
    },
    [index, photos.length, onNavigate],
  );

  // Keyboard navigation + scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  // Preload neighbours for instant swipes.
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const p = photos[(i + photos.length) % photos.length];
      if (p) {
        const img = new Image();
        img.src = p.displayUrl;
      }
    });
  }, [index, photos]);

  if (!photo) return null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex flex-col bg-[var(--panel)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--panel)] px-4 py-3 text-[var(--ink-strong)]">
        <span className="text-xs tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-[var(--hairline)]"
        >
          ✕
        </button>
      </div>

      {/* Image area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={(e) => {
          touchStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }}
        onTouchMove={(e) => {
          if (!touchStart.current) return;
          setDragX(e.touches[0].clientX - touchStart.current.x);
        }}
        onTouchEnd={() => {
          if (Math.abs(dragX) > 60) go(dragX < 0 ? 1 : -1);
          setDragX(0);
          touchStart.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.displayUrl}
          alt={photo.fileName}
          draggable={false}
          className={`max-h-full max-w-full select-none object-contain transition-transform ${
            leaving ? "lightbox-photo-out" : "lightbox-photo-in"
          }`}
          style={
            dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined
          }
        />

        {photos.length > 1 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 sm:h-14 sm:w-14"
          >
            ‹
          </button>
        )}
        {photos.length > 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 sm:h-14 sm:w-14"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3 border-t border-[var(--hairline)] bg-[var(--panel)] px-4 py-4">
        {shareSupported && (
          <button
            disabled={busy !== null}
            onClick={async () => {
              setBusy("share");
              try {
                const result = await sharePhotos(
                  eventId,
                  [currentPhoto],
                  eventName,
                );
                if (result === "unsupported" || result === "failed") {
                  await downloadSingle(eventId, currentPhoto);
                }
              } finally {
                setBusy(null);
              }
            }}
            className="rounded-full border border-[var(--hairline)] px-5 py-2 text-xs text-[var(--ink-strong)] hover:bg-[var(--hairline)] disabled:opacity-50"
          >
            {busy === "share" ? "Preparing…" : "Share"}
          </button>
        )}
        <button
          disabled={busy !== null}
          onClick={async () => {
            setBusy("download");
            try {
              await downloadSingle(eventId, currentPhoto);
            } catch {
              alert("Download failed — please try again.");
            } finally {
              setBusy(null);
            }
          }}
          className="rounded-full border border-[var(--hairline)] px-5 py-2 text-xs text-[var(--ink-strong)] hover:bg-[var(--hairline)] disabled:opacity-50"
        >
          {busy === "download" ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}
