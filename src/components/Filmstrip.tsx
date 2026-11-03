import { useEffect, useRef } from "react";
import { Button, Image } from "@heroui/react";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { CloseIcon } from "./icons";

interface FilmstripProps {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function Filmstrip({ photos, activeId, onSelect, onRemove }: FilmstripProps) {
  const { t } = useLanguage();
  const activePhotoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activePhotoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeId]);

  return (
    <div className="filmstrip">
      {photos.map((photo) => (
        <div key={photo.id} className="filmstrip-item" data-active={photo.id === activeId}>
          <button
            ref={photo.id === activeId ? activePhotoRef : undefined}
            type="button"
            aria-label={`${t("selectedPhoto")} ${photo.fileName}`}
            aria-pressed={photo.id === activeId}
            onClick={() => onSelect(photo.id)}
            className="filmstrip-photo"
          >
            <Image
              removeWrapper
              radius="none"
              src={photo.thumbnailUrl}
              alt={photo.fileName}
              className="filmstrip-image"
            />
          </button>
          <Button
            isIconOnly
            size="sm"
            radius="full"
            aria-label={`${t("removePhoto")} ${photo.fileName}`}
            className="filmstrip-remove"
            onPress={() => onRemove(photo.id)}
          >
            <CloseIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}
