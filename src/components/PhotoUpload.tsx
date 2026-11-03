"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Button, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { createPhotoEntry, validateImageFile } from "@/lib/photoIO";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadIcon } from "./icons";
import { UploadButton } from "./UploadButton";

interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  selected: boolean;
}

const SAMPLE_PHOTOS = [
  { src: "/workspace-mountain.jpg", fileName: "workspace-mountain.jpg", labelKey: "sampleMountain" },
  { src: "/workspace-lake.jpg", fileName: "workspace-lake.jpg", labelKey: "sampleLake" },
] as const;

interface PhotoUploadProps {
  onAdd: (entries: PhotoEntry[]) => void;
  prominent?: boolean;
  dropzone?: boolean;
}

export function PhotoUpload({ onAdd, prominent = false, dropzone = false }: PhotoUploadProps) {
  const { t } = useLanguage();
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const previewUrls = useRef<string[]>([]);
  const selectedCount = stagedPhotos.filter((photo) => photo.selected).length;

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function closeSelection(): void {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setStagedPhotos([]);
  }

  async function handleFiles(files: File[]): Promise<void> {
    const found: string[] = [];
    const staged: StagedPhoto[] = [];
    for (const file of files) {
      const reason = validateImageFile(file);
      if (reason) {
        found.push(`${file.name}: ${t(reason)}`);
      } else {
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.push(previewUrl);
        staged.push({ id: crypto.randomUUID(), file, previewUrl, selected: true });
      }
    }
    setStagedPhotos((current) => [...current, ...staged]);
    setProblems(found);
  }

  async function importSamplePhoto(sample: (typeof SAMPLE_PHOTOS)[number]): Promise<void> {
    setIsLoading(true);
    setProblems([]);
    try {
      const response = await fetch(sample.src);
      if (!response.ok) throw new Error("Sample image could not be loaded");
      const blob = await response.blob();
      const file = new File([blob], sample.fileName, { type: blob.type || "image/jpeg" });
      onAdd([await createPhotoEntry(file)]);
    } catch {
      setProblems([`${t(sample.labelKey)}: ${t("cannotOpen")}`]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!isLoading && event.dataTransfer.types.includes("Files")) setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) void handleFiles(Array.from(event.dataTransfer.files));
  }

  async function importSelectedPhotos(): Promise<void> {
    const selected = stagedPhotos.filter((photo) => photo.selected);
    if (selected.length === 0) return;

    setIsLoading(true);
    setImportProgress({ done: 0, total: selected.length });
    const found: string[] = [];
    const entries: PhotoEntry[] = [];
    // Sequential on purpose: decoding many large images at once exhausts memory.
    for (const [index, photo] of selected.entries()) {
      try {
        entries.push(await createPhotoEntry(photo.file));
      } catch {
        found.push(`${photo.file.name}: ${t("cannotOpen")}`);
      }
      setImportProgress({ done: index + 1, total: selected.length });
    }
    if (entries.length > 0) onAdd(entries);
    setProblems(found);
    closeSelection();
    setIsLoading(false);
    setImportProgress(null);
  }

  return (
    <div
      className={
        dropzone
          ? `photo-dropzone${isDragging ? " photo-dropzone-active" : ""}`
          : prominent
            ? "photo-upload-editor"
            : "flex flex-col gap-2"
      }
      role={dropzone ? "region" : undefined}
      aria-label={dropzone ? t("dropPhotosHere") : undefined}
      onDragOver={dropzone ? handleDragOver : undefined}
      onDragLeave={dropzone ? handleDragLeave : undefined}
      onDrop={dropzone ? handleDrop : undefined}
    >
      {dropzone && (
        <div className="photo-dropzone-prompt">
          <UploadIcon />
          <p>{t("dropPhotosHere")}</p>
          <span>{t("orSelectFromComputer")}</span>
        </div>
      )}
      <UploadButton
        multiple
        label={isLoading ? t("loading") : dropzone ? t("selectPhotoButton") : t("upload")}
        isDisabled={isLoading}
        isPrimary={prominent || dropzone}
        buttonClassName={dropzone ? "photo-dropzone-action" : prominent ? "editor-upload-primary" : undefined}
        onFiles={handleFiles}
      />
      {dropzone && (
        <div className="photo-samples">
          <div className="photo-sample-list">
            {SAMPLE_PHOTOS.map((sample) => (
              <Button
                key={sample.fileName}
                isIconOnly
                aria-label={t(sample.labelKey)}
                isDisabled={isLoading}
                onPress={() => void importSamplePhoto(sample)}
              >
                <Image removeWrapper radius="none" src={sample.src} alt="" />
              </Button>
            ))}
          </div>
          <p>{t("samplePhotosPrompt")}</p>
        </div>
      )}
      {isLoading && importProgress && (
        <p aria-live="polite" className="text-xs text-default-500">
          {t("importProgress")
            .replace("{done}", String(importProgress.done))
            .replace("{total}", String(importProgress.total))}
        </p>
      )}
      {problems.length > 0 && <Alert color="danger" title={t("uploadProblems")} description={problems.join(" • ")} />}
      <Modal
        isOpen={stagedPhotos.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isLoading) closeSelection();
        }}
        isDismissable={!isLoading}
        isKeyboardDismissDisabled={isLoading}
        scrollBehavior="inside"
        size="5xl"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="photo-import-header">
                <div>
                  <h2>{t("importSelection")}</h2>
                  <p>{t("selectedPhotos").replace("{count}", String(selectedCount))}</p>
                </div>
                <Button
                  variant="light"
                  onPress={() =>
                    setStagedPhotos((current) =>
                      current.map((photo) => ({ ...photo, selected: selectedCount !== current.length })),
                    )
                  }
                >
                  {selectedCount === stagedPhotos.length ? t("deselectAll") : t("selectAll")}
                </Button>
              </ModalHeader>
              <ModalBody className="photo-import-body">
                {problems.length > 0 && (
                  <Alert color="danger" title={t("uploadProblems")} description={problems.join(" • ")} />
                )}
                <div className="photo-import-grid">
                  {stagedPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className="photo-import-item"
                      aria-label={`${t("selectPhoto")} ${photo.file.name}`}
                      aria-pressed={photo.selected}
                      onClick={() =>
                        setStagedPhotos((current) =>
                          current.map((item) => (item.id === photo.id ? { ...item, selected: !item.selected } : item)),
                        )
                      }
                    >
                      <span className="photo-import-thumbnail">
                        <Image removeWrapper radius="none" src={photo.previewUrl} alt="" />
                        <span className="photo-import-check" aria-hidden="true">
                          {photo.selected ? "✓" : ""}
                        </span>
                      </span>
                      <span className="photo-import-filename" title={photo.file.name}>
                        {photo.file.name}
                      </span>
                    </button>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter className="photo-import-footer">
                <UploadButton label={t("addMorePhotos")} multiple isDisabled={isLoading} onFiles={handleFiles} />
                <div className="photo-import-footer-actions">
                  <Button
                    variant="flat"
                    isDisabled={isLoading}
                    onPress={() => {
                      closeSelection();
                      onClose();
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button isDisabled={isLoading || selectedCount === 0} onPress={importSelectedPhotos}>
                    {isLoading && importProgress
                      ? `${t("importProgress").replace("{done}", String(importProgress.done)).replace("{total}", String(importProgress.total))}`
                      : `${t("importSelected")} (${selectedCount})`}
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
