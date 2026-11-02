import { DEFAULT_ADJUSTMENTS } from "./constants";
import { applyWebGPUAdjustments } from "./webGpuAdjustments";
import type { WebGPUAdjustmentResult } from "./webGpuAdjustments";
import type { Adjustments } from "./types";

const CHANNEL_MAX = 255;
const CHANNEL_SCALE = 1 / CHANNEL_MAX;
const PERCENT_SCALE = 100;
const SRGB_TO_LINEAR_THRESHOLD = 0.04045;
const LINEAR_TO_SRGB_THRESHOLD = 0.0031308;
const SRGB_ALPHA = 0.055;
const SRGB_EXPONENT = 2.4;
const LINEAR_SRGB_EXPONENT = 1 / SRGB_EXPONENT;
const TEMPERATURE_GAIN_AT_MAX = 0.25;
const TINT_GAIN_AT_MAX = 0.2;
const TONE_STRENGTH = 0.3;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const CONTRAST_PIVOT = 0.18;
const PIXEL_STRIDE = 4;

let lastLoggedRendererState: string | null = null;

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

function float32(value: number): number {
  return Math.fround(value);
}

function createSrgbToLinearLut(): Float32Array {
  const lut = new Float32Array(CHANNEL_MAX + 1);
  for (let value = 0; value <= CHANNEL_MAX; value += 1) {
    const encoded = float32(value * CHANNEL_SCALE);
    const low = float32(encoded / 12.92);
    const normalized = float32(float32(encoded + SRGB_ALPHA) / (1 + SRGB_ALPHA));
    const high = float32(normalized ** SRGB_EXPONENT);
    lut[value] = encoded <= SRGB_TO_LINEAR_THRESHOLD ? low : high;
  }
  return lut;
}

const SRGB_TO_LINEAR_LUT = createSrgbToLinearLut();

function prepareParams(adjustments: Adjustments): PixelParams {
  const exposureGain = float32(2 ** float32(adjustments.exposure));
  const warmth = (adjustments.temperature / PERCENT_SCALE) * TEMPERATURE_GAIN_AT_MAX;
  const magenta = (adjustments.tint / PERCENT_SCALE) * TINT_GAIN_AT_MAX;
  return {
    redGain: float32(float32(1 + warmth) * exposureGain),
    greenGain: float32(float32(1 - magenta) * exposureGain),
    blueGain: float32(float32(1 - warmth) * exposureGain),
    shadows: float32((adjustments.shadows / PERCENT_SCALE) * TONE_STRENGTH),
    highlights: float32((adjustments.highlights / PERCENT_SCALE) * TONE_STRENGTH),
    contrastFactor: float32(1 + adjustments.contrast / PERCENT_SCALE),
    saturation: float32(adjustments.saturation / PERCENT_SCALE),
    vibrance: float32(adjustments.vibrance / PERCENT_SCALE),
  };
}

function luma(red: number, green: number, blue: number): number {
  const redPart = float32(red * LUMA_RED);
  const greenPart = float32(green * LUMA_GREEN);
  const bluePart = float32(blue * LUMA_BLUE);
  return float32(float32(redPart + greenPart) + bluePart);
}

function toneOffset(lumaValue: number, params: PixelParams): number {
  const clamped = float32(Math.min(Math.max(lumaValue, 0), 1));
  const shadowCurve = float32(float32(1 - clamped) ** 2);
  const highlightCurve = float32(clamped ** 2);
  const shadowOffset = float32(params.shadows * shadowCurve);
  const highlightOffset = float32(params.highlights * highlightCurve);
  return float32(shadowOffset + highlightOffset);
}

function colorFactor(red: number, green: number, blue: number, params: PixelParams): number {
  const peak = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const pixelSaturation = peak > 0 ? float32((peak - minimum) / peak) : 0;
  const vibranceBoost = float32(params.vibrance * float32(1 - Math.min(pixelSaturation, 1)));
  return float32(Math.max(0, float32(float32(1 + params.saturation) + vibranceBoost)));
}

function linearToSrgb(value: number): number {
  const safe = float32(Math.max(value, 0));
  const low = float32(safe * 12.92);
  const power = float32(safe ** LINEAR_SRGB_EXPONENT);
  const high = float32(float32((1 + SRGB_ALPHA) * power) - SRGB_ALPHA);
  return safe <= LINEAR_TO_SRGB_THRESHOLD ? low : high;
}

function interleavedGradientNoise(x: number, y: number): number {
  const xTerm = float32(float32(x) * 0.06711056);
  const yTerm = float32(float32(y) * 0.00583715);
  const dot = float32(xTerm + yTerm);
  const innerFract = float32(dot - Math.floor(dot));
  const noiseProduct = float32(52.9829189 * innerFract);
  const noise = float32(noiseProduct - Math.floor(noiseProduct));
  return float32(float32(noise - 0.5) / CHANNEL_MAX);
}

function adjustPixel(
  linearPixels: Float32Array,
  output: Uint8ClampedArray,
  index: number,
  x: number,
  y: number,
  params: PixelParams,
): void {
  const red = float32(linearPixels[index] * params.redGain);
  const green = float32(linearPixels[index + 1] * params.greenGain);
  const blue = float32(linearPixels[index + 2] * params.blueGain);
  const lumaValue = luma(red, green, blue);
  const offset = toneOffset(lumaValue, params);
  const grey = float32(lumaValue + offset);
  const factor = colorFactor(red, green, blue, params);
  const dither = interleavedGradientNoise(x, y);
  const toned = [red, green, blue].map((channel) => {
    const chroma = float32(channel - lumaValue);
    return float32(grey + float32(chroma * factor));
  });
  for (let channel = 0; channel < 3; channel += 1) {
    const centered = float32(toned[channel] - CONTRAST_PIVOT);
    const contrasted = float32(float32(centered * params.contrastFactor) + CONTRAST_PIVOT);
    const encoded = linearToSrgb(contrasted);
    const outputValue = float32(encoded + dither);
    output[index + channel] = Math.min(Math.max(outputValue, 0), 1) * CHANNEL_MAX;
  }
}

function isNeutral(adjustments: Adjustments): boolean {
  return (Object.keys(DEFAULT_ADJUSTMENTS) as (keyof Adjustments)[]).every(
    (key) => adjustments[key] === DEFAULT_ADJUSTMENTS[key],
  );
}

function resizeForCpuPreview(canvas: HTMLCanvasElement, maxEdge: number | undefined): HTMLCanvasElement {
  if (!maxEdge || Math.max(canvas.width, canvas.height) <= maxEdge) return canvas;
  const scale = maxEdge / Math.max(canvas.width, canvas.height);
  const resized = document.createElement("canvas");
  resized.width = Math.max(1, Math.round(canvas.width * scale));
  resized.height = Math.max(1, Math.round(canvas.height * scale));
  const context = resized.getContext("2d");
  if (!context) return canvas;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
}

export async function applyAdjustments(
  canvas: HTMLCanvasElement,
  adjustments: Adjustments,
  cpuPreviewMaxEdge?: number,
): Promise<HTMLCanvasElement> {
  if (isNeutral(adjustments)) return canvas;
  let result: WebGPUAdjustmentResult;
  try {
    result = await applyWebGPUAdjustments(canvas, adjustments);
  } catch {
    result = { renderer: "cpu", reason: "runtime error" };
  }
  const stateKey = result.renderer === "gpu" ? "gpu" : `cpu:${result.reason}`;
  if (stateKey !== lastLoggedRendererState) {
    lastLoggedRendererState = stateKey;
    if (result.renderer === "gpu") console.info("[renderer] gpu");
    else console.warn("[renderer] cpu", result.reason);
  }
  if (result.renderer === "gpu") return canvas;

  const cpuCanvas = resizeForCpuPreview(canvas, cpuPreviewMaxEdge);
  const context = cpuCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return cpuCanvas;
  const imageData = context.getImageData(0, 0, cpuCanvas.width, cpuCanvas.height);
  const linearPixels = new Float32Array(imageData.data.length);
  for (let index = 0; index < imageData.data.length; index += PIXEL_STRIDE) {
    linearPixels[index] = SRGB_TO_LINEAR_LUT[imageData.data[index]];
    linearPixels[index + 1] = SRGB_TO_LINEAR_LUT[imageData.data[index + 1]];
    linearPixels[index + 2] = SRGB_TO_LINEAR_LUT[imageData.data[index + 2]];
    linearPixels[index + 3] = float32(imageData.data[index + 3] * CHANNEL_SCALE);
  }
  const params = prepareParams(adjustments);
  for (let y = 0; y < cpuCanvas.height; y += 1) {
    for (let x = 0; x < cpuCanvas.width; x += 1) {
      const index = (y * cpuCanvas.width + x) * PIXEL_STRIDE;
      adjustPixel(linearPixels, imageData.data, index, x, y, params);
    }
  }
  context.putImageData(imageData, 0, 0);
  return cpuCanvas;
}
