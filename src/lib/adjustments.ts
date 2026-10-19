import { DEFAULT_ADJUSTMENTS } from "./constants";
import type { Adjustments } from "./types";

const CHANNEL_MAX = 255;
const PERCENT_SCALE = 100;
const EXPOSURE_STOPS_AT_MAX = 2;
const TEMPERATURE_GAIN_AT_MAX = 0.25;
const TINT_GAIN_AT_MAX = 0.2;
const TONE_STRENGTH = 0.3;
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const CONTRAST_PIVOT = 0.5;
const PIXEL_STRIDE = 4;

interface PixelParams {
  redGain: number;
  greenGain: number;
  blueGain: number;
  shadows: number;
  highlights: number;
  contrastFactor: number;
  saturation: number;
  vibrance: number;
}

function prepareParams(adjustments: Adjustments): PixelParams {
  const exposureGain = 2 ** ((adjustments.exposure / PERCENT_SCALE) * EXPOSURE_STOPS_AT_MAX);
  const warmth = (adjustments.temperature / PERCENT_SCALE) * TEMPERATURE_GAIN_AT_MAX;
  const magenta = (adjustments.tint / PERCENT_SCALE) * TINT_GAIN_AT_MAX;
  return {
    redGain: exposureGain * (1 + warmth),
    greenGain: exposureGain * (1 - magenta),
    blueGain: exposureGain * (1 - warmth),
    shadows: (adjustments.shadows / PERCENT_SCALE) * TONE_STRENGTH,
    highlights: (adjustments.highlights / PERCENT_SCALE) * TONE_STRENGTH,
    contrastFactor: 1 + adjustments.contrast / PERCENT_SCALE,
    saturation: adjustments.saturation / PERCENT_SCALE,
    vibrance: adjustments.vibrance / PERCENT_SCALE,
  };
}

function luma(red: number, green: number, blue: number): number {
  return LUMA_RED * red + LUMA_GREEN * green + LUMA_BLUE * blue;
}

function toneOffset(lumaValue: number, params: PixelParams): number {
  const clamped = Math.min(Math.max(lumaValue, 0), 1);
  return params.shadows * (1 - clamped) ** 2 + params.highlights * clamped ** 2;
}

// Vibrance boosts muted colors more than already saturated ones.
function colorFactor(red: number, green: number, blue: number, params: PixelParams): number {
  const peak = Math.max(red, green, blue);
  const pixelSaturation = peak > 0 ? (peak - Math.min(red, green, blue)) / peak : 0;
  const vibranceBoost = params.vibrance * (1 - Math.min(pixelSaturation, 1));
  return Math.max(0, 1 + params.saturation + vibranceBoost);
}

function finishChannel(value: number, grey: number, factor: number, contrastFactor: number): number {
  const colored = grey + (value - grey) * factor;
  return ((colored - CONTRAST_PIVOT) * contrastFactor + CONTRAST_PIVOT) * CHANNEL_MAX;
}

// Writes into the pixel buffer; Uint8ClampedArray clamps and rounds the result.
function adjustPixel(pixels: Uint8ClampedArray, index: number, params: PixelParams): void {
  const red = (pixels[index] / CHANNEL_MAX) * params.redGain;
  const green = (pixels[index + 1] / CHANNEL_MAX) * params.greenGain;
  const blue = (pixels[index + 2] / CHANNEL_MAX) * params.blueGain;
  const lumaValue = luma(red, green, blue);
  const offset = toneOffset(lumaValue, params);
  const grey = lumaValue + offset;
  const factor = colorFactor(red, green, blue, params);
  pixels[index] = finishChannel(red + offset, grey, factor, params.contrastFactor);
  pixels[index + 1] = finishChannel(green + offset, grey, factor, params.contrastFactor);
  pixels[index + 2] = finishChannel(blue + offset, grey, factor, params.contrastFactor);
}

function isNeutral(adjustments: Adjustments): boolean {
  return (Object.keys(DEFAULT_ADJUSTMENTS) as (keyof Adjustments)[]).every(
    (key) => adjustments[key] === DEFAULT_ADJUSTMENTS[key],
  );
}

export function applyAdjustments(canvas: HTMLCanvasElement, adjustments: Adjustments): void {
  if (isNeutral(adjustments)) return;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const params = prepareParams(adjustments);
  for (let index = 0; index < imageData.data.length; index += PIXEL_STRIDE) {
    adjustPixel(imageData.data, index, params);
  }
  context.putImageData(imageData, 0, 0);
}
