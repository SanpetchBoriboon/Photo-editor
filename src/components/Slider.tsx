"use client";

import { Slider as HeroSlider } from "@heroui/react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
}

export function Slider({ label, value, min, max, step = 1, onChange, onChangeEnd }: SliderProps) {
  return (
    <HeroSlider
      size="sm"
      label={label}
      minValue={min}
      maxValue={max}
      step={step}
      value={value}
      onChange={(next) => {
        if (typeof next === "number") onChange(next);
      }}
      onChangeEnd={onChangeEnd}
    />
  );
}
