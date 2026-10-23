import type { CaptionField, CaptionOverrides, CaptionSelection, ExifData } from "./types";

export const CAPTION_FIELDS: readonly CaptionField[] = ["make", "model", "lens", "aperture", "shutter"];

export const DETAILS_SEPARATOR = "   ";
const APERTURE_DECIMALS = 1;
const SHUTTER_DECIMALS = 1;

export function formatAperture(fNumber: number | undefined): string {
  return fNumber ? `f/${Number(fNumber.toFixed(APERTURE_DECIMALS))}` : "";
}

export function formatShutter(exposureTime: number | undefined): string {
  if (!exposureTime) return "";
  if (exposureTime >= 1) return `${Number(exposureTime.toFixed(SHUTTER_DECIMALS))}s`;
  return `1/${Math.round(1 / exposureTime)}s`;
}

export function getExifTexts(exif: ExifData): Record<CaptionField, string> {
  const lensMake = exif.lensMake?.trim() ?? "";
  const lensModel = exif.lensModel?.trim() ?? "";
  const fullLensName = lensModel.toLowerCase().startsWith(lensMake.toLowerCase())
    ? lensModel
    : [lensMake, lensModel].filter(Boolean).join(" ");
  return {
    make: exif.make ?? "",
    model: exif.model ?? "",
    lens: fullLensName,
    aperture: formatAperture(exif.fNumber),
    shutter: formatShutter(exif.exposureTime),
  };
}

export function hasMissingCaptionFields(exif: ExifData, profile: CaptionOverrides): boolean {
  const exifTexts = getExifTexts(exif);
  return CAPTION_FIELDS.some((field) => !exifTexts[field].trim() && Boolean(profile[field]?.trim()));
}

export function getCaptionTexts(exif: ExifData, overrides: CaptionOverrides): Record<CaptionField, string> {
  const texts = getExifTexts(exif);
  return {
    make: overrides.make?.trim() || texts.make,
    model: overrides.model?.trim() || texts.model,
    lens: overrides.lens?.trim() || texts.lens,
    aperture: overrides.aperture?.trim() || texts.aperture,
    shutter: overrides.shutter?.trim() || texts.shutter,
  };
}

export interface CaptionLines {
  brand: string;
  model: string;
  details: string;
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter(Boolean).join(separator);
}

// Title is the camera name; details are the exposure values shown smaller below it.
export function buildCaptionLines(
  exif: ExifData,
  selection: CaptionSelection,
  overrides: CaptionOverrides,
): CaptionLines {
  const texts = getCaptionTexts(exif, overrides);
  const make = selection.make ? texts.make : "";
  let model = selection.model ? texts.model : "";
  if (make && model.toLowerCase().startsWith(make.toLowerCase())) {
    model = model.slice(make.length).replace(/^[\s\-_]+/, "");
  }
  return {
    brand: make,
    model,
    details: joinNonEmpty(
      [selection.lens ? texts.lens : "", selection.aperture ? texts.aperture : "", selection.shutter ? texts.shutter : ""],
      DETAILS_SEPARATOR,
    ),
  };
}
