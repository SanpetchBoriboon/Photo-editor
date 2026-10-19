"use client";

import { useState } from "react";
import { Alert, Checkbox, Input, Radio, RadioGroup } from "@heroui/react";
import { CREDIT_TEXT_MAX_LENGTH } from "@/lib/constants";
import { getExifTexts } from "@/lib/caption";
import { decodeImage, validateImageFile } from "@/lib/photoIO";
import type { CaptionField, CaptionSelection, CreditMode, CreditSettings, ExifData } from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadButton } from "./UploadButton";

const CAPTION_FIELDS: readonly CaptionField[] = ["make", "model", "aperture", "shutter"];
interface InfoPanelProps {
  exif: ExifData;
  caption: CaptionSelection;
  credit: CreditSettings;
  onCaptionChange: (caption: CaptionSelection) => void;
  onCreditChange: (credit: CreditSettings) => void;
}

export function InfoPanel({ exif, caption, credit, onCaptionChange, onCreditChange }: InfoPanelProps) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const texts = getExifTexts(exif);
  const fieldLabels: Record<CaptionField, string> = {
    make: t("make"),
    model: t("model"),
    aperture: t("aperture"),
    shutter: t("shutter"),
  };
  const creditModes: readonly { value: CreditMode; label: string }[] = [
    { value: "off", label: t("off") },
    { value: "text", label: t("text") },
    { value: "image", label: t("logo") },
  ];

  async function handleCreditImage(files: File[]): Promise<void> {
    const [file] = files;
    const validationError = validateImageFile(file);
    setError(validationError ? t(validationError) : "");
    if (validationError) return;
    try {
      onCreditChange({ ...credit, mode: "image", image: await decodeImage(file) });
    } catch {
      setError(t("cannotOpenCredit"));
    }
  }

  function handleModeChange(value: string): void {
    const mode = creditModes.find((item) => item.value === value)?.value;
    if (mode) onCreditChange({ ...credit, mode });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">{t("cameraInfoForPhoto")}</h2>
      <div className="flex flex-col gap-2">
        {CAPTION_FIELDS.map((field) => (
          <Checkbox
            key={field}
            isDisabled={!texts[field]}
            isSelected={caption[field]}
            onValueChange={(checked) => onCaptionChange({ ...caption, [field]: checked })}
          >
            {fieldLabels[field]}
            <span className="ml-2 text-xs text-default-500">{texts[field] || t("noExif")}</span>
          </Checkbox>
        ))}
      </div>
      <h2 className="text-sm text-default-500">{t("creditForAll")}</h2>
      <RadioGroup orientation="horizontal" aria-label={t("creditMode")} value={credit.mode} onValueChange={handleModeChange}>
        {creditModes.map((mode) => (
          <Radio key={mode.value} value={mode.value}>
            {mode.label}
          </Radio>
        ))}
      </RadioGroup>
      <Input
        size="sm"
        label={t("creditText")}
        placeholder={t("creditPlaceholder")}
        maxLength={CREDIT_TEXT_MAX_LENGTH}
        value={credit.text}
        onValueChange={(text) => onCreditChange({ ...credit, mode: "text", text })}
      />
      <UploadButton label={t("uploadCredit")} onFiles={handleCreditImage} />
      {error && <Alert color="danger" title={error} />}
    </div>
  );
}
