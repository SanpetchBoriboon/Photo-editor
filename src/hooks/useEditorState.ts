"use client";

import { useState } from "react";
import { DEFAULT_EDIT, DEFAULT_SHARED, FREE_ASPECT_ID, FULL_CROP, DEFAULT_ORIENTATION } from "@/lib/constants";
import { adjustCropForStraighten, fitCropToAspect, resolveLockedAspect } from "@/lib/cropMath";
import type {
  Adjustments,
  BorderSettings,
  CaptionSelection,
  CreditSettings,
  CropRect,
  PhotoEdit,
  PhotoEntry,
  Rotation,
  SharedSettings,
} from "@/lib/types";

const FULL_TURN_DEGREES = 360;
const QUARTER_TURN_DEGREES = 90;

export function useEditorState() {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedSettings>(DEFAULT_SHARED);

  const activeEntry = photos.find((photo) => photo.id === activeId) ?? null;

  function addPhotos(entries: PhotoEntry[]): void {
    if (entries.length === 0) return;
    setPhotos((previous) => [...previous, ...entries]);
    setActiveId((current) => current ?? entries[0].id);
  }

  function removePhoto(id: string): void {
    const index = photos.findIndex((photo) => photo.id === id);
    const neighbor = photos[index + 1] ?? photos[index - 1];
    setPhotos((previous) => previous.filter((photo) => photo.id !== id));
    setActiveId((current) => (current === id ? (neighbor?.id ?? null) : current));
  }

  function updateActiveEdit(change: (edit: PhotoEdit) => Partial<PhotoEdit>): void {
    setPhotos((previous) =>
      previous.map((photo) => (photo.id === activeId ? { ...photo, edit: { ...photo.edit, ...change(photo.edit) } } : photo)),
    );
  }

  function rotate(quarterTurns: number): void {
    updateActiveEdit((edit) => {
      const degrees = edit.orientation.rotation + quarterTurns * QUARTER_TURN_DEGREES;
      const rotation = (((degrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES) as Rotation;
      return { orientation: { ...edit.orientation, rotation }, crop: FULL_CROP, aspectId: FREE_ASPECT_ID };
    });
  }

  function flip(): void {
    updateActiveEdit((edit) => ({
      orientation: { ...edit.orientation, flipHorizontal: !edit.orientation.flipHorizontal },
      crop: FULL_CROP,
      aspectId: FREE_ASPECT_ID,
    }));
  }

  function selectAspect(id: string, imageWidth: number, imageHeight: number): void {
    const aspect = resolveLockedAspect(id, imageWidth, imageHeight);
    updateActiveEdit(() => (aspect === null ? { aspectId: id } : { aspectId: id, crop: fitCropToAspect(aspect) }));
  }

  return {
    photos,
    activeEntry,
    shared,
    addPhotos,
    removePhoto,
    selectPhoto: setActiveId,
    rotate,
    flip,
    setStraighten: (straighten: number, imageWidth: number, imageHeight: number) =>
      updateActiveEdit((edit) => ({
        orientation: { ...edit.orientation, straighten },
        crop: adjustCropForStraighten(edit.crop, imageWidth, imageHeight, edit.orientation.straighten, straighten),
      })),
    selectAspect,
    resetGeometry: () =>
      updateActiveEdit(() => ({ orientation: DEFAULT_ORIENTATION, crop: FULL_CROP, aspectId: DEFAULT_EDIT.aspectId })),
    setCrop: (crop: CropRect) => updateActiveEdit(() => ({ crop })),
    setAdjustments: (adjustments: Adjustments) => updateActiveEdit(() => ({ adjustments })),
    setBorder: (border: BorderSettings) => setShared((previous) => ({ ...previous, border })),
    setCaption: (caption: CaptionSelection) => setShared((previous) => ({ ...previous, caption })),
    setCredit: (credit: CreditSettings) => setShared((previous) => ({ ...previous, credit })),
  };
}
