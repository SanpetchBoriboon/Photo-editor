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
  return {
    make: exif.make ?? "",
    model: exif.model ?? "",
    aperture: formatAperture(exif.fNumber),
    shutter: formatShutter(exif.exposureTime),
  };
}

export interface CaptionLines {
  title: string;
  details: string;
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter(Boolean).join(separator);
}

// Title is the camera name; details are the exposure values shown smaller below it.
export function buildCaptionLines(exif: ExifData, selection: CaptionSelection): CaptionLines {
  const texts = getExifTexts(exif);
  const make = selection.make ? texts.make : "";
  const model = selection.model ? texts.model : "";
  // Many models already start with the brand ("Canon EOS R5"), so skip the duplicate.
  const modelHasMake = make !== "" && model.toLowerCase().startsWith(make.toLowerCase());
  return {
    title: joinNonEmpty([modelHasMake ? "" : make, model], " "),
    details: joinNonEmpty(
      [selection.aperture ? texts.aperture : "", selection.shutter ? texts.shutter : ""],
      DETAILS_SEPARATOR,
    ),
  };
}
