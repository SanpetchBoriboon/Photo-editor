"use client";

import { Slider as HeroSlider } from "@heroui/react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, onChange }: SliderProps) {
  return (
    <HeroSlider
      size="sm"
      label={label}
      minValue={min}
      maxValue={max}
      step={1}
      value={value}
      onChange={(next) => {
        if (typeof next === "number") onChange(next);
      }}
    />
  );
}
