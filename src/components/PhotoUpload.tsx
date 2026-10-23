"use client";

import { useState } from "react";
import { Alert } from "@heroui/react";
import { createPhotoEntry, validateImageFile } from "@/lib/photoIO";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadButton } from "./UploadButton";

interface PhotoUploadProps {
  onAdd: (entries: PhotoEntry[]) => void;
}

export function PhotoUpload({ onAdd }: PhotoUploadProps) {
  const { t } = useLanguage();
  const [problems, setProblems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: File[]): Promise<void> {
    setIsLoading(true);
    setImportProgress({ done: 0, total: files.length });
    const found: string[] = [];
    const entries: PhotoEntry[] = [];
    // Sequential on purpose: decoding many large images at once exhausts memory.
    for (const [index, file] of files.entries()) {
      const reason = validateImageFile(file);
      if (reason) {
        found.push(`${file.name}: ${t(reason)}`);
      } else {
        try {
          entries.push(await createPhotoEntry(file));
        } catch {
          found.push(`${file.name}: ${t("cannotOpen")}`);
        }
      }
      setImportProgress({ done: index + 1, total: files.length });
    }
    onAdd(entries);
    setProblems(found);
    setIsLoading(false);
    setImportProgress(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <UploadButton
        multiple
        label={isLoading ? t("loading") : t("upload")}
        isDisabled={isLoading}
        onFiles={handleFiles}
      />
      {isLoading && importProgress && (
        <p aria-live="polite" className="text-xs text-default-500">
          {t("importProgress")
            .replace("{done}", String(importProgress.done))
            .replace("{total}", String(importProgress.total))}
        </p>
      )}
      {problems.length > 0 && (
        <Alert color="danger" title={t("uploadProblems")} description={problems.join(" • ")} />
      )}
    </div>
  );
}
