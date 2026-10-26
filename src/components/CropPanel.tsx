"use client";

import { Button, Tooltip } from "@heroui/react";
import type { KeyboardEvent } from "react";
import {
  ASPECT_PRESETS,
  STRAIGHTEN_DISPLAY_DECIMALS,
  STRAIGHTEN_MAX_DEGREES,
  STRAIGHTEN_MIN_DEGREES,
  STRAIGHTEN_STEP_DEGREES,
} from "@/lib/constants";
import { useLanguage } from "./Providers";
import { FlipIcon, RotateLeftIcon, RotateRightIcon } from "./icons";
import { Slider } from "./Slider";

interface CropPanelProps {
  aspectId: string;
  straighten: number;
  hasPendingStraighten: boolean;
  onPreviewStraighten: (degrees: number) => void;
  onCommitStraighten: () => void;
  onCancelStraighten: () => void;
  onSelectAspect: (id: string) => void;
  onRotate: (quarterTurns: number) => void;
  onFlip: () => void;
  onReset: () => void;
}

export function CropPanel({
  aspectId,
  straighten,
  hasPendingStraighten,
  onPreviewStraighten,
  onCommitStraighten,
  onCancelStraighten,
  onSelectAspect,
  onRotate,
  onFlip,
  onReset,
}: CropPanelProps) {
  const { t } = useLanguage();
  const aspectLabel = (id: string, label: string, ratio: number | "original" | null) => {
    if (id === "free") return t("free");
    if (id === "original") return t("original");
    if (ratio === 1 || typeof ratio !== "number") return label;
    return `${label} · ${t(ratio > 1 ? "landscape" : "portrait")}`;
  };

  function handleStraightenKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!hasPendingStraighten) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitStraighten();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancelStraighten();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">{t("aspectRatio")}</h2>
      <div className="flex flex-wrap gap-2">
        {ASPECT_PRESETS.filter((preset) => preset.category !== "social").map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            radius="full"
            color={preset.id === aspectId ? "primary" : "default"}
            variant={preset.id === aspectId ? "solid" : "flat"}
            onPress={() => onSelectAspect(preset.id)}
          >
            {aspectLabel(preset.id, preset.label, preset.ratio)}
          </Button>
        ))}
      </div>
      <h3 className="text-sm text-default-500">{t("socialMediaRatios")}</h3>
      <div className="flex flex-wrap gap-2">
        {ASPECT_PRESETS.filter((preset) => preset.category === "social").map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            radius="full"
            color={preset.id === aspectId ? "primary" : "default"}
            variant={preset.id === aspectId ? "solid" : "flat"}
            onPress={() => onSelectAspect(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-default-500">{t("cropHint")}</p>
      <div onKeyDownCapture={handleStraightenKeyDown}>
        <Slider
          label={`${t("straighten")} (${straighten.toFixed(STRAIGHTEN_DISPLAY_DECIMALS)}°)`}
          value={straighten}
          min={STRAIGHTEN_MIN_DEGREES}
          max={STRAIGHTEN_MAX_DEGREES}
          step={STRAIGHTEN_STEP_DEGREES}
          onChange={onPreviewStraighten}
        />
        {hasPendingStraighten && <p className="mt-1 text-xs text-default-500">{t("pressEnterToApply")}</p>}
      </div>
      <h2 className="text-sm text-default-500">{t("rotateFlip")}</h2>
      <div className="flex gap-2">
        <Tooltip content={t("rotateLeft")}>
          <Button isIconOnly variant="flat" aria-label={t("rotateLeft")} onPress={() => onRotate(-1)}>
            <RotateLeftIcon />
          </Button>
        </Tooltip>
        <Tooltip content={t("rotateRight")}>
          <Button isIconOnly variant="flat" aria-label={t("rotateRight")} onPress={() => onRotate(1)}>
            <RotateRightIcon />
          </Button>
        </Tooltip>
        <Tooltip content={t("flipHorizontal")}>
          <Button isIconOnly variant="flat" aria-label={t("flipHorizontal")} onPress={onFlip}>
            <FlipIcon />
          </Button>
        </Tooltip>
        <Button variant="light" onPress={onReset}>
          {t("resetCrop")}
        </Button>
      </div>
    </div>
  );
}
