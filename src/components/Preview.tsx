"use client";

import { useEffect, useRef } from "react";
import { renderEdit } from "@/lib/renderPipeline";
import type { EditSettings, ExifData } from "@/lib/types";

interface PreviewProps {
  source: HTMLCanvasElement;
  settings: EditSettings;
  exif: ExifData;
}

export function Preview({ source, settings, exif }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Rendering is deferred a frame so dragging sliders stays responsive.
  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return undefined;
    const frame = requestAnimationFrame(() => {
      const rendered = renderEdit(source, settings, exif);
      target.width = rendered.width;
      target.height = rendered.height;
      target.getContext("2d")?.drawImage(rendered, 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [source, settings, exif]);

  return <canvas ref={canvasRef} className="preview-canvas" />;
}
