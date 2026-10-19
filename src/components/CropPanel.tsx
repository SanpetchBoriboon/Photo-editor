"use client";

import { Button, Tooltip } from "@heroui/react";
import { ASPECT_PRESETS } from "@/lib/constants";
import { useLanguage } from "./Providers";
import { FlipIcon, RotateLeftIcon, RotateRightIcon } from "./icons";

interface CropPanelProps {
  aspectId: string;
  onSelectAspect: (id: string) => void;
  onRotate: (quarterTurns: number) => void;
  onFlip: () => void;
  onReset: () => void;
}

export function CropPanel({ aspectId, onSelectAspect, onRotate, onFlip, onReset }: CropPanelProps) {
  const { t } = useLanguage();
  const aspectLabel = (id: string, label: string) =>
    id === "free" ? t("free") : id === "original" ? t("original") : label;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">{t("aspectRatio")}</h2>
      <div className="flex flex-wrap gap-2">
        {ASPECT_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            radius="full"
            color={preset.id === aspectId ? "primary" : "default"}
            variant={preset.id === aspectId ? "solid" : "flat"}
            onPress={() => onSelectAspect(preset.id)}
          >
            {aspectLabel(preset.id, preset.label)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-default-500">{t("cropHint")}</p>
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
