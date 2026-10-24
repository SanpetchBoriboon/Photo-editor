import type {
  AdjustmentKey,
  Adjustments,
  AspectPreset,
  BorderSettings,
  CaptionField,
  CaptionSelection,
  CropRect,
  Orientation,
  PhotoEdit,
  SharedSettings,
} from "./types";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;
export const EXIF_READ_BYTES = 128 * 1024;
export const THUMBNAIL_WIDTH = 160;
export const THUMBNAIL_QUALITY = 0.7;
export const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export const PREVIEW_MAX_EDGE = 1600;
export const INTERACTIVE_PREVIEW_MAX_EDGE = 800;
export const EXPORT_MIME_TYPE = "image/jpeg";
export const EXPORT_QUALITY = 0.95;
export const EXPORT_BACKGROUND = "#ffffff";

export const MIN_CROP_SIZE = 0.05;
export const CREDIT_TEXT_MAX_LENGTH = 60;
export const STRAIGHTEN_MIN_DEGREES = -45;
export const STRAIGHTEN_MAX_DEGREES = 45;
export const STRAIGHTEN_STEP_DEGREES = 0.1;
export const STRAIGHTEN_DISPLAY_DECIMALS = 1;

export const BORDER_PERCENT_MIN = 1;
export const BORDER_PERCENT_MAX = 30;
export const DEFAULT_BORDER: BorderSettings = { enabled: true, percent: 10, color: "#ffffff" };

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
export const DEFAULT_ORIENTATION: Orientation = { rotation: 0, straighten: 0, flipHorizontal: false };

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
};

export const DEFAULT_CAPTION: CaptionSelection = {
  make: true,
  model: true,
  lens: true,
  aperture: true,
  shutter: true,
};

export const FREE_ASPECT_ID = "free";

export const DEFAULT_EDIT: PhotoEdit = {
  orientation: DEFAULT_ORIENTATION,
  crop: FULL_CROP,
  adjustments: DEFAULT_ADJUSTMENTS,
  aspectId: FREE_ASPECT_ID,
};

export const DEFAULT_SHARED: SharedSettings = {
  border: DEFAULT_BORDER,
  caption: DEFAULT_CAPTION,
  credit: { mode: "off", text: "", image: null },
};

export const ADJUSTMENT_RANGE = { min: -100, max: 100, step: 0.1 } as const;
export const EXPOSURE_RANGE = { min: -5, max: 5, step: 0.01 } as const;

export const ADJUSTMENT_CONTROLS: readonly { key: AdjustmentKey; label: string }[] = [
  { key: "exposure", label: "แสง (Exposure)" },
  { key: "contrast", label: "คอนทราสต์ (Contrast)" },
  { key: "highlights", label: "ไฮไลต์ (Highlights)" },
  { key: "shadows", label: "เงา (Shadows)" },
  { key: "temperature", label: "อุณหภูมิสี (Temperature)" },
  { key: "tint", label: "ทินต์ (เขียว ↔ ม่วง)" },
  { key: "saturation", label: "ความอิ่มสี (Saturation)" },
  { key: "vibrance", label: "ไวเบรนซ์ (Vibrance)" },
];

export const ASPECT_PRESETS: readonly AspectPreset[] = [
  { id: FREE_ASPECT_ID, label: "อิสระ", ratio: null },
  { id: "original", label: "ตามต้นฉบับ", ratio: "original" },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "5:4", label: "5:4", ratio: 5 / 4 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

export const CAPTION_FIELD_LABELS: Record<CaptionField, string> = {
  make: "ยี่ห้อกล้อง",
  model: "รุ่นกล้อง",
  lens: "เลนส์",
  aperture: "ค่ารูรับแสง",
  shutter: "ความเร็วชัตเตอร์",
};
