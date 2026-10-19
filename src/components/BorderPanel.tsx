"use client";

import { Button, Switch } from "@heroui/react";
import { BORDER_PERCENT_MAX, BORDER_PERCENT_MIN, DEFAULT_BORDER } from "@/lib/constants";
import type { BorderSettings } from "@/lib/types";
import { Slider } from "./Slider";

const COLOR_PRESETS = [
  { label: "ขาว", value: "#ffffff" },
  { label: "ดำ", value: "#000000" },
] as const;

interface BorderPanelProps {
  border: BorderSettings;
  onChange: (border: BorderSettings) => void;
}

export function BorderPanel({ border, onChange }: BorderPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">ขอบรูป (ใช้กับทุกรูป)</h2>
      <Switch isSelected={border.enabled} onValueChange={(enabled) => onChange({ ...border, enabled })}>
        ใส่ขอบ
      </Switch>
      <Slider
        label="ขนาดขอบ (% ของด้านสั้นของรูป)"
        value={border.percent}
        min={BORDER_PERCENT_MIN}
        max={BORDER_PERCENT_MAX}
        onChange={(percent) => onChange({ ...border, percent })}
      />
      <div className="flex items-center gap-2">
        <label htmlFor="border-color" className="text-sm">
          สีขอบ
        </label>
        <input
          id="border-color"
          type="color"
          value={border.color}
          className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0"
          onChange={(event) => onChange({ ...border, color: event.target.value })}
        />
        {COLOR_PRESETS.map((preset) => (
          <Button
            key={preset.value}
            size="sm"
            radius="full"
            variant="flat"
            onPress={() => onChange({ ...border, color: preset.value })}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Button size="sm" variant="light" className="self-start" onPress={() => onChange(DEFAULT_BORDER)}>
        ค่าเริ่มต้น (ขาว 10%)
      </Button>
      <p className="text-xs text-default-500">ข้อมูลกล้องและเครดิตจะแสดงที่แถบขอบด้านล่าง ต้องเปิดใช้ขอบ</p>
    </div>
  );
}
