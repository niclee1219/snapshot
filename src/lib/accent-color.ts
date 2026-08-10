// Relative-luminance contrast helper for accent colors picked by admins,
// so text/icons drawn on top of an arbitrary accent fill stay legible
// regardless of which hex value was chosen or which theme is active.

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** Picks black or white ink for legible text/icons on top of `accentHex`. */
export function accentInkFor(accentHex: string): string {
  const luminance = relativeLuminance(accentHex);
  if (luminance === null) return "#000000";
  return luminance > 0.45 ? "#000000" : "#ffffff";
}
