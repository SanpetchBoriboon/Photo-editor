import type { ExifData } from "./types";

// Minimal JPEG EXIF reader (no dependencies) returning only the fields the app uses.
const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xffe1;
const SOS_MARKER = 0xffda;
const EXIF_HEADER = 0x45786966; // "Exif"
const EXIF_SEGMENT_HEADER_SIZE = 10; // marker + length + "Exif\0\0"
const LITTLE_ENDIAN_MARK = 0x4949;
const IFD_ENTRY_SIZE = 12;
const INLINE_VALUE_SIZE = 4;

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_EXPOSURE_TIME = 0x829a;
const TAG_F_NUMBER = 0x829d;

const TYPE_ASCII = 2;
const TYPE_RATIONAL = 5;
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };

interface IfdEntry {
  type: number;
  count: number;
  valueStart: number;
}

function findTiffStart(view: DataView): number {
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) return -1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if (marker === SOS_MARKER || (marker & 0xff00) !== 0xff00) return -1;
    if (marker === APP1_MARKER && view.getUint32(offset + 4) === EXIF_HEADER) {
      return offset + EXIF_SEGMENT_HEADER_SIZE;
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return -1;
}

function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  const ifdStart = tiffStart + ifdOffset;
  const entryCount = view.getUint16(ifdStart, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entryStart = ifdStart + 2 + index * IFD_ENTRY_SIZE;
    const type = view.getUint16(entryStart + 2, littleEndian);
    const count = view.getUint32(entryStart + 4, littleEndian);
    const byteLength = (TYPE_SIZES[type] ?? 1) * count;
    const valueStart =
      byteLength <= INLINE_VALUE_SIZE
        ? entryStart + 8
        : tiffStart + view.getUint32(entryStart + 8, littleEndian);
    entries.set(view.getUint16(entryStart, littleEndian), { type, count, valueStart });
  }
  return entries;
}

function decodeString(view: DataView, entry: IfdEntry): string | undefined {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + entry.valueStart, entry.count);
  return new TextDecoder("utf-8").decode(bytes).replace(/\0/g, "").trim() || undefined;
}

function decodeRational(view: DataView, entry: IfdEntry, littleEndian: boolean): number | undefined {
  const numerator = view.getUint32(entry.valueStart, littleEndian);
  const denominator = view.getUint32(entry.valueStart + 4, littleEndian);
  return denominator === 0 ? undefined : numerator / denominator;
}

function readString(view: DataView, entry: IfdEntry | undefined): string | undefined {
  return entry?.type === TYPE_ASCII ? decodeString(view, entry) : undefined;
}

function readNumber(view: DataView, entry: IfdEntry | undefined, littleEndian: boolean): number | undefined {
  return entry?.type === TYPE_RATIONAL ? decodeRational(view, entry, littleEndian) : undefined;
}

function parseExif(buffer: ArrayBuffer): ExifData {
  const view = new DataView(buffer);
  const tiffStart = findTiffStart(view);
  if (tiffStart < 0) return {};
  const littleEndian = view.getUint16(tiffStart) === LITTLE_ENDIAN_MARK;
  const mainIfd = readIfd(view, tiffStart, view.getUint32(tiffStart + 4, littleEndian), littleEndian);
  const pointer = mainIfd.get(TAG_EXIF_IFD_POINTER);
  const exifIfd = pointer
    ? readIfd(view, tiffStart, view.getUint32(pointer.valueStart, littleEndian), littleEndian)
    : new Map<number, IfdEntry>();
  return {
    make: readString(view, mainIfd.get(TAG_MAKE)),
    model: readString(view, mainIfd.get(TAG_MODEL)),
    exposureTime: readNumber(view, exifIfd.get(TAG_EXPOSURE_TIME), littleEndian),
    fNumber: readNumber(view, exifIfd.get(TAG_F_NUMBER), littleEndian),
  };
}

// Malformed metadata must never block editing, so fall back to "no EXIF".
export function readExif(buffer: ArrayBuffer): ExifData {
  try {
    return parseExif(buffer);
  } catch (error) {
    console.warn("Could not parse EXIF data:", error instanceof Error ? error.name : "unknown");
    return {};
  }
}
