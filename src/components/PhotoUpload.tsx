"use client";

import { useState } from "react";
import { Alert } from "@heroui/react";
import { MAX_PHOTOS } from "@/lib/constants";
import { createPhotoEntry, validateImageFile } from "@/lib/photoIO";
import type { PhotoEntry } from "@/lib/types";
import { UploadButton } from "./UploadButton";

interface PhotoUploadProps {
  currentCount: number;
  onAdd: (entries: PhotoEntry[]) => void;
}

export function PhotoUpload({ currentCount, onAdd }: PhotoUploadProps) {
  const [problems, setProblems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFiles(files: File[]): Promise<void> {
    setIsLoading(true);
    const found: string[] = [];
    const entries: PhotoEntry[] = [];
    const capacity = MAX_PHOTOS - currentCount;
    if (files.length > capacity) found.push(`เพิ่มได้สูงสุด ${MAX_PHOTOS} รูป ข้ามไฟล์ที่เกิน`);
    // Sequential on purpose: decoding many large images at once exhausts memory.
    for (const file of files.slice(0, Math.max(capacity, 0))) {
      const reason = validateImageFile(file);
      if (reason) {
        found.push(`${file.name}: ${reason}`);
        continue;
      }
      try {
        entries.push(await createPhotoEntry(file));
      } catch {
        found.push(`${file.name}: ไม่สามารถเปิดรูปนี้ได้`);
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
        label={isLoading ? "กำลังโหลด..." : "เลือกรูปภาพ (เลือกได้หลายรูป)"}
        isDisabled={isLoading || currentCount >= MAX_PHOTOS}
        onFiles={handleFiles}
      />
      {problems.length > 0 && (
        <Alert color="danger" title="มีบางไฟล์ที่เพิ่มไม่ได้" description={problems.join(" • ")} />
      )}
    </div>
  );
}
