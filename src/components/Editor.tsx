"use client";

import { useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, Spinner, Tab, Tabs } from "@heroui/react";
import { useDecodedPhoto } from "@/hooks/useDecodedPhoto";
import { useEditorState } from "@/hooks/useEditorState";
import { PREVIEW_MAX_EDGE } from "@/lib/constants";
import { resolveLockedAspect } from "@/lib/cropMath";
import { exportPhoto } from "@/lib/photoIO";
import { createOrientedCanvas } from "@/lib/renderPipeline";
import { toEditSettings } from "@/lib/settings";
import type { PhotoEntry } from "@/lib/types";
import { useLanguage } from "./Providers";
import { AdjustPanel } from "./AdjustPanel";
import { BorderPanel } from "./BorderPanel";
import { CropPanel } from "./CropPanel";
import { CropTool } from "./CropTool";
import { Filmstrip } from "./Filmstrip";
import { DownloadIcon } from "./icons";
import { InfoPanel } from "./InfoPanel";
import { PhotoUpload } from "./PhotoUpload";
import { Preview } from "./Preview";

type TabId = "crop" | "adjust" | "border" | "info";

const TAB_LABELS: Record<TabId, "crop" | "adjust" | "border" | "info"> = {
  crop: "crop",
  adjust: "adjust",
  border: "border",
  info: "info",
};

export function Editor() {
  const { language, setLanguage, t } = useLanguage();
  const editor = useEditorState();
  const { photos, activeEntry, shared } = editor;
  const [tab, setTab] = useState<TabId>("adjust");
  const [exportError, setExportError] = useState("");
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const decoded = useDecodedPhoto(activeEntry?.file ?? null);
  const orientation = activeEntry?.edit.orientation ?? null;
  const edit = activeEntry?.edit ?? null;

  const oriented = useMemo(
    () => (decoded.bitmap && orientation ? createOrientedCanvas(decoded.bitmap, orientation, PREVIEW_MAX_EDGE) : null),
    [decoded.bitmap, orientation],
  );
  const settings = useMemo(() => (edit ? toEditSettings(edit, shared) : null), [edit, shared]);

  async function handleExport(entries: PhotoEntry[]): Promise<void> {
    setExportError("");
    try {
      for (const [index, entry] of entries.entries()) {
        setExportProgress({ done: index, total: entries.length });
        await exportPhoto(entry, shared);
      }
    } catch {
      setExportError(t("exportError"));
    } finally {
      setExportProgress(null);
    }
  }

  function renderToolPanel(entry: PhotoEntry) {
    switch (tab) {
      case "crop":
        return (
          <CropPanel
            aspectId={entry.edit.aspectId}
            onSelectAspect={(id) => oriented && editor.selectAspect(id, oriented.width, oriented.height)}
            onRotate={editor.rotate}
            onFlip={editor.flip}
            onReset={editor.resetGeometry}
          />
        );
      case "adjust":
        return <AdjustPanel adjustments={entry.edit.adjustments} onChange={editor.setAdjustments} />;
      case "border":
        return <BorderPanel border={shared.border} onChange={editor.setBorder} />;
      case "info":
        return (
          <InfoPanel
            exif={entry.exif}
            caption={shared.caption}
            credit={shared.credit}
            onCaptionChange={editor.setCaption}
            onCreditChange={editor.setCredit}
          />
        );
    }
  }

  function renderStage() {
    if (!activeEntry) {
      return <p className="text-default-500">{t("startPrompt")}</p>;
    }
    if (decoded.failed) return <Alert color="danger" title={t("oversizedImage")} />;
    if (!oriented || !settings) return <Spinner aria-label={t("loadingPhoto")} />;
    if (tab === "crop") {
      const aspect = resolveLockedAspect(activeEntry.edit.aspectId, oriented.width, oriented.height);
      return <CropTool source={oriented} crop={activeEntry.edit.crop} aspect={aspect} onChange={editor.setCrop} />;
    }
    return <Preview source={oriented} settings={settings} exif={activeEntry.exif} />;
  }

  const isExporting = exportProgress !== null;

  return (
    <main className="grid h-screen grid-cols-1 md:grid-cols-[380px_1fr]">
      <aside className="flex flex-col gap-4 overflow-y-auto bg-content1 p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{t("appTitle")}</h1>
          <ButtonGroup size="sm" variant="flat" aria-label={t("language")}>
            {(["th", "en"] as const).map((option) => (
              <Button key={option} color={language === option ? "primary" : "default"} onPress={() => setLanguage(option)}>
                {option.toUpperCase()}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <PhotoUpload currentCount={photos.length} onAdd={editor.addPhotos} />
        {activeEntry && (
          <Tabs
            fullWidth
            aria-label={t("editTools")}
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (key === "crop" || key === "adjust" || key === "border" || key === "info") setTab(key);
            }}
          >
            {(Object.keys(TAB_LABELS) as TabId[]).map((id) => (
              <Tab key={id} title={t(TAB_LABELS[id])} />
            ))}
          </Tabs>
        )}
        {activeEntry && renderToolPanel(activeEntry)}
        <div className="mt-auto flex flex-col gap-2">
          <Button
            color="primary"
            isDisabled={!activeEntry || isExporting}
            startContent={<DownloadIcon />}
            onPress={() => activeEntry && handleExport([activeEntry])}
          >
            {t("downloadPhoto")}
          </Button>
          {photos.length > 1 && (
            <Button
              variant="bordered"
              isDisabled={isExporting}
              startContent={<DownloadIcon />}
              onPress={() => handleExport(photos)}
            >
              {exportProgress
                ? `${t("exporting")} ${exportProgress.done + 1}/${exportProgress.total}`
                : `${t("downloadAll")} (${photos.length})`}
            </Button>
          )}
          {exportError && <Alert color="danger" title={exportError} />}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5">{renderStage()}</div>
        {photos.length > 0 && (
          <Filmstrip photos={photos} activeId={activeEntry?.id ?? null} onSelect={editor.selectPhoto} onRemove={editor.removePhoto} />
        )}
      </section>
    </main>
  );
}
