"use client";

import { useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, Spinner, Tab, Tabs } from "@heroui/react";
import { useDecodedPhoto } from "@/hooks/useDecodedPhoto";
import { useEditorState } from "@/hooks/useEditorState";
import { PREVIEW_MAX_EDGE } from "@/lib/constants";
import { adjustCropForStraighten, resolveLockedAspect } from "@/lib/cropMath";
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
import { AdjustIcon, BorderIcon, CropIcon, DownloadIcon, InfoIcon } from "./icons";
import { InfoPanel } from "./InfoPanel";
import { PhotoUpload } from "./PhotoUpload";
import { Preview } from "./Preview";

type TabId = "crop" | "adjust" | "border" | "info";

const TAB_ITEMS = [
  { id: "crop", labelKey: "crop", icon: CropIcon },
  { id: "adjust", labelKey: "adjust", icon: AdjustIcon },
  { id: "border", labelKey: "border", icon: BorderIcon },
  { id: "info", labelKey: "info", icon: InfoIcon },
] as const;

export function Editor() {
  const { language, setLanguage, t } = useLanguage();
  const editor = useEditorState();
  const { photos, activeEntry, shared } = editor;
  const [tab, setTab] = useState<TabId>("adjust");
  const [straightenDraft, setStraightenDraft] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const decoded = useDecodedPhoto(activeEntry?.file ?? null);
  const orientation = activeEntry?.edit.orientation ?? null;
  const edit = activeEntry?.edit ?? null;
  const previewOrientation = useMemo(
    () =>
      orientation && tab === "crop" && straightenDraft !== null
        ? { ...orientation, straighten: straightenDraft }
        : orientation,
    [orientation, tab, straightenDraft],
  );

  const oriented = useMemo(
    () => (decoded.bitmap && previewOrientation ? createOrientedCanvas(decoded.bitmap, previewOrientation, PREVIEW_MAX_EDGE) : null),
    [decoded.bitmap, previewOrientation],
  );
  const settings = useMemo(() => (edit ? toEditSettings(edit, shared) : null), [edit, shared]);
  const cropPreview = useMemo(() => {
    if (!activeEntry || !orientation || straightenDraft === null || !oriented) return activeEntry?.edit.crop;
    return adjustCropForStraighten(
      activeEntry.edit.crop,
      oriented.width,
      oriented.height,
      orientation.straighten,
      straightenDraft,
    );
  }, [activeEntry, orientation, straightenDraft, oriented]);

  function commitStraightenDraft(): void {
    if (straightenDraft === null || !oriented) return;
    editor.setStraighten(straightenDraft, oriented.width, oriented.height);
    setStraightenDraft(null);
    setTab("adjust");
  }

  function cancelStraightenDraft(): void {
    setStraightenDraft(null);
  }

  function selectPhoto(id: string): void {
    setStraightenDraft(null);
    editor.selectPhoto(id);
  }

  function removePhoto(id: string): void {
    setStraightenDraft(null);
    editor.removePhoto(id);
  }

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
            straighten={straightenDraft ?? entry.edit.orientation.straighten}
            hasPendingStraighten={straightenDraft !== null}
            onPreviewStraighten={setStraightenDraft}
            onCommitStraighten={commitStraightenDraft}
            onCancelStraighten={cancelStraightenDraft}
            onSelectAspect={(id) => oriented && editor.selectAspect(id, oriented.width, oriented.height)}
            onRotate={(turns) => {
              setStraightenDraft(null);
              editor.rotate(turns);
            }}
            onFlip={() => {
              setStraightenDraft(null);
              editor.flip();
            }}
            onReset={() => {
              setStraightenDraft(null);
              editor.resetGeometry();
            }}
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
      return <CropTool source={oriented} crop={cropPreview ?? activeEntry.edit.crop} aspect={aspect} onChange={editor.setCrop} />;
    }
    return <Preview source={oriented} settings={settings} exif={activeEntry.exif} />;
  }

  const isExporting = exportProgress !== null;

  return (
    <main className="editor-layout">
      <aside className="editor-sidebar">
        <div className="editor-header">
          <h1 className="text-xl font-semibold">{t("appTitle")}</h1>
          <ButtonGroup size="sm" variant="flat" aria-label={t("language")}>
            {(["th", "en"] as const).map((option) => (
              <Button key={option} color={language === option ? "primary" : "default"} onPress={() => setLanguage(option)}>
                {option.toUpperCase()}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <div className="editor-upload">
          <PhotoUpload currentCount={photos.length} onAdd={editor.addPhotos} />
        </div>
        {activeEntry && (
          <Tabs
            className="editor-tabs"
            fullWidth
            aria-label={t("editTools")}
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (key === "crop" || key === "adjust" || key === "border" || key === "info") {
                if (key !== "crop") setStraightenDraft(null);
                setTab(key);
              }
            }}
          >
            {TAB_ITEMS.map(({ id, labelKey, icon: Icon }) => (
              <Tab
                key={id}
                aria-label={t(labelKey)}
                title={
                  <span className="tool-tab-label">
                    <Icon />
                    <span title={t(labelKey)}>{t(labelKey)}</span>
                  </span>
                }
              />
            ))}
          </Tabs>
        )}
        <div className="editor-tools">{activeEntry && renderToolPanel(activeEntry)}</div>
        <div className="editor-actions">
          <Button
            color="primary"
            isDisabled={!activeEntry || isExporting || straightenDraft !== null}
            startContent={<DownloadIcon />}
            onPress={() => activeEntry && handleExport([activeEntry])}
          >
            {t("downloadPhoto")}
          </Button>
          {photos.length > 1 && (
            <Button
              variant="bordered"
              isDisabled={isExporting || straightenDraft !== null}
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
      <section className="editor-workspace">
        <div className="editor-stage">{renderStage()}</div>
        {photos.length > 0 && (
          <div className="editor-filmstrip">
            <Filmstrip photos={photos} activeId={activeEntry?.id ?? null} onSelect={selectPhoto} onRemove={removePhoto} />
          </div>
        )}
      </section>
    </main>
  );
}
