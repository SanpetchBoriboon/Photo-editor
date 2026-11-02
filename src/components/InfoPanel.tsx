"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Input, Radio, RadioGroup } from "@heroui/react";
import { CREDIT_TEXT_MAX_LENGTH } from "@/lib/constants";
import { CAPTION_FIELDS, getCaptionTexts, getExifTexts } from "@/lib/caption";
import { findLensSuggestion, getLensBrands } from "@/lib/lensCatalog";
import { decodeImage, validateImageFile } from "@/lib/photoIO";
import type {
  CaptionField,
  CaptionOverrides,
  CaptionSelection,
  CreditMode,
  CreditSettings,
  ExifData,
} from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadButton } from "./UploadButton";

interface InfoPanelProps {
  exif: ExifData;
  captionOverrides: CaptionOverrides;
  caption: CaptionSelection;
  credit: CreditSettings;
  hasPhotosWithoutProfile: boolean;
  onCaptionChange: (caption: CaptionSelection) => void;
  onCaptionOverrideChange: (field: CaptionField, value: string) => void;
  onApplyProfile: (profile: CaptionOverrides) => void;
  onCreditChange: (credit: CreditSettings) => void;
}

export function InfoPanel({
  exif,
  captionOverrides,
  caption,
  credit,
  hasPhotosWithoutProfile,
  onCaptionChange,
  onCaptionOverrideChange,
  onApplyProfile,
  onCreditChange,
}: InfoPanelProps) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const exifTexts = getExifTexts(exif);
  const texts = getCaptionTexts(exif, captionOverrides);
  const lensBrands = getLensBrands(texts.make);
  const selectedLens = findLensSuggestion(texts.make, captionOverrides.lens ?? "");
  const [selectedLensBrand, setSelectedLensBrand] = useState(selectedLens?.brand ?? "");
  const activeLensBrand = lensBrands.some(({ name }) => name === selectedLensBrand) ? selectedLensBrand : "";
  const fieldLabels: Record<CaptionField, string> = {
    make: t("make"),
    model: t("model"),
    lens: t("lens"),
    aperture: t("aperture"),
    shutter: t("shutter"),
    iso: t("iso"),
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
    if (mode) {
      setError("");
      onCreditChange({ ...credit, mode });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">{t("cameraInfoForPhoto")}</h2>
      <div className="flex flex-col gap-2">
        {CAPTION_FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Checkbox
              isDisabled={!texts[field]}
              isSelected={caption[field]}
              onValueChange={(checked) => onCaptionChange({ ...caption, [field]: checked })}
            >
              {fieldLabels[field]}
              <span className="ml-2 text-xs text-default-500">{texts[field] || t("noExif")}</span>
            </Checkbox>
            {!exifTexts[field] && (
              <>
                {field === "lens" && lensBrands.length > 0 && (
                  <>
                    <select
                      aria-label={t("lensBrand")}
                      className="h-9 rounded-medium border border-default-200 bg-content1 px-3 text-sm"
                      value={lensBrands.some(({ name }) => name === selectedLensBrand) ? selectedLensBrand : ""}
                      onChange={(event) => {
                        setSelectedLensBrand(event.target.value);
                        onCaptionOverrideChange("lens", "");
                      }}
                    >
                      <option value="">{t("chooseLensBrand")}</option>
                      {lensBrands.map(({ name }) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {activeLensBrand && (
                      <select
                        aria-label={t("lensModel")}
                        className="h-9 rounded-medium border border-default-200 bg-content1 px-3 text-sm"
                        value={selectedLens?.brand === activeLensBrand ? selectedLens.model : ""}
                        onChange={(event) =>
                          onCaptionOverrideChange(
                            "lens",
                            event.target.value ? `${activeLensBrand} ${event.target.value}` : "",
                          )
                        }
                      >
                        <option value="">{t("chooseLensModel")}</option>
                        {lensBrands
                          .find(({ name }) => name === activeLensBrand)
                          ?.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                )}
                <Input
                  size="sm"
                  label={fieldLabels[field]}
                  placeholder={t("enterManually")}
                  maxLength={80}
                  value={captionOverrides[field] ?? ""}
                  onValueChange={(value) => onCaptionOverrideChange(field, value)}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="flat"
        isDisabled={!hasPhotosWithoutProfile || !CAPTION_FIELDS.some((field) => texts[field].trim())}
        onPress={() => onApplyProfile(texts)}
      >
        {t("applyProfileToPhotosWithoutExif")}
      </Button>
      <h2 className="text-sm text-default-500">{t("creditForAll")}</h2>
      <RadioGroup
        orientation="horizontal"
        aria-label={t("creditMode")}
        value={credit.mode}
        onValueChange={handleModeChange}
      >
        {creditModes.map((mode) => (
          <Radio key={mode.value} value={mode.value}>
            {mode.label}
          </Radio>
        ))}
      </RadioGroup>
      {credit.mode === "text" && (
        <Input
          size="sm"
          label={t("creditText")}
          placeholder={t("creditPlaceholder")}
          maxLength={CREDIT_TEXT_MAX_LENGTH}
          value={credit.text}
          onValueChange={(text) => onCreditChange({ ...credit, mode: "text", text })}
        />
      )}
      {credit.mode === "image" && (
        <>
          <UploadButton label={t("uploadCredit")} onFiles={handleCreditImage} />
          {error && <Alert color="danger" title={error} />}
        </>
      )}
    </div>
  );
}
