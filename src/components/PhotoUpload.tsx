"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { createPhotoEntry, validateImageFile } from "@/lib/photoIO";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { UploadButton } from "./UploadButton";

interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  selected: boolean;
}

interface PhotoUploadProps {
  onAdd: (entries: PhotoEntry[]) => void;
}

export function PhotoUpload({ onAdd }: PhotoUploadProps) {
  const { t } = useLanguage();
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
                  <Button color="primary" isDisabled={isLoading || selectedCount === 0} onPress={importSelectedPhotos}>
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
