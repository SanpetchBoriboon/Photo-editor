"use client";

import { useState } from "react";
import { Alert } from "@heroui/react";
import { MAX_PHOTOS } from "@/lib/constants";
import { createPhotoEntry, validateImageFile } from "@/lib/photoIO";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadButton } from "./UploadButton";

interface PhotoUploadProps {
  currentCount: number;
  onAdd: (entries: PhotoEntry[]) => void;
}

export function PhotoUpload({ currentCount, onAdd }: PhotoUploadProps) {
  const { t } = useLanguage();
  const [problems, setProblems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFiles(files: File[]): Promise<void> {
    setIsLoading(true);
    const found: string[] = [];
    const entries: PhotoEntry[] = [];
    const capacity = MAX_PHOTOS - currentCount;
    if (files.length > capacity) found.push(t("tooManyPhotos"));
    // Sequential on purpose: decoding many large images at once exhausts memory.
    for (const file of files.slice(0, Math.max(capacity, 0))) {
      const reason = validateImageFile(file);
      if (reason) {
        found.push(`${file.name}: ${t(reason)}`);
        continue;
      }
      try {
        entries.push(await createPhotoEntry(file));
      } catch {
        found.push(`${file.name}: ${t("cannotOpen")}`);
      }
    }
    onAdd(entries);
    setProblems(found);
    setIsLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <UploadButton
        multiple
        label={isLoading ? t("loading") : t("upload")}
        isDisabled={isLoading || currentCount >= MAX_PHOTOS}
        onFiles={handleFiles}
      />
      {problems.length > 0 && (
        <Alert color="danger" title={t("uploadProblems")} description={problems.join(" • ")} />
      )}
    </div>
  );
}
