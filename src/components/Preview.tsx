"use client";

import { useEffect, useRef } from "react";
import { renderEdit } from "@/lib/renderPipeline";
import type { CaptionOverrides, EditSettings, ExifData } from "@/lib/types";

interface PreviewProps {
  source: HTMLCanvasElement;
  settings: EditSettings;
  exif: ExifData;
  captionOverrides: CaptionOverrides;
}

export function Preview({ source, settings, exif, captionOverrides }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Rendering is deferred a frame so dragging sliders stays responsive.
  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return undefined;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void document.fonts.ready.then(() => {
        if (cancelled) return;
        const rendered = renderEdit(source, settings, exif, captionOverrides);
        target.width = rendered.width;
        target.height = rendered.height;
        target.getContext("2d")?.drawImage(rendered, 0, 0);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [source, settings, exif, captionOverrides]);

  return <canvas ref={canvasRef} className="preview-canvas" />;
}
