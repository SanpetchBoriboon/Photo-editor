"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Alert, Button, ButtonGroup, Spinner, Tab, Tabs } from "@heroui/react";
import { useDecodedPhoto } from "@/hooks/useDecodedPhoto";
import { useEditorState } from "@/hooks/useEditorState";
import { INTERACTIVE_PREVIEW_MAX_EDGE, PREVIEW_MAX_EDGE } from "@/lib/constants";
import { getCaptionTexts, hasMissingCaptionFields } from "@/lib/caption";
import { adjustCropForStraighten, resolveLockedAspect } from "@/lib/cropMath";
import { exportPhoto, exportPhotosAsZip } from "@/lib/photoIO";
import { createOrientedCanvas } from "@/lib/renderPipeline";
import { toEditSettings } from "@/lib/settings";
import type { PhotoEntry } from "@/lib/types";
import type { LayoutMode } from "@/lib/layout";
import { useLanguage } from "./Providers";
import { AdjustPanel } from "./AdjustPanel";
import { BorderPanel } from "./BorderPanel";
import { CropPanel } from "./CropPanel";
import { CropTool } from "./CropTool";
import { Filmstrip } from "./Filmstrip";
import {
  AdjustIcon,
  BorderIcon,
  CropIcon,
  DownloadIcon,
  InfoIcon,
  NextPhotoIcon,
  PreviousPhotoIcon,
} from "./icons";
import { InfoPanel } from "./InfoPanel";
import { LayoutEditor } from "./LayoutEditor";
import { PhotoUpload } from "./PhotoUpload";
import { Preview } from "./Preview";

type TabId = "crop" | "adjust" | "border" | "info";

const TAB_ITEMS = [
  { id: "crop", labelKey: "crop", icon: CropIcon },
  { id: "adjust", labelKey: "adjust", icon: AdjustIcon },
  { id: "border", labelKey: "border", icon: BorderIcon },
  { id: "info", labelKey: "info", icon: InfoIcon },
] as const;

const WORKSPACE_LINKS = [
  { href: "/edit", labelKey: "photoEditor" },
  { href: "/layout/collage", labelKey: "collage" },
  { href: "/layout/freeform", labelKey: "freeform" },
  { href: "/layout/print", labelKey: "print" },
  { href: "/layout/composition", labelKey: "composition" },
] as const;

export function Editor() {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const editor = useEditorState();
  const { photos, activeEntry, shared, selectPhoto: setActivePhoto } = editor;
  const workspace = pathname === "/" ? "home" : pathname.startsWith("/layout/") ? "layout" : "photo";
  const routeMode = pathname.split("/")[2];
  const layoutMode: LayoutMode = routeMode === "freeform" || routeMode === "print" || routeMode === "composition" ? routeMode : "collage";
  const [tab, setTab] = useState<TabId>("adjust");
  const [isAdjusting, setIsAdjusting] = useState(false);
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
    () =>
      decoded.bitmap && previewOrientation
        ? createOrientedCanvas(
            decoded.bitmap,
            previewOrientation,
            isAdjusting ? INTERACTIVE_PREVIEW_MAX_EDGE : PREVIEW_MAX_EDGE,
          )
        : null,
    [decoded.bitmap, previewOrientation, isAdjusting],
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
    setTab("border");
  }

  function cancelStraightenDraft(): void {
    setStraightenDraft(null);
  }

  function selectPhoto(id: string): void {
    setStraightenDraft(null);
    editor.selectPhoto(id);
  }

  useEffect(() => {
    function handlePhotoNavigation(event: KeyboardEvent): void {
      if (
        workspace !== "photo" ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input:not([type='file']), textarea, select, [contenteditable='true'], [role='slider'], [role='tab']",
        )
      ) {
        return;
      }
      const currentIndex = photos.findIndex((photo) => photo.id === activeEntry?.id);
      const nextIndex = currentIndex + (event.key === "ArrowLeft" ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= photos.length) return;
      event.preventDefault();
      setStraightenDraft(null);
      setActivePhoto(photos[nextIndex].id);
    }

    window.addEventListener("keydown", handlePhotoNavigation);
    return () => window.removeEventListener("keydown", handlePhotoNavigation);
  }, [photos, activeEntry?.id, setActivePhoto, workspace]);

  function removePhoto(id: string): void {
    setStraightenDraft(null);
    editor.removePhoto(id);
  }

  async function handleExport(entries: PhotoEntry[]): Promise<void> {
    setExportError("");
    try {
      if (entries.length === 1) {
        setExportProgress({ done: 0, total: 1 });
        await exportPhoto(entries[0], shared);
      } else {
        setExportProgress({ done: 0, total: entries.length });
        await exportPhotosAsZip(entries, shared, (done) => setExportProgress({ done, total: entries.length }));
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
        return (
          <AdjustPanel
            adjustments={entry.edit.adjustments}
            onChange={editor.setAdjustments}
            onInteractionStart={(key) => setIsAdjusting(key !== "exposure")}
            onInteractionEnd={() => setIsAdjusting(false)}
          />
        );
      case "border":
        return <BorderPanel border={shared.border} onChange={editor.setBorder} />;
      case "info":
        return (
          <InfoPanel
            exif={entry.exif}
            captionOverrides={entry.captionOverrides}
            caption={shared.caption}
            credit={shared.credit}
            hasPhotosWithoutProfile={photos.some(
              (photo) =>
                photo.id !== entry.id &&
                hasMissingCaptionFields(photo.exif, getCaptionTexts(entry.exif, entry.captionOverrides)),
            )}
            onCaptionChange={editor.setCaption}
            onCaptionOverrideChange={editor.setCaptionOverride}
            onApplyProfile={(profile) => editor.applyCaptionOverridesToPhotosWithoutExif(profile)}
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
    return (
      <Preview
        source={oriented}
        settings={settings}
        exif={activeEntry.exif}
        captionOverrides={activeEntry.captionOverrides}
      />
    );
  }

  const isExporting = exportProgress !== null;
  const activePhotoIndex = photos.findIndex((photo) => photo.id === activeEntry?.id);
  if (pathname !== "/" && !WORKSPACE_LINKS.some(({ href }) => href === pathname)) return null;
  const header = (
    <header className="workspace-header">
      <div className="workspace-heading">
        <h1 className="text-xl font-semibold">
          <Link href="/" aria-label={t("home")}>
            <span className="text-default-500">Still</span>
            <span className="text-primary">frame</span>
          </Link>
        </h1>
        <ButtonGroup size="sm" variant="flat" aria-label={t("language")}>
          {(["th", "en"] as const).map((option) => (
            <Button key={option} color={language === option ? "primary" : "default"} onPress={() => setLanguage(option)}>
              {option.toUpperCase()}
            </Button>
          ))}
        </ButtonGroup>
      </div>
      <nav className="workspace-nav" aria-label={t("workspaceMode")}>
        {WORKSPACE_LINKS.map(({ href, labelKey }) => (
          <Link key={href} href={href} scroll={false} aria-current={pathname === href ? "page" : undefined} onNavigate={() => setIsAdjusting(false)}>
            {t(labelKey)}
          </Link>
        ))}
      </nav>
    </header>
  );

  return (
    <div className="workspace-shell" hidden={workspace === "home"}>
    {header}
    <div className="workspace-content">
    <main className="editor-layout" hidden={workspace !== "photo"}>
      <aside className="editor-sidebar">
        <div className="editor-upload">
          <PhotoUpload onAdd={editor.addPhotos} />
        </div>
        {activeEntry && (
          <Tabs
            className="editor-tabs"
            fullWidth
            aria-label={t("editTools")}
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (key === "crop" || key === "adjust" || key === "border" || key === "info") {
                setIsAdjusting(false);
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
                ? `${t("exporting")} ${exportProgress.done}/${exportProgress.total}`
                : `${t("downloadAll")} (${photos.length})`}
            </Button>
          )}
          {photos.length > 0 && (
            <Button
              variant="light"
              color="danger"
              isDisabled={isExporting}
              onPress={() => {
                setStraightenDraft(null);
                editor.clearPhotos();
              }}
            >
              {t("resetPhotos")}
            </Button>
          )}
          {exportError && <Alert color="danger" title={exportError} />}
        </div>
      </aside>
      <section className="editor-workspace">
        <div className="editor-stage">
          {photos.length > 1 && (
            <Button
              isIconOnly
              variant="flat"
              aria-label={t("previousPhoto")}
              isDisabled={activePhotoIndex <= 0}
              onPress={() => activePhotoIndex > 0 && selectPhoto(photos[activePhotoIndex - 1].id)}
            >
              <PreviousPhotoIcon />
            </Button>
          )}
          {renderStage()}
          {photos.length > 1 && (
            <Button
              isIconOnly
              variant="flat"
              aria-label={t("nextPhoto")}
              isDisabled={activePhotoIndex >= photos.length - 1}
              onPress={() => activePhotoIndex < photos.length - 1 && selectPhoto(photos[activePhotoIndex + 1].id)}
            >
              <NextPhotoIcon />
            </Button>
          )}
        </div>
        {photos.length > 0 && (
          <div className="editor-filmstrip">
            <Filmstrip photos={photos} activeId={activeEntry?.id ?? null} onSelect={selectPhoto} onRemove={removePhoto} />
          </div>
        )}
      </section>
    </main>
    <LayoutEditor
      photos={photos}
      shared={shared}
      mode={layoutMode}
      upload={<PhotoUpload onAdd={editor.addPhotos} />}
      hidden={workspace !== "layout"}
    />
    </div>
    </div>
  );
}
