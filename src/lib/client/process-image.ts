import exifr from "exifr";

export type ProcessedImage = {
  width: number;
  height: number;
  capturedAt: number | null;
  displayBlob: Blob;
  thumbBlob: Blob;
};

const DISPLAY_MAX = 1600;
const THUMB_MAX = 400;

/**
 * Browser-side variant generation: decode once, resize twice.
 * Variants ship as WebP; the untouched original file is uploaded separately.
 * createImageBitmap applies EXIF orientation, so variants are always upright.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const [bitmap, capturedAt] = await Promise.all([
    createImageBitmap(file),
    readCaptureDate(file),
  ]);

  try {
    const displayBlob = await resizeToWebp(bitmap, DISPLAY_MAX, 0.82);
    const thumbBlob = await resizeToWebp(bitmap, THUMB_MAX, 0.75);
    return {
      width: bitmap.width,
      height: bitmap.height,
      capturedAt,
      displayBlob,
      thumbBlob,
    };
  } finally {
    bitmap.close();
  }
}

async function readCaptureDate(file: File): Promise<number | null> {
  try {
    const exif = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate"],
    });
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
    return date instanceof Date && !isNaN(date.getTime())
      ? date.getTime()
      : null;
  } catch {
    return null;
  }
}

async function resizeToWebp(
  bitmap: ImageBitmap,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: "image/webp", quality });
}
