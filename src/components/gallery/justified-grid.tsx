"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeJustifiedRows } from "./justified";
import type { GalleryPhoto } from "./gallery";

// Assumed content width for SSR / first paint: max-w-5xl (1024px) minus px-5 (20px) padding on
// each side = 1004px. useLayoutEffect below measures the real container synchronously before
// the browser paints, so mobile widths correct without a visible flash.
const ASSUMED_WIDTH = 1004;
const GAP = 4;

type Props = {
  photos: GalleryPhoto[];
  selectMode: boolean;
  selected: Set<string>;
  onTileClick: (index: number, id: string) => void;
  onTilePressStart: (id: string) => void;
  onTilePressEnd: () => void;
  longPressActiveRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  /** Reserved for Task 8's reveal gate. Defaults to true (current unconditional .tile-in behavior). */
  revealed?: boolean;
};

export function JustifiedGrid({
  photos,
  selectMode,
  selected,
  onTileClick,
  onTilePressStart,
  onTilePressEnd,
  longPressActiveRef,
  revealed = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(ASSUMED_WIDTH);

  // Measure synchronously before first paint so mobile widths correct without a flash.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const observer = new ResizeObserver((entries) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const entry = entries[0];
        if (!entry) return;
        setWidth(entry.contentRect.width);
      });
    });
    observer.observe(el);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const targetRowHeight = width < 640 ? 150 : 240;
  const rows = computeJustifiedRows(photos, width, targetRowHeight, GAP);

  return (
    <div className="mx-auto max-w-5xl px-0 pb-32 pt-0.5 sm:px-5">
      {/*
        The ref lives on this inner, unpadded div so `clientWidth` reflects the true content
        box available to the row items. Measuring the padded wrapper instead would overcount by
        the horizontal padding (40px at the sm:px-5 breakpoint), causing rows to compute wider
        than the visible area and flex-shrink to distort every tile's aspect ratio.
      */}
      <div ref={containerRef} className="flex flex-col" style={{ gap: GAP }}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={{ height: row.height, gap: GAP }}
          >
            {row.indices.map((i) => {
              const photo = photos[i];
              const isSelected = selected.has(photo.id);
              const ratio =
                photo.width > 0 && photo.height > 0
                  ? photo.width / photo.height
                  : 1;

              return (
                <div
                  key={photo.id}
                  className={revealed ? "tile-in relative" : "relative"}
                  style={{
                    width: ratio * row.height,
                    height: row.height,
                    animationDelay: revealed
                      ? `${Math.min(i, 12) * 0.03}s`
                      : undefined,
                  }}
                >
                  <button
                    className="group block h-full w-full"
                    onClick={() => onTileClick(i, photo.id)}
                    onTouchStart={() => onTilePressStart(photo.id)}
                    onTouchEnd={onTilePressEnd}
                    onTouchMove={onTilePressEnd}
                    onContextMenu={(e) => {
                      if (longPressActiveRef.current) e.preventDefault();
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
                          ? "border-transparent text-[var(--accent-ink)] opacity-100"
                          : selectMode
                            ? "border-white/60 bg-black/30 text-transparent opacity-100"
                            : "border-transparent opacity-0"
                      }`}
                      style={
                        isSelected ? { background: "var(--accent)" } : undefined
                      }
                    >
                      ✓
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
