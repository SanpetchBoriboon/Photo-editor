import {
  ALLOWED_IMAGE_TYPES,
  DEFAULT_EDIT,
  EXIF_READ_BYTES,
  EXPORT_BACKGROUND,
  EXPORT_MIME_TYPE,
  EXPORT_QUALITY,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_PIXELS,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
} from "./constants";
import { zipSync } from "fflate";
import { readExif } from "./exif";
import { createOrientedCanvas, renderEdit } from "./renderPipeline";
import { toEditSettings } from "./settings";
import type { ValidationErrorKey } from "./i18n";
import type { PhotoEntry, SharedSettings } from "./types";

const REVOKE_URL_DELAY_MS = 10_000;

export function validateImageFile(file: File): ValidationErrorKey | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "unsupportedImage";
  if (file.size > MAX_FILE_SIZE_BYTES) return "fileTooLarge";
  return null;
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
    bitmap.close();
    throw new Error("Image has too many pixels");
  }
  return bitmap;
}

async function createThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    resizeWidth: THUMBNAIL_WIDTH,
    resizeQuality: "low",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL(EXPORT_MIME_TYPE, THUMBNAIL_QUALITY);
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._-]/gu, "_");
  return base || "photo";
}

// EXIF lives at the start of a JPEG, so only the head of the file is read.
export async function createPhotoEntry(file: File): Promise<PhotoEntry> {
  const [head, thumbnailUrl] = await Promise.all([
    file.slice(0, EXIF_READ_BYTES).arrayBuffer(),
    createThumbnail(file),
  ]);
  return {
    id: crypto.randomUUID(),
    file,
    fileName: sanitizeFileName(file.name),
    exif: readExif(head),
    captionOverrides: {},
    thumbnailUrl,
    edit: DEFAULT_EDIT,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      EXPORT_MIME_TYPE,
      EXPORT_QUALITY,
    );
  });
}

// JPEG has no alpha, so flatten onto a solid background first.
function flatten(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const context = flat.getContext("2d");
  if (!context) return canvas;
  context.fillStyle = EXPORT_BACKGROUND;
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(canvas, 0, 0);
  return flat;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_DELAY_MS);
}

// Decodes the full-resolution image only for the duration of the export.
async function renderPhotoBlob(entry: PhotoEntry, shared: SharedSettings): Promise<Blob> {
  await document.fonts.ready;
  const bitmap = await decodeImage(entry.file);
  try {
    const settings = toEditSettings(entry.edit, shared);
    const oriented = createOrientedCanvas(bitmap, settings.orientation, Infinity);
    return await canvasToBlob(flatten(renderEdit(oriented, settings, entry.exif, entry.captionOverrides)));
  } finally {
    bitmap.close();
  }
}

export async function exportPhoto(entry: PhotoEntry, shared: SharedSettings): Promise<void> {
  const blob = await renderPhotoBlob(entry, shared);
  triggerDownload(blob, `${entry.fileName}-edited.jpg`);
}

export async function exportPhotosAsZip(
  entries: PhotoEntry[],
  shared: SharedSettings,
  onProgress: (done: number) => void,
): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  const nameCounts = new Map<string, number>();
  for (const [index, entry] of entries.entries()) {
    const blob = await renderPhotoBlob(entry, shared);
    const baseName = `${entry.fileName}-edited`;
    const count = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, count);
    const fileName = `${baseName}${count > 1 ? `-${count}` : ""}.jpg`;
    files[fileName] = new Uint8Array(await blob.arrayBuffer());
    onProgress(index + 1);
  }
  const archive = zipSync(files, { level: 0 });
  triggerDownload(new Blob([archive], { type: "application/zip" }), "edited-photos.zip");
}
