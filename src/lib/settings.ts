import type { EditSettings, PhotoEdit, SharedSettings } from "./types";

export function toEditSettings(edit: PhotoEdit, shared: SharedSettings): EditSettings {
  return {
    orientation: edit.orientation,
    crop: edit.crop,
    adjustments: edit.adjustments,
    ...shared,
  };
}
