"use client";

import { Button, Image } from "@heroui/react";
import type { PhotoEntry } from "@/lib/types";
import { CloseIcon } from "./icons";

interface FilmstripProps {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function Filmstrip({ photos, activeId, onSelect, onRemove }: FilmstripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto px-5 py-3">
      {photos.map((photo) => (
        <div key={photo.id} className="relative shrink-0">
          <button
            type="button"
            aria-label={`เลือกรูป ${photo.fileName}`}
            aria-pressed={photo.id === activeId}
            onClick={() => onSelect(photo.id)}
            className={`block cursor-pointer overflow-hidden rounded-lg border-2 ${
              photo.id === activeId ? "border-primary" : "border-transparent opacity-70"
            }`}
          >
            <Image removeWrapper radius="none" src={photo.thumbnailUrl} alt={photo.fileName} className="h-20 w-20 object-cover" />
          </button>
          <Button
            isIconOnly
            size="sm"
            radius="full"
            aria-label={`ลบรูป ${photo.fileName}`}
            className="absolute -right-2 -top-2 z-10 h-6 w-6 min-w-6"
            onPress={() => onRemove(photo.id)}
          >
            <CloseIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}
