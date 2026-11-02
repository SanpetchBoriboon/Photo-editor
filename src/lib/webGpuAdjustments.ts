/// <reference types="@webgpu/types" />

import type { Adjustments } from "./types";

const WORKGROUP_SIZE = 8;
const BYTES_PER_PIXEL = 4;
const COPY_BYTES_PER_ROW_ALIGNMENT = 256;
const TEMPERATURE_GAIN_AT_MAX = 0.25;
const TINT_GAIN_AT_MAX = 0.2;
const TONE_STRENGTH = 0.3;
const PERCENT_SCALE = 100;

const SHADER_CODE = `
struct Params {
  exposureAndGains: vec4<f32>,
  toneAndSaturation: vec4<f32>,
  vibranceAndSize: vec4<f32>,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn srgbToLinear(encoded: vec3<f32>) -> vec3<f32> {
  let low = encoded / 12.92;
  let high = pow((encoded + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(high, low, encoded <= vec3<f32>(0.04045));
}

fn linearToSrgb(linear: vec3<f32>) -> vec3<f32> {
  let safe = max(linear, vec3<f32>(0.0));
  let low = safe * 12.92;
  let high = 1.055 * pow(safe, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  return select(high, low, safe <= vec3<f32>(0.0031308));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let dimensions = textureDimensions(sourceTexture);
  if (invocation.x >= dimensions.x || invocation.y >= dimensions.y) {
    return;
  }

  let coordinate = vec2<i32>(invocation.xy);
  let source = textureLoad(sourceTexture, coordinate, 0);
  let gains = params.exposureAndGains.yzw * exp2(params.exposureAndGains.x);
  let color = srgbToLinear(source.rgb) * gains;
  let luminance = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let boundedLuminance = clamp(luminance, 0.0, 1.0);
  let shadowOffset = params.toneAndSaturation.x * pow(1.0 - boundedLuminance, 2.0);
  let highlightOffset = params.toneAndSaturation.y * pow(boundedLuminance, 2.0);
  let offset = shadowOffset + highlightOffset;
  let grey = luminance + offset;
  let peak = max(color.r, max(color.g, color.b));
  let minimum = min(color.r, min(color.g, color.b));
  let pixelSaturation = select(0.0, (peak - minimum) / peak, peak > 0.0);
  let vibranceBoost = params.vibranceAndSize.x * (1.0 - min(pixelSaturation, 1.0));
  let colorFactor = max(0.0, 1.0 + params.toneAndSaturation.w + vibranceBoost);
  let toned = vec3<f32>(grey) + (color - vec3<f32>(luminance)) * colorFactor;
  let contrast = params.toneAndSaturation.z;
  let contrasted = (toned - vec3<f32>(0.18)) * contrast + vec3<f32>(0.18);
  let encoded = linearToSrgb(contrasted);
  let pixel = vec2f(f32(invocation.x), f32(invocation.y));
  let noise = fract(52.9829189 * fract(dot(pixel, vec2f(0.06711056, 0.00583715))));
  let dither = (noise - 0.5) / 255.0;
  let output = clamp(encoded + vec3f(dither), vec3f(0.0), vec3f(1.0));
  textureStore(outputTexture, coordinate, vec4<f32>(output, source.a));
}
`;

interface WebGPUState {
  device: GPUDevice;
  pipeline: GPUComputePipeline;
}

let statePromise: Promise<WebGPUState | null> | null = null;

function getWebGPUState(): Promise<WebGPUState | null> {
  if (!statePromise) {
    statePromise = (async () => {
      if (!navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      const shaderModule = device.createShaderModule({ code: SHADER_CODE });
      const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "main" },
      });
      return { device, pipeline };
    })().catch(() => null);
  }
  return statePromise;
}

function bytesPerRowFor(width: number): number {
  const unaligned = width * BYTES_PER_PIXEL;
  return Math.ceil(unaligned / COPY_BYTES_PER_ROW_ALIGNMENT) * COPY_BYTES_PER_ROW_ALIGNMENT;
}

function packParams(adjustments: Adjustments, width: number, height: number): Float32Array {
  const warmth = (adjustments.temperature / PERCENT_SCALE) * TEMPERATURE_GAIN_AT_MAX;
  const magenta = (adjustments.tint / PERCENT_SCALE) * TINT_GAIN_AT_MAX;
  return new Float32Array([
    adjustments.exposure,
    1 + warmth,
    1 - magenta,
    1 - warmth,
    (adjustments.shadows / PERCENT_SCALE) * TONE_STRENGTH,
    (adjustments.highlights / PERCENT_SCALE) * TONE_STRENGTH,
    1 + adjustments.contrast / PERCENT_SCALE,
    adjustments.saturation / PERCENT_SCALE,
    adjustments.vibrance / PERCENT_SCALE,
    width,
    height,
    0,
  ]);
}

export async function applyWebGPUAdjustments(canvas: HTMLCanvasElement, adjustments: Adjustments): Promise<boolean> {
  const state = await getWebGPUState();
  if (!state) return false;

  const { width, height } = canvas;
  if (width > state.device.limits.maxTextureDimension2D || height > state.device.limits.maxTextureDimension2D) {
    return false;
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;

  const inputTexture = state.device.createTexture({
    size: { width, height },
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const outputTexture = state.device.createTexture({
    size: { width, height },
    format: "rgba8unorm",
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  const uniformData = packParams(adjustments, width, height);
  const uniformBuffer = state.device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bytesPerRow = bytesPerRowFor(width);
  const readbackBuffer = state.device.createBuffer({
    size: bytesPerRow * height,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  try {
    state.device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture: inputTexture, colorSpace: "srgb" },
      { width, height },
    );
    state.device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer as ArrayBuffer);
    const bindGroup = state.device.createBindGroup({
      layout: state.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });
    const encoder = state.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(state.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / WORKGROUP_SIZE), Math.ceil(height / WORKGROUP_SIZE));
    pass.end();
    encoder.copyTextureToBuffer(
      { texture: outputTexture },
      { buffer: readbackBuffer, bytesPerRow, rowsPerImage: height },
      { width, height },
    );
    state.device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(GPUMapMode.READ);

    const mapped = new Uint8Array(readbackBuffer.getMappedRange());
    const imageData = context.createImageData(width, height);
    const rowBytes = width * BYTES_PER_PIXEL;
    for (let row = 0; row < height; row += 1) {
      const sourceStart = row * bytesPerRow;
      imageData.data.set(mapped.subarray(sourceStart, sourceStart + rowBytes), row * rowBytes);
    }
    readbackBuffer.unmap();
    context.putImageData(imageData, 0, 0);
    return true;
  } catch {
    if (readbackBuffer.mapState === "mapped") readbackBuffer.unmap();
    statePromise = null;
    return false;
  } finally {
    inputTexture.destroy();
    outputTexture.destroy();
    uniformBuffer.destroy();
    readbackBuffer.destroy();
  }
}
