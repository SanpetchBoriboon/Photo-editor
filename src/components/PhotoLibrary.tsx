import { Button, Image } from "@heroui/react";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { PhotoUpload } from "./PhotoUpload";

interface PhotoLibraryProps {
  photos: PhotoEntry[];
  activeId: string | null;
  onAdd: (entries: PhotoEntry[]) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function PhotoLibrary({ photos, activeId, onAdd, onSelect, onClose }: PhotoLibraryProps) {
  const { t } = useLanguage();

  return (
    <div className="editor-library">
      <header className="editor-library-header">
        <div className="editor-library-heading">
          <h2>{t("photoLibrary")}</h2>
          <span>
            {photos.length} {t("photosUnit")}
          </span>
        </div>
        <div className="editor-library-actions">
          <PhotoUpload onAdd={onAdd} />
          <Button variant="flat" onPress={onClose}>
            {t("backToEditor")}
          </Button>
        </div>
      </header>
      <div className="editor-library-grid">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="editor-library-item"
            aria-label={`${t("selectPhoto")} ${photo.fileName}`}
            aria-pressed={photo.id === activeId}
            onClick={() => onSelect(photo.id)}
          >
            <span className="editor-library-thumbnail">
              <Image removeWrapper radius="none" src={photo.thumbnailUrl} alt="" />
              <span className="editor-library-index">{index + 1}</span>
              {photo.id === activeId && (
                <span className="editor-library-selected-mark" aria-hidden="true">
                  ✓
                </span>
              )}
            </span>
            <span className="editor-library-filename" title={photo.fileName}>
              {photo.fileName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
