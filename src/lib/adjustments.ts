import { DEFAULT_ADJUSTMENTS } from "./constants";
import type { Adjustments } from "./types";

const CHANNEL_MAX = 255;
const PERCENT_SCALE = 100;
const SRGB_TO_LINEAR_THRESHOLD = 0.04045;
const LINEAR_TO_SRGB_THRESHOLD = 0.0031308;
const SRGB_ALPHA = 0.055;
const SRGB_EXPONENT = 2.4;
const LINEAR_SRGB_EXPONENT = 1 / SRGB_EXPONENT;
const TEMPERATURE_GAIN_AT_MAX = 0.25;
const TINT_GAIN_AT_MAX = 0.2;
const TONE_STRENGTH = 0.3;
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const CONTRAST_PIVOT = 0.5;
const PIXEL_STRIDE = 4;

interface PixelParams {
  exposureLut: Float32Array;
  redGain: number;
  greenGain: number;
  blueGain: number;
  shadows: number;
  highlights: number;
  contrastFactor: number;
  saturation: number;
  vibrance: number;
}

function createExposureLut(gain: number): Float32Array {
  const lut = new Float32Array(CHANNEL_MAX + 1);
  for (let value = 0; value <= CHANNEL_MAX; value += 1) {
    const srgb = value / CHANNEL_MAX;
    const linear =
      srgb <= SRGB_TO_LINEAR_THRESHOLD ? srgb / 12.92 : ((srgb + SRGB_ALPHA) / (1 + SRGB_ALPHA)) ** SRGB_EXPONENT;
    const exposed = linear * gain;
    lut[value] =
      exposed <= LINEAR_TO_SRGB_THRESHOLD
        ? exposed * 12.92
        : (1 + SRGB_ALPHA) * exposed ** LINEAR_SRGB_EXPONENT - SRGB_ALPHA;
  }
  return lut;
}

function prepareParams(adjustments: Adjustments): PixelParams {
  const exposureGain = 2 ** adjustments.exposure;
  const warmth = (adjustments.temperature / PERCENT_SCALE) * TEMPERATURE_GAIN_AT_MAX;
  const magenta = (adjustments.tint / PERCENT_SCALE) * TINT_GAIN_AT_MAX;
  return {
    exposureLut: createExposureLut(exposureGain),
    redGain: 1 + warmth,
    greenGain: 1 - magenta,
    blueGain: 1 - warmth,
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
function dither(index: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff - 0.5;
}

function adjustPixel(pixels: Uint8ClampedArray, index: number, params: PixelParams): void {
  const red = params.exposureLut[pixels[index]] * params.redGain;
  const green = params.exposureLut[pixels[index + 1]] * params.greenGain;
  const blue = params.exposureLut[pixels[index + 2]] * params.blueGain;
  const lumaValue = luma(red, green, blue);
  const offset = toneOffset(lumaValue, params);
  const grey = lumaValue + offset;
  const factor = colorFactor(red, green, blue, params);
  const ditherOffset = dither(index / PIXEL_STRIDE);
  pixels[index] = finishChannel(red + offset, grey, factor, params.contrastFactor) + ditherOffset;
  pixels[index + 1] = finishChannel(green + offset, grey, factor, params.contrastFactor) + ditherOffset;
  pixels[index + 2] = finishChannel(blue + offset, grey, factor, params.contrastFactor) + ditherOffset;
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
