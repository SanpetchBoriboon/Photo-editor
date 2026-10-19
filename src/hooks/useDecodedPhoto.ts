"use client";

import { useEffect, useState } from "react";
import { decodeImage } from "@/lib/photoIO";

interface DecodedState {
  file: File | null;
  bitmap: ImageBitmap | null;
  failed: boolean;
}

const IDLE: DecodedState = { file: null, bitmap: null, failed: false };

// Keeps only the active photo decoded; the bitmap is released when the file changes.
export function useDecodedPhoto(file: File | null): DecodedState {
  const [state, setState] = useState<DecodedState>(IDLE);

  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    let decoded: ImageBitmap | null = null;
    decodeImage(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        decoded = bitmap;
        setState({ file, bitmap, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ file, bitmap: null, failed: true });
      });
    return () => {
      cancelled = true;
      decoded?.close();
      // Drop the closed bitmap so switching back to the same file never reuses it.
      setState(IDLE);
    };
  }, [file]);

  return state.file === file ? state : IDLE;
}
