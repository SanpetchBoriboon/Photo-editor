export interface ExifData {
  make?: string;
  model?: string;
  lensMake?: string;
  lensModel?: string;
  exposureTime?: number;
  fNumber?: number;
}

export interface Adjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
}

export type AdjustmentKey = keyof Adjustments;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface Orientation {
  rotation: Rotation;
  straighten: number;
  flipHorizontal: boolean;
}

export interface BorderSettings {
  enabled: boolean;
  percent: number;
  color: string;
  canvasAspect: number | null;
}

export type CaptionField = "make" | "model" | "lens" | "aperture" | "shutter";

export type CaptionOverrides = Partial<Record<CaptionField, string>>;

export type CaptionSelection = Record<CaptionField, boolean>;

export type CreditMode = "off" | "text" | "image";

export interface CreditSettings {
  mode: CreditMode;
  text: string;
  image: ImageBitmap | null;
}

export interface EditSettings {
  orientation: Orientation;
  crop: CropRect;
  adjustments: Adjustments;
  border: BorderSettings;
  caption: CaptionSelection;
  credit: CreditSettings;
}

// Border, caption and credit apply to every photo; the rest is edited per photo.
export type SharedSettings = Pick<EditSettings, "border" | "caption" | "credit">;

export type PhotoEdit = Pick<EditSettings, "orientation" | "crop" | "adjustments"> & {
  aspectId: string;
};

// The decoded bitmap is not kept here; it is decoded on demand to limit memory use.
export interface PhotoEntry {
  id: string;
  file: File;
  fileName: string;
  exif: ExifData;
  captionOverrides: CaptionOverrides;
  thumbnailUrl: string;
  edit: PhotoEdit;
}

export interface AspectPreset {
  id: string;
  label: string;
  // null = free, "original" = keep image aspect, number = width / height
  ratio: number | "original" | null;
  category?: "social";
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
