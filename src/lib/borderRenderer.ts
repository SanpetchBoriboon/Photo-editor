import { buildCaptionLines } from "./caption";
import type { CaptionLines } from "./caption";
import type { BorderSettings, CaptionSelection, CreditSettings, ExifData } from "./types";

const FALLBACK_FONT_FAMILY = "sans-serif";
const CREDIT_FONT_RATIO = 0.28; // of border size
const TITLE_FONT_RATIO = 0.26;
const DETAILS_FONT_RATIO = 0.17;
const LINE_GAP_RATIO = 0.08;
const DETAILS_OPACITY = 0.7;
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
}

// Draws the title and details as one block, vertically centered in the bottom border.
function drawLeftCaption(target: CaptionContext, captionLines: CaptionLines): void {
  const { context, border, width, height } = target;
  const candidates: CaptionLine[] = [
    { text: captionLines.title, fontSize: border * TITLE_FONT_RATIO, weight: "bold", opacity: 1 },
    { text: captionLines.details, fontSize: border * DETAILS_FONT_RATIO, weight: "normal", opacity: DETAILS_OPACITY },
  ];
  const lines = candidates.filter((line) => line.text !== "");
  const gap = border * LINE_GAP_RATIO;
  const blockHeight = lines.reduce((sum, line) => sum + line.fontSize, 0) + gap * (lines.length - 1);
  let lineTop = height - border / 2 - blockHeight / 2;
  context.textAlign = "left";
  for (const line of lines) {
    context.font = `${line.weight} ${Math.round(line.fontSize)}px ${getFontFamily()}`;
    context.globalAlpha = line.opacity;
    context.fillText(line.text, border, lineTop + line.fontSize / 2, (width - 2 * border) * LEFT_TEXT_WIDTH_RATIO);
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
