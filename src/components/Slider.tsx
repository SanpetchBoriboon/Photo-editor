"use client";

import { Slider as HeroSlider } from "@heroui/react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatOptions?: Intl.NumberFormatOptions;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
}

export function Slider({ label, value, min, max, step = 1, formatOptions, onChange, onChangeEnd }: SliderProps) {
  return (
    <HeroSlider
      size="sm"
      label={label}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      value={value}
      onChange={(next) => {
        if (typeof next === "number") onChange(next);
      }}
      onChangeEnd={onChangeEnd}
    />
  );
}
