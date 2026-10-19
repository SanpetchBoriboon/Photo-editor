"use client";

import { Button, Switch } from "@heroui/react";
import { BORDER_PERCENT_MAX, BORDER_PERCENT_MIN, DEFAULT_BORDER } from "@/lib/constants";
import type { BorderSettings } from "@/lib/types";
import { useLanguage } from "./Providers";
import { Slider } from "./Slider";

interface BorderPanelProps {
  border: BorderSettings;
  onChange: (border: BorderSettings) => void;
}

export function BorderPanel({ border, onChange }: BorderPanelProps) {
  const { t } = useLanguage();
  const colorPresets = [
    { label: t("white"), value: "#ffffff" },
    { label: t("black"), value: "#000000" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">{t("borderForAll")}</h2>
      <Switch isSelected={border.enabled} onValueChange={(enabled) => onChange({ ...border, enabled })}>
        {t("addBorder")}
      </Switch>
      <Slider
        label={t("borderSize")}
        value={border.percent}
        min={BORDER_PERCENT_MIN}
        max={BORDER_PERCENT_MAX}
        onChange={(percent) => onChange({ ...border, percent })}
      />
      <div className="flex items-center gap-2">
        <label htmlFor="border-color" className="text-sm">
          {t("borderColor")}
        </label>
        <input
          id="border-color"
          type="color"
          value={border.color}
          className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0"
          onChange={(event) => onChange({ ...border, color: event.target.value })}
        />
        {colorPresets.map((preset) => (
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
        {t("defaultBorder")}
      </Button>
      <p className="text-xs text-default-500">{t("borderHint")}</p>
    </div>
  );
}
