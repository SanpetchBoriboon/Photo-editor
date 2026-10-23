import { applyAdjustments } from "./adjustments";
import { addBorder } from "./borderRenderer";
import type { CaptionOverrides, CropRect, EditSettings, ExifData, Orientation } from "./types";

const DEGREES_TO_RADIANS = Math.PI / 180;
const QUARTER_TURN_ROTATIONS = [90, 270];

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

// Applies rotation/flip and downscales so the longest edge is at most `maxEdge`.
export function createOrientedCanvas(
  source: ImageBitmap,
  orientation: Orientation,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const swapsAxes = QUARTER_TURN_ROTATIONS.includes(orientation.rotation);
  const canvas = swapsAxes ? createCanvas(drawHeight, drawWidth) : createCanvas(drawWidth, drawHeight);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((orientation.rotation + orientation.straighten) * DEGREES_TO_RADIANS);
  context.scale(orientation.flipHorizontal ? -1 : 1, 1);
  context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  return canvas;
}

function cropCanvas(source: HTMLCanvasElement, crop: CropRect): HTMLCanvasElement {
  const sourceX = Math.round(crop.x * source.width);
  const sourceY = Math.round(crop.y * source.height);
  const width = Math.min(source.width - sourceX, Math.max(1, Math.round(crop.width * source.width)));
  const height = Math.min(source.height - sourceY, Math.max(1, Math.round(crop.height * source.height)));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d")?.drawImage(source, sourceX, sourceY, width, height, 0, 0, width, height);
  return canvas;
}

// Pipeline: crop -> color adjustments -> border and captions.
export function renderEdit(
  oriented: HTMLCanvasElement,
  settings: EditSettings,
  exif: ExifData,
  captionOverrides: CaptionOverrides,
): HTMLCanvasElement {
  const cropped = cropCanvas(oriented, settings.crop);
  applyAdjustments(cropped, settings.adjustments);
  return addBorder(cropped, {
    border: settings.border,
    caption: settings.caption,
    captionOverrides,
    credit: settings.credit,
    exif,
  });
}
