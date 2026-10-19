"use client";

import { useState } from "react";
import { Alert, Checkbox, Input, Radio, RadioGroup } from "@heroui/react";
import { CAPTION_FIELD_LABELS, CREDIT_TEXT_MAX_LENGTH } from "@/lib/constants";
import { getExifTexts } from "@/lib/caption";
import { decodeImage, validateImageFile } from "@/lib/photoIO";
import type { CaptionField, CaptionSelection, CreditMode, CreditSettings, ExifData } from "@/lib/types";
import { UploadButton } from "./UploadButton";

const CAPTION_FIELDS = Object.keys(CAPTION_FIELD_LABELS) as CaptionField[];
const CREDIT_MODES: readonly { value: CreditMode; label: string }[] = [
  { value: "off", label: "ปิด" },
  { value: "text", label: "ข้อความ" },
  { value: "image", label: "โลโก้/รูปเครดิต" },
];

interface InfoPanelProps {
  exif: ExifData;
  caption: CaptionSelection;
  credit: CreditSettings;
  onCaptionChange: (caption: CaptionSelection) => void;
  onCreditChange: (credit: CreditSettings) => void;
}

export function InfoPanel({ exif, caption, credit, onCaptionChange, onCreditChange }: InfoPanelProps) {
  const [error, setError] = useState("");
  const texts = getExifTexts(exif);

  async function handleCreditImage(files: File[]): Promise<void> {
    const [file] = files;
    const validationError = validateImageFile(file);
    setError(validationError ?? "");
    if (validationError) return;
    try {
      onCreditChange({ ...credit, mode: "image", image: await decodeImage(file) });
    } catch {
      setError("ไม่สามารถเปิดรูปเครดิตนี้ได้");
    }
  }

  function handleModeChange(value: string): void {
    const mode = CREDIT_MODES.find((item) => item.value === value)?.value;
    if (mode) onCreditChange({ ...credit, mode });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-default-500">มุมซ้ายล่าง (ข้อมูลจากรูปที่เลือก)</h2>
      <div className="flex flex-col gap-2">
        {CAPTION_FIELDS.map((field) => (
          <Checkbox
            key={field}
            isDisabled={!texts[field]}
            isSelected={caption[field]}
            onValueChange={(checked) => onCaptionChange({ ...caption, [field]: checked })}
          >
            {CAPTION_FIELD_LABELS[field]}
            <span className="ml-2 text-xs text-default-500">{texts[field] || "ไม่พบข้อมูล"}</span>
          </Checkbox>
        ))}
      </div>
      <h2 className="text-sm text-default-500">มุมขวาล่าง (เครดิต ใช้กับทุกรูป)</h2>
      <RadioGroup orientation="horizontal" aria-label="รูปแบบเครดิต" value={credit.mode} onValueChange={handleModeChange}>
        {CREDIT_MODES.map((mode) => (
          <Radio key={mode.value} value={mode.value}>
            {mode.label}
          </Radio>
        ))}
      </RadioGroup>
      <Input
        size="sm"
        label="ข้อความเครดิต"
        placeholder="เช่น Photo by ชื่อคุณ"
        maxLength={CREDIT_TEXT_MAX_LENGTH}
        value={credit.text}
        onValueChange={(text) => onCreditChange({ ...credit, mode: "text", text })}
      />
      <UploadButton label="อัปโหลดโลโก้/รูปเครดิต" onFiles={handleCreditImage} />
      {error && <Alert color="danger" title={error} />}
    </div>
  );
}
