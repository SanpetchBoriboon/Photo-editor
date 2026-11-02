"use client";

import { useEffect, useRef, useState } from "react";
import { prepareBrandLogos } from "@/lib/brandLogos";
import { renderEdit } from "@/lib/renderPipeline";
import type { CaptionOverrides, EditSettings, ExifData } from "@/lib/types";

interface PreviewProps {
  source: HTMLCanvasElement;
  settings: EditSettings;
  exif: ExifData;
  captionOverrides: CaptionOverrides;
  zoomScale: number | null;
}

export function Preview({ source, settings, exif, captionOverrides, zoomScale }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  // Rendering is deferred a frame so dragging sliders stays responsive.
  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return undefined;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void Promise.all([document.fonts.ready, prepareBrandLogos()]).then(async () => {
        if (cancelled) return;
        const rendered = await renderEdit(source, settings, exif, captionOverrides);
        if (cancelled) return;
        target.width = rendered.width;
        target.height = rendered.height;
        target.getContext("2d")?.drawImage(rendered, 0, 0);
        setRenderedSize({ width: rendered.width, height: rendered.height });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [source, settings, exif, captionOverrides]);

  const canvasStyle =
    zoomScale === null || renderedSize.width === 0
      ? undefined
      : {
          width: `${renderedSize.width * zoomScale}px`,
          height: `${renderedSize.height * zoomScale}px`,
          maxWidth: "none",
          maxHeight: "none",
        };

  return <canvas ref={canvasRef} className="preview-canvas" style={canvasStyle} />;
}
