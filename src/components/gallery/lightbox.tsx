"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "./gallery";
import { downloadSingle, sharePhotos } from "./actions";

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
  const photo = photos[index];
  const [busy, setBusy] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onNavigate(next);
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
      const p = photos[i];
      if (p) {
        const img = new Image();
        img.src = p.displayUrl;
      }
    });
  }, [index, photos]);

  if (!photo) return null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-xs tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      {/* Image area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
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
          className="max-h-full max-w-full select-none object-contain transition-transform"
          style={
            dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined
          }
        />

        {index > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white/80 hover:bg-black/70 sm:flex"
          >
            ‹
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-xl text-white/80 hover:bg-black/70 sm:flex"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3 px-4 py-4">
        {shareSupported && (
          <button
            disabled={busy !== null}
            onClick={async () => {
              setBusy("share");
              try {
                const result = await sharePhotos(eventId, [photo], eventName);
                if (result === "unsupported" || result === "failed") {
                  await downloadSingle(eventId, photo);
                }
              } finally {
                setBusy(null);
              }
            }}
            className="rounded-full border border-white/20 px-5 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50"
          >
            {busy === "share" ? "Preparing…" : "Share"}
          </button>
        )}
        <button
          disabled={busy !== null}
          onClick={async () => {
            setBusy("download");
            try {
              await downloadSingle(eventId, photo);
            } catch {
              alert("Download failed — please try again.");
            } finally {
              setBusy(null);
            }
          }}
          className="rounded-full border border-white/20 px-5 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50"
        >
          {busy === "download" ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}
