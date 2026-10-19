"use client";

import { Button } from "@heroui/react";
import { ADJUSTMENT_CONTROLS, ADJUSTMENT_RANGE, DEFAULT_ADJUSTMENTS } from "@/lib/constants";
import type { AdjustmentKey, Adjustments } from "@/lib/types";
import { Slider } from "./Slider";

interface AdjustPanelProps {
  adjustments: Adjustments;
  onChange: (adjustments: Adjustments) => void;
}

export function AdjustPanel({ adjustments, onChange }: AdjustPanelProps) {
  function update(key: AdjustmentKey, value: number): void {
    onChange({ ...adjustments, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm text-default-500">ปรับแต่งภาพ (เฉพาะรูปที่เลือก)</h2>
      {ADJUSTMENT_CONTROLS.map(({ key, label }) => (
        <Slider
          key={key}
          label={label}
          value={adjustments[key]}
          min={ADJUSTMENT_RANGE.min}
          max={ADJUSTMENT_RANGE.max}
          onChange={(value) => update(key, value)}
        />
      ))}
      <Button size="sm" variant="light" className="self-start" onPress={() => onChange(DEFAULT_ADJUSTMENTS)}>
        รีเซ็ตการปรับแต่ง
      </Button>
    </div>
  );
}
