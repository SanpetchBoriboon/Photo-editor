"use client";

import { useState } from "react";
import type { PointerEvent } from "react";
import { moveCrop, resizeCrop } from "@/lib/cropMath";
import type { CropHandle, CropRect } from "@/lib/types";
import { useCanvasMirror } from "@/hooks/useCanvasMirror";

const CORNER_HANDLES: readonly CropHandle[] = ["nw", "ne", "sw", "se"];
const EDGE_HANDLES: readonly CropHandle[] = ["n", "s", "e", "w"];
const PERCENT = 100;

interface DragState {
  handle: CropHandle | "move";
  startX: number;
  startY: number;
  startCrop: CropRect;
}

interface CropToolProps {
  source: HTMLCanvasElement;
  crop: CropRect;
  // Normalized width / height lock, or null for free cropping.
  aspect: number | null;
  onChange: (crop: CropRect) => void;
}

function handleStyle(handle: CropHandle, crop: CropRect) {
  const horizontal = handle.includes("w") ? 0 : handle.includes("e") ? crop.width : crop.width / 2;
  const vertical = handle.includes("n") ? 0 : handle.includes("s") ? crop.height : crop.height / 2;
  return { left: `${(crop.x + horizontal) * PERCENT}%`, top: `${(crop.y + vertical) * PERCENT}%` };
}

export function CropTool({ source, crop, aspect, onChange }: CropToolProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useCanvasMirror(source);

  function beginDrag(handle: CropHandle | "move") {
    return (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ handle, startX: event.clientX, startY: event.clientY, startCrop: crop });
    };
  }

  // Both the crop box's parent and the handles' parent have exactly the image bounds.
  function continueDrag(event: PointerEvent<HTMLElement>): void {
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!drag || !bounds) return;
    const deltaX = (event.clientX - drag.startX) / bounds.width;
    const deltaY = (event.clientY - drag.startY) / bounds.height;
    onChange(
      drag.handle === "move"
        ? moveCrop(drag.startCrop, deltaX, deltaY)
        : resizeCrop(drag.startCrop, drag.handle, deltaX, deltaY, aspect),
    );
  }

  function dragProps(handle: CropHandle | "move") {
    return {
      onPointerDown: beginDrag(handle),
      onPointerMove: continueDrag,
      onPointerUp: () => setDrag(null),
      onPointerCancel: () => setDrag(null),
    };
  }

  const visibleHandles = aspect === null ? [...CORNER_HANDLES, ...EDGE_HANDLES] : CORNER_HANDLES;

  return (
    <div className="crop-stage">
      <div className="crop-clip">
        <canvas ref={canvasRef} className="crop-canvas" />
        <div
          className="crop-box"
          style={{
            left: `${crop.x * PERCENT}%`,
            top: `${crop.y * PERCENT}%`,
            width: `${crop.width * PERCENT}%`,
            height: `${crop.height * PERCENT}%`,
          }}
          {...dragProps("move")}
        />
      </div>
      {visibleHandles.map((handle) => (
        <div
          key={handle}
          className={`crop-handle crop-handle-${handle}`}
          style={handleStyle(handle, crop)}
          {...dragProps(handle)}
        />
      ))}
    </div>
  );
}
