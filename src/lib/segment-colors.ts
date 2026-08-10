// A fixed, complete set of Tailwind class strings — never dynamically constructed,
// since Tailwind's compiler only picks up statically-analyzable class names.
//
// Two parallel palettes, indexed by a segment's position within its parent
// `segments` array (NOT by photo iteration order — the color must be stable
// per segment based on where that segment sits in the segments list):
//
//   - `segmentColorClass(index)` — badge classes (bg + text, light + dark) for
//     things like the photo-manager's per-tile segment `Badge`.
//   - `segmentSwatchClass(index)` — a single solid background class (e.g. for a
//     small dot/swatch next to a segment's name in the segment list/manager).
//
// Both arrays share the same length and color order, so `segmentColorClass(i)`
// and `segmentSwatchClass(i)` always refer to the same hue for a given index.

const SEGMENT_BADGE_PALETTE = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
] as const;

const SEGMENT_SWATCH_PALETTE = [
  "bg-blue-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
] as const;

/** Badge classes (background + text, light + dark) for a segment at `segmentIndex`. */
export function segmentColorClass(segmentIndex: number): string {
  return SEGMENT_BADGE_PALETTE[segmentIndex % SEGMENT_BADGE_PALETTE.length];
}

/** Solid background class for a small swatch/dot for a segment at `segmentIndex`. */
export function segmentSwatchClass(segmentIndex: number): string {
  return SEGMENT_SWATCH_PALETTE[segmentIndex % SEGMENT_SWATCH_PALETTE.length];
}
