import type { CaptionField, CaptionSelection, ExifData } from "./types";

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

export interface CaptionLines {
  brand: string;
  model: string;
  details: string;
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter(Boolean).join(separator);
}

// Title is the camera name; details are the exposure values shown smaller below it.
export function buildCaptionLines(exif: ExifData, selection: CaptionSelection): CaptionLines {
  const texts = getExifTexts(exif);
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
