// Pure, dependency-free justified-rows layout math.
// No DOM, no React — safe to unit-test directly.

export type JustifiedRow = { indices: number[]; height: number };

/** width / height, guarding invalid/zero/undefined dims by treating the photo as 1:1. */
function aspectRatioOf(dim: { width: number; height: number } | undefined): number {
  if (!dim) return 1;
  const { width, height } = dim;
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return width / height;
}

export function computeJustifiedRows(
  dims: ReadonlyArray<{ width: number; height: number }>,
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): JustifiedRow[] {
  if (dims.length === 0) return [];

  // Degenerate container: fall back to one photo per row at the target height.
  if (containerWidth <= 0) {
    return dims.map((_, i) => ({ indices: [i], height: targetRowHeight }));
  }

  const rows: JustifiedRow[] = [];
  let rowIndices: number[] = [];
  let rowAspectSum = 0;

  for (let i = 0; i < dims.length; i++) {
    const ratio = aspectRatioOf(dims[i]);
    rowIndices.push(i);
    rowAspectSum += ratio;

    const n = rowIndices.length;
    const widthAtTarget = rowAspectSum * targetRowHeight + gap * (n - 1);

    if (widthAtTarget >= containerWidth) {
      const height = (containerWidth - gap * (n - 1)) / rowAspectSum;
      rows.push({ indices: rowIndices, height });
      rowIndices = [];
      rowAspectSum = 0;
    }
  }

  // Leftover partial row: never stretch past the target height.
  if (rowIndices.length > 0) {
    const n = rowIndices.length;
    const exactFillHeight = (containerWidth - gap * (n - 1)) / rowAspectSum;
    const height = Math.min(targetRowHeight, exactFillHeight);
    rows.push({ indices: rowIndices, height });
  }

  return rows;
}
