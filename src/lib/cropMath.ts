import { ASPECT_PRESETS, MIN_CROP_SIZE } from "./constants";
import type { CropHandle, CropRect } from "./types";

const DEGREES_TO_RADIANS = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Converts a pixel aspect ratio (width / height) to one expressed in normalized crop units.
export function toNormalizedAspect(pixelRatio: number, imageWidth: number, imageHeight: number): number {
  return (pixelRatio * imageHeight) / imageWidth;
}

// Returns the normalized aspect lock for a preset id, or null when cropping is free.
export function resolveLockedAspect(presetId: string, imageWidth: number, imageHeight: number): number | null {
  const ratio = ASPECT_PRESETS.find((preset) => preset.id === presetId)?.ratio;
  if (ratio === null || ratio === undefined) return null;
  const pixelRatio = ratio === "original" ? imageWidth / imageHeight : ratio;
  return toNormalizedAspect(pixelRatio, imageWidth, imageHeight);
}

export function fitCropToAspect(normalizedAspect: number): CropRect {
  const width = normalizedAspect >= 1 ? 1 : normalizedAspect;
  const height = normalizedAspect >= 1 ? 1 / normalizedAspect : 1;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

function getSafeCropRect(imageWidth: number, imageHeight: number, crop: CropRect, angleDegrees: number): CropRect {
  const angle = Math.abs(angleDegrees) * DEGREES_TO_RADIANS;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const pixelAspect = (crop.width * imageWidth) / (crop.height * imageHeight);
  const safeHeight = Math.min(
    imageWidth / (pixelAspect * cosine + sine),
    imageHeight / (pixelAspect * sine + cosine),
  );
  const safeWidth = pixelAspect * safeHeight;
  const width = safeWidth / imageWidth;
  const height = safeHeight / imageHeight;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

// Shrinks and repositions a crop inside the rotated image while preserving its ratio and framing.
export function adjustCropForStraighten(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
  previousAngle: number,
  nextAngle: number,
): CropRect {
  const previousSafe = getSafeCropRect(imageWidth, imageHeight, crop, previousAngle);
  const nextSafe = getSafeCropRect(imageWidth, imageHeight, crop, nextAngle);
  const scale = Math.min(crop.width / previousSafe.width, crop.height / previousSafe.height, 1);
  const centerX = clamp((crop.x + crop.width / 2 - previousSafe.x) / previousSafe.width, scale / 2, 1 - scale / 2);
  const centerY = clamp((crop.y + crop.height / 2 - previousSafe.y) / previousSafe.height, scale / 2, 1 - scale / 2);
  const width = nextSafe.width * scale;
  const height = nextSafe.height * scale;
  return {
    x: nextSafe.x + centerX * nextSafe.width - width / 2,
    y: nextSafe.y + centerY * nextSafe.height - height / 2,
    width,
    height,
  };
}

export function moveCrop(crop: CropRect, deltaX: number, deltaY: number): CropRect {
  return {
    ...crop,
    x: clamp(crop.x + deltaX, 0, 1 - crop.width),
    y: clamp(crop.y + deltaY, 0, 1 - crop.height),
  };
}

function resizeFree(crop: CropRect, handle: CropHandle, deltaX: number, deltaY: number): CropRect {
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const newLeft = handle.includes("w") ? clamp(crop.x + deltaX, 0, right - MIN_CROP_SIZE) : crop.x;
  const newTop = handle.includes("n") ? clamp(crop.y + deltaY, 0, bottom - MIN_CROP_SIZE) : crop.y;
  const newRight = handle.includes("e") ? clamp(right + deltaX, newLeft + MIN_CROP_SIZE, 1) : right;
  const newBottom = handle.includes("s") ? clamp(bottom + deltaY, newTop + MIN_CROP_SIZE, 1) : bottom;
  return { x: newLeft, y: newTop, width: newRight - newLeft, height: newBottom - newTop };
}

function resizeCornerKeepingAspect(
  crop: CropRect,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  aspect: number,
): CropRect {
  const movesEast = handle.includes("e");
  const movesSouth = handle.includes("s");
  const anchorX = movesEast ? crop.x : crop.x + crop.width;
  const anchorY = movesSouth ? crop.y : crop.y + crop.height;
  const cornerX = (movesEast ? crop.x + crop.width : crop.x) + deltaX;
  const cornerY = (movesSouth ? crop.y + crop.height : crop.y) + deltaY;
  const rawWidth = Math.max(0, movesEast ? cornerX - anchorX : anchorX - cornerX);
  const rawHeight = Math.max(0, movesSouth ? cornerY - anchorY : anchorY - cornerY);
  const availableWidth = movesEast ? 1 - anchorX : anchorX;
  const availableHeight = movesSouth ? 1 - anchorY : anchorY;
  const width = Math.min(Math.max(rawWidth, rawHeight * aspect, MIN_CROP_SIZE), availableWidth, availableHeight * aspect);
  const height = width / aspect;
  return {
    x: movesEast ? anchorX : anchorX - width,
    y: movesSouth ? anchorY : anchorY - height,
    width,
    height,
  };
}

// With a locked aspect only corner handles resize; edge handles leave the crop unchanged.
export function resizeCrop(
  crop: CropRect,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  aspect: number | null,
): CropRect {
  if (aspect === null) return resizeFree(crop, handle, deltaX, deltaY);
  if (handle.length === 2) return resizeCornerKeepingAspect(crop, handle, deltaX, deltaY, aspect);
  return crop;
}
