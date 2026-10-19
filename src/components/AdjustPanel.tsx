"use client";

import { Button } from "@heroui/react";
import { ADJUSTMENT_CONTROLS, ADJUSTMENT_RANGE, DEFAULT_ADJUSTMENTS } from "@/lib/constants";
import type { AdjustmentKey, Adjustments } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
import { useLanguage } from "./Providers";
import { Slider } from "./Slider";

const ADJUSTMENT_LABELS: Record<AdjustmentKey, MessageKey> = {
  exposure: "exposure",
  contrast: "contrast",
  highlights: "highlights",
  shadows: "shadows",
  temperature: "temperature",
  tint: "tint",
  saturation: "saturation",
  vibrance: "vibrance",
};

interface AdjustPanelProps {
  adjustments: Adjustments;
  onChange: (adjustments: Adjustments) => void;
}

export function AdjustPanel({ adjustments, onChange }: AdjustPanelProps) {
  const { t } = useLanguage();
  function update(key: AdjustmentKey, value: number): void {
    onChange({ ...adjustments, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm text-default-500">{t("adjustmentsForPhoto")}</h2>
      {ADJUSTMENT_CONTROLS.map(({ key }) => (
        <Slider
          key={key}
          label={t(ADJUSTMENT_LABELS[key])}
          value={adjustments[key]}
          min={ADJUSTMENT_RANGE.min}
          max={ADJUSTMENT_RANGE.max}
          onChange={(value) => update(key, value)}
        />
      ))}
      <Button size="sm" variant="light" className="self-start" onPress={() => onChange(DEFAULT_ADJUSTMENTS)}>
        {t("resetAdjustments")}
      </Button>
    </div>
  );
}
