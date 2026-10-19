import { buildCaptionLines } from "./caption";
import type { CaptionLines } from "./caption";
import { findBrandLogo } from "./brandLogos";
import type { BorderSettings, CaptionSelection, CreditSettings, ExifData } from "./types";

const FALLBACK_FONT_FAMILY = "sans-serif";
const CREDIT_FONT_RATIO = 0.28; // of border size
const TITLE_FONT_RATIO = 0.26;
const DETAILS_FONT_RATIO = 0.17;
const LINE_GAP_RATIO = 0.08;
const DETAILS_OPACITY = 0.7;
const BRAND_LOGO_GAP_RATIO = 0.12;
const BRAND_LOGO_MAX_WIDTH_RATIO = 0.45;
const ICON_VIEWBOX_SIZE = 24;
const CREDIT_IMAGE_HEIGHT_RATIO = 0.5; // of border size
const LEFT_TEXT_WIDTH_RATIO = 0.6; // of the width between side borders
const RIGHT_AREA_WIDTH_RATIO = 0.4;
const DARK_TEXT_COLOR = "#222222";
const LIGHT_TEXT_COLOR = "#eeeeee";
const LUMINANCE_THRESHOLD = 140;
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const HEX_RADIX = 16;
const FALLBACK_BORDER_COLOR = "#ffffff";

interface CaptionContext {
  context: CanvasRenderingContext2D;
  border: number;
  width: number;
  height: number;
}

function safeColor(color: string): string {
  return HEX_COLOR_PATTERN.test(color) ? color : FALLBACK_BORDER_COLOR;
}

function getFontFamily(): string {
  return getComputedStyle(document.body).fontFamily || FALLBACK_FONT_FAMILY;
}

function isLightColor(hexColor: string): boolean {
  const red = parseInt(hexColor.slice(1, 3), HEX_RADIX);
  const green = parseInt(hexColor.slice(3, 5), HEX_RADIX);
  const blue = parseInt(hexColor.slice(5, 7), HEX_RADIX);
  return LUMA_RED * red + LUMA_GREEN * green + LUMA_BLUE * blue > LUMINANCE_THRESHOLD;
}

function drawCreditImage(target: CaptionContext, image: ImageBitmap): void {
  const { context, border, width, height } = target;
  const maxHeight = border * CREDIT_IMAGE_HEIGHT_RATIO;
  const maxWidth = (width - 2 * border) * RIGHT_AREA_WIDTH_RATIO;
  const scale = Math.min(maxHeight / image.height, maxWidth / image.width);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, width - border - drawWidth, height - border / 2 - drawHeight / 2, drawWidth, drawHeight);
}

function drawCreditText(target: CaptionContext, text: string): void {
  const { context, border, width, height } = target;
  context.font = `${Math.round(border * CREDIT_FONT_RATIO)}px ${getFontFamily()}`;
  context.textAlign = "right";
  context.fillText(text, width - border, height - border / 2, (width - 2 * border) * RIGHT_AREA_WIDTH_RATIO);
}

function drawCredit(target: CaptionContext, credit: CreditSettings): void {
  const text = credit.text.trim();
  if (credit.mode === "text" && text) drawCreditText(target, text);
  if (credit.mode === "image" && credit.image) drawCreditImage(target, credit.image);
}

interface CaptionLine {
  text: string;
  fontSize: number;
  weight: "bold" | "normal";
  opacity: number;
  isTitle: boolean;
}

interface IconBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const iconBoundsCache = new Map<string, IconBounds>();

function getIconBounds(path: string): IconBounds | null {
  const cached = iconBoundsCache.get(path);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = ICON_VIEWBOX_SIZE;
  canvas.height = ICON_VIEWBOX_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fill(new Path2D(path));

  const pixels = context.getImageData(0, 0, ICON_VIEWBOX_SIZE, ICON_VIEWBOX_SIZE).data;
  let minX = ICON_VIEWBOX_SIZE;
  let minY = ICON_VIEWBOX_SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < ICON_VIEWBOX_SIZE; y += 1) {
    for (let x = 0; x < ICON_VIEWBOX_SIZE; x += 1) {
      if (pixels[(y * ICON_VIEWBOX_SIZE + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  iconBoundsCache.set(path, bounds);
  return bounds;
}

function drawBrandLogo(target: CaptionContext, brand: string, centerY: number, visibleHeight: number): number {
  const logo = findBrandLogo(brand);
  if (!logo) return 0;
  const { context, border } = target;
  const bounds = getIconBounds(logo.path);
  if (!bounds) return 0;
  const maxLogoWidth = (target.width - 2 * border) * LEFT_TEXT_WIDTH_RATIO * BRAND_LOGO_MAX_WIDTH_RATIO;
  const logoHeight = Math.min(visibleHeight, maxLogoWidth * (bounds.height / bounds.width));
  const scale = logoHeight / bounds.height;
  const logoWidth = bounds.width * scale;
  context.save();
  context.translate(border, centerY - logoHeight / 2);
  context.scale(scale, scale);
  context.translate(-bounds.x, -bounds.y);
  context.fillStyle = `#${logo.hex}`;
  context.fill(new Path2D(logo.path));
  context.restore();
  return logoWidth + border * BRAND_LOGO_GAP_RATIO;
}

// Draws the title and details as one block, vertically centered in the bottom border.
function drawLeftCaption(target: CaptionContext, captionLines: CaptionLines): void {
  const { context, border, width, height } = target;
  const logo = findBrandLogo(captionLines.brand);
  const title = logo
    ? captionLines.model
    : [captionLines.brand, captionLines.model].filter(Boolean).join(" ");
  const lines: CaptionLine[] = [];
  if (captionLines.brand || captionLines.model) {
    lines.push({ text: title, fontSize: border * TITLE_FONT_RATIO, weight: "bold", opacity: 1, isTitle: true });
  }
  if (captionLines.details) {
    lines.push({
      text: captionLines.details,
      fontSize: border * DETAILS_FONT_RATIO,
      weight: "normal",
      opacity: DETAILS_OPACITY,
      isTitle: false,
    });
  }
  const gap = border * LINE_GAP_RATIO;
  const blockHeight = lines.reduce((sum, line) => sum + line.fontSize, 0) + gap * (lines.length - 1);
  let lineTop = height - border / 2 - blockHeight / 2;
  context.textAlign = "left";
  const titleLine = lines.find((line) => line.isTitle);
  const titleCenterY = titleLine ? lineTop + titleLine.fontSize / 2 : height - border / 2;
  let logoHeight = titleLine?.fontSize ?? border * TITLE_FONT_RATIO;
  if (titleLine && captionLines.model) {
    context.font = `${titleLine.weight} ${Math.round(titleLine.fontSize)}px ${getFontFamily()}`;
    const modelBounds = context.measureText(captionLines.model);
    logoHeight = modelBounds.actualBoundingBoxAscent + modelBounds.actualBoundingBoxDescent || logoHeight;
  }
  const logoAdvance = drawBrandLogo(target, captionLines.brand, titleCenterY, logoHeight);
  for (const line of lines) {
    context.font = `${line.weight} ${Math.round(line.fontSize)}px ${getFontFamily()}`;
    context.globalAlpha = line.opacity;
    const x = border + (line.isTitle ? logoAdvance : 0);
    const maxWidth = (width - 2 * border) * LEFT_TEXT_WIDTH_RATIO - (x - border);
    context.fillText(line.text, x, lineTop + line.fontSize / 2, maxWidth);
    lineTop += line.fontSize + gap;
  }
  context.globalAlpha = 1;
}

export interface BorderInput {
  border: BorderSettings;
  caption: CaptionSelection;
  credit: CreditSettings;
  exif: ExifData;
}

// Adds a border of `percent` of the shorter side, with captions in the bottom edge.
export function addBorder(source: HTMLCanvasElement, input: BorderInput): HTMLCanvasElement {
  const { border: settings, caption, credit, exif } = input;
  const border = Math.round((Math.min(source.width, source.height) * settings.percent) / 100);
  if (!settings.enabled || border <= 0) return source;

  const output = document.createElement("canvas");
  output.width = source.width + 2 * border;
  output.height = source.height + 2 * border;
  const context = output.getContext("2d");
  if (!context) return source;

  const color = safeColor(settings.color);
  context.fillStyle = color;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, border, border);

  context.fillStyle = isLightColor(color) ? DARK_TEXT_COLOR : LIGHT_TEXT_COLOR;
  context.textBaseline = "middle";
  const target: CaptionContext = { context, border, width: output.width, height: output.height };
  drawLeftCaption(target, buildCaptionLines(exif, caption));
  drawCredit(target, credit);
  return output;
}
