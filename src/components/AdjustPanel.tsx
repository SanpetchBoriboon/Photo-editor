"use client";

import { Button } from "@heroui/react";
import { ADJUSTMENT_CONTROLS, ADJUSTMENT_RANGE, DEFAULT_ADJUSTMENTS, EXPOSURE_RANGE } from "@/lib/constants";
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
const EXPOSURE_FORMAT_OPTIONS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const ADJUSTMENT_FORMAT_OPTIONS: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

interface AdjustPanelProps {
  adjustments: Adjustments;
  onChange: (adjustments: Adjustments) => void;
  onInteractionStart: (key: AdjustmentKey) => void;
  onInteractionEnd: () => void;
}

export function AdjustPanel({ adjustments, onChange, onInteractionStart, onInteractionEnd }: AdjustPanelProps) {
  const { t } = useLanguage();
  function update(key: AdjustmentKey, value: number): void {
    onChange({ ...adjustments, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm text-default-500">{t("adjustmentsForPhoto")}</h2>
      {ADJUSTMENT_CONTROLS.map(({ key }) => {
        const isExposure = key === "exposure";
        return (
          <Slider
            key={key}
            label={t(ADJUSTMENT_LABELS[key])}
            value={adjustments[key]}
            min={isExposure ? EXPOSURE_RANGE.min : ADJUSTMENT_RANGE.min}
            max={isExposure ? EXPOSURE_RANGE.max : ADJUSTMENT_RANGE.max}
            step={isExposure ? EXPOSURE_RANGE.step : ADJUSTMENT_RANGE.step}
            formatOptions={isExposure ? EXPOSURE_FORMAT_OPTIONS : ADJUSTMENT_FORMAT_OPTIONS}
            onChange={(value) => {
              onInteractionStart(key);
              update(key, value);
            }}
            onChangeEnd={onInteractionEnd}
          />
        );
      })}
      <Button size="sm" variant="light" className="self-start" onPress={() => onChange(DEFAULT_ADJUSTMENTS)}>
        {t("resetAdjustments")}
      </Button>
    </div>
  );
}
