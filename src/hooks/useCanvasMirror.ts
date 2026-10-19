"use client";

import { useEffect, useRef } from "react";

// Keeps a visible <canvas> in sync with an offscreen source canvas.
export function useCanvasMirror(source: HTMLCanvasElement) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return undefined;
    const frame = requestAnimationFrame(() => {
      target.width = source.width;
      target.height = source.height;
      target.getContext("2d")?.drawImage(source, 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [source]);

  return canvasRef;
}
