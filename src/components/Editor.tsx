"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Alert,
  Button,
  ButtonGroup,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { useDecodedPhoto } from "@/hooks/useDecodedPhoto";
import { useEditorState } from "@/hooks/useEditorState";
import { APP_NAME } from "@/lib/brand";
import { MAX_PREVIEW_EDGE } from "@/lib/constants";
import { getBorderExpansionFactor } from "@/lib/borderRenderer";
import { getCaptionTexts, hasMissingCaptionFields } from "@/lib/caption";
import { adjustCropForStraighten, resolveLockedAspect } from "@/lib/cropMath";
import { exportPhoto, exportPhotosAsZip } from "@/lib/photoIO";
import { createOrientedCanvas } from "@/lib/renderPipeline";
import { toEditSettings } from "@/lib/settings";
import type { PhotoEntry, PhotoExportSize } from "@/lib/types";
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
  GridIcon,
  InfoIcon,
  NextPhotoIcon,
  PreviousPhotoIcon,
} from "./icons";
import { InfoPanel } from "./InfoPanel";
import { LayoutEditor } from "./LayoutEditor";
import { PhotoLibrary } from "./PhotoLibrary";
import { PhotoUpload } from "./PhotoUpload";
import { Preview } from "./Preview";

type TabId = "crop" | "adjust" | "border" | "info";
type CanvasZoom = "fit" | "100%" | "200%";

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
  const layoutMode: LayoutMode =
    routeMode === "freeform" || routeMode === "print" || routeMode === "composition" ? routeMode : "collage";
  const [tab, setTab] = useState<TabId>("adjust");
  const [canvasZoom, setCanvasZoom] = useState<CanvasZoom>("fit");
  const [isPhotoLibraryOpen, setIsPhotoLibraryOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [exportEntries, setExportEntries] = useState<PhotoEntry[] | null>(null);
  const [straightenDraft, setStraightenDraft] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportSize, setExportSize] = useState<PhotoExportSize>("original");
  const [customMegapixels, setCustomMegapixels] = useState(5);
  const editorStageRef = useRef<HTMLDivElement>(null);
  const [displayCanvasLongEdge, setDisplayCanvasLongEdge] = useState(0);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);

  const decoded = useDecodedPhoto(activeEntry?.file ?? null);
  const activePhotoId = activeEntry?.id;
  const orientation = activeEntry?.edit.orientation ?? null;
  const edit = activeEntry?.edit ?? null;
  const previewOrientation = useMemo(
    () =>
      orientation && tab === "crop" && straightenDraft !== null
        ? { ...orientation, straighten: straightenDraft }
        : orientation,
    [orientation, tab, straightenDraft],
  );

  useEffect(() => {
    const stage = editorStageRef.current;
    if (!stage || !activePhotoId || workspace !== "photo" || isPhotoLibraryOpen) {
      setDisplayCanvasLongEdge(0);
      return undefined;
    }

    let observedCanvas: HTMLCanvasElement | null = null;
    const observer = new ResizeObserver(() => {
      const canvas = stage.querySelector<HTMLCanvasElement>(".preview-canvas, .crop-canvas");
      if (canvas !== observedCanvas) {
        if (observedCanvas) observer.unobserve(observedCanvas);
        observedCanvas = canvas;
        if (canvas) observer.observe(canvas);
      }
      if (!canvas) return;
      if (canvasZoom !== "fit") return;
      const bounds = canvas.getBoundingClientRect();
      const longEdge = Math.max(bounds.width, bounds.height);
      setDisplayCanvasLongEdge((current) => (Math.abs(current - longEdge) < 0.5 ? current : longEdge));
    });
    observer.observe(stage);
    const initialCanvas = stage.querySelector<HTMLCanvasElement>(".preview-canvas, .crop-canvas");
    if (initialCanvas) {
      observedCanvas = initialCanvas;
      observer.observe(initialCanvas);
    }

    const updateDevicePixelRatio = () => setDevicePixelRatio(window.devicePixelRatio || 1);
    updateDevicePixelRatio();
    window.addEventListener("resize", updateDevicePixelRatio);
    const frame = requestAnimationFrame(() => {
      const canvas = stage.querySelector<HTMLCanvasElement>(".preview-canvas, .crop-canvas");
      if (canvas && canvas !== observedCanvas) {
        if (observedCanvas) observer.unobserve(observedCanvas);
        observedCanvas = canvas;
        observer.observe(canvas);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updateDevicePixelRatio);
    };
  }, [activePhotoId, canvasZoom, isPhotoLibraryOpen, tab, workspace]);

  const zoomScale = canvasZoom === "fit" ? null : canvasZoom === "100%" ? 1 : 2;

  const sourceLongEdge = decoded.bitmap ? Math.max(decoded.bitmap.width, decoded.bitmap.height) : MAX_PREVIEW_EDGE;
  const orientationSwapsAxes = previewOrientation?.rotation === 90 || previewOrientation?.rotation === 270;
  const orientedSourceWidth = decoded.bitmap
    ? orientationSwapsAxes
      ? decoded.bitmap.height
      : decoded.bitmap.width
    : 0;
  const orientedSourceHeight = decoded.bitmap
    ? orientationSwapsAxes
      ? decoded.bitmap.width
      : decoded.bitmap.height
    : 0;
  const crop = activeEntry?.edit.crop;
  const cropSourceWidth = crop
    ? Math.min(
        orientedSourceWidth - Math.round(crop.x * orientedSourceWidth),
        Math.max(1, Math.round(crop.width * orientedSourceWidth)),
      )
    : orientedSourceWidth;
  const cropSourceHeight = crop
    ? Math.min(
        orientedSourceHeight - Math.round(crop.y * orientedSourceHeight),
        Math.max(1, Math.round(crop.height * orientedSourceHeight)),
      )
    : orientedSourceHeight;
  const borderExpansionFactor =
    decoded.bitmap && activeEntry && tab !== "crop"
      ? getBorderExpansionFactor(cropSourceWidth, cropSourceHeight, shared.border)
      : 1;
  const displayTargetEdge =
    displayCanvasLongEdge > 0 ? Math.round(displayCanvasLongEdge * devicePixelRatio) : MAX_PREVIEW_EDGE;
  const fullTarget = Math.min(MAX_PREVIEW_EDGE, sourceLongEdge, displayTargetEdge);
  const fullPreviewEdge = Math.min(sourceLongEdge, MAX_PREVIEW_EDGE, Math.floor(fullTarget / borderExpansionFactor));
  const previewMaxEdge = fullPreviewEdge;

  const oriented = useMemo(
    () =>
      decoded.bitmap && previewOrientation
        ? createOrientedCanvas(decoded.bitmap, previewOrientation, previewMaxEdge)
        : null,
    [decoded.bitmap, previewOrientation, previewMaxEdge],
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

  function confirmCrop(): void {
    if (straightenDraft !== null) commitStraightenDraft();
    setTab("adjust");
  }

  function cancelStraightenDraft(): void {
    setStraightenDraft(null);
  }

  function selectPhoto(id: string): void {
    setStraightenDraft(null);
    editor.selectPhoto(id);
  }

  function selectLibraryPhoto(id: string): void {
    selectPhoto(id);
    setIsPhotoLibraryOpen(false);
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

  async function handleExport(entries: PhotoEntry[]): Promise<boolean> {
    setExportError("");
    try {
      if (entries.length === 1) {
        setExportProgress({ done: 0, total: 1 });
        await exportPhoto(entries[0], shared, exportSize, customMegapixels);
      } else {
        setExportProgress({ done: 0, total: entries.length });
        await exportPhotosAsZip(
          entries,
          shared,
          (done) => setExportProgress({ done, total: entries.length }),
          exportSize,
          customMegapixels,
        );
      }
      return true;
    } catch {
      setExportError(t("exportError"));
      return false;
    } finally {
      setExportProgress(null);
    }
  }

  async function confirmExport(): Promise<void> {
    if (!exportEntries || isExporting) return;
    if (await handleExport(exportEntries)) setExportEntries(null);
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
            key={entry.id}
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
      return (
        <div className="photo-empty-state">
          <h2>{t("welcomeToEditor")}</h2>
          <PhotoUpload onAdd={editor.addPhotos} dropzone />
        </div>
      );
    }
    if (decoded.failed) return <Alert color="danger" title={t("oversizedImage")} />;
    if (!oriented || !settings) return <Spinner aria-label={t("loadingPhoto")} />;
    if (tab === "crop") {
      const aspect = resolveLockedAspect(activeEntry.edit.aspectId, oriented.width, oriented.height);
      return (
        <CropTool
          source={oriented}
          crop={cropPreview ?? activeEntry.edit.crop}
          aspect={aspect}
          zoomScale={zoomScale}
          onChange={editor.setCrop}
          onConfirm={confirmCrop}
        />
      );
    }
    return (
      <Preview
        source={oriented}
        settings={settings}
        exif={activeEntry.exif}
        captionOverrides={activeEntry.captionOverrides}
        zoomScale={zoomScale}
      />
    );
  }

  const isExporting = exportProgress !== null;
  const activePhotoIndex = photos.findIndex((photo) => photo.id === activeEntry?.id);
  const workspaceLinks = WORKSPACE_LINKS.filter(({ href }) =>
    workspace === "photo" ? href === "/edit" : workspace === "layout" ? href !== "/edit" : true,
  );
  if (pathname !== "/" && !WORKSPACE_LINKS.some(({ href }) => href === pathname)) return null;
  const header = (
    <header className="workspace-header">
      <div className="workspace-heading">
        <div className="workspace-heading-start">
          <p className="text-xl font-semibold">
            <Link href="/" aria-label={t("home")}>
              {APP_NAME}
            </Link>
          </p>
          {workspace !== "home" && <h1 className="sr-only">{t(workspace === "photo" ? "photoEditor" : layoutMode)}</h1>}
        </div>
        <ButtonGroup size="sm" variant="flat" aria-label={t("language")}>
          {(["th", "en"] as const).map((option) => (
            <Button
              key={option}
              className={
                language === option ? "bg-surface-raised text-text-primary" : "bg-surface-bar text-text-secondary"
              }
              onPress={() => setLanguage(option)}
            >
              {option.toUpperCase()}
            </Button>
          ))}
        </ButtonGroup>
      </div>
      {workspaceLinks.length > 1 && (
        <nav className="workspace-nav" aria-label={t("workspaceMode")}>
          {workspaceLinks.map(({ href, labelKey }) => (
            <Link key={href} href={href} scroll={false} aria-current={pathname === href ? "page" : undefined}>
              {t(labelKey)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );

  return (
    <div className="workspace-shell" hidden={workspace === "home"}>
      {header}
      <div className="workspace-content">
        <main
          className={
            isPhotoLibraryOpen
              ? "editor-layout editor-layout-library"
              : photos.length === 0
                ? "editor-layout editor-layout-empty"
                : "editor-layout"
          }
          hidden={workspace !== "photo"}
        >
          <aside className="editor-sidebar">
            {photos.length > 0 && (
              <div className="editor-upload">
                <Button
                  className="editor-library-action"
                  variant="light"
                  startContent={<GridIcon />}
                  onPress={() => setIsPhotoLibraryOpen(true)}
                >
                  <span>{t("photoLibrary")}</span>
                  <span className="editor-library-count">{photos.length}</span>
                </Button>
              </div>
            )}
            {activeEntry && (
              <Tabs
                className="editor-tabs"
                classNames={{
                  tabList: "bg-surface-bar",
                  cursor: "bg-surface-raised dark:bg-surface-raised shadow-none",
                  tabContent: "text-text-secondary group-data-[selected=true]:text-text-primary",
                }}
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
                onPress={() => activeEntry && setExportEntries([activeEntry])}
              >
                {t("downloadPhoto")}
              </Button>
              {photos.length > 1 && (
                <Button
                  variant="bordered"
                  isDisabled={isExporting || straightenDraft !== null}
                  startContent={<DownloadIcon />}
                  onPress={() => setExportEntries(photos)}
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
                  onPress={() => setIsClearConfirmOpen(true)}
                >
                  {t("resetPhotos")}
                </Button>
              )}
              {exportError && <Alert color="danger" title={exportError} />}
            </div>
          </aside>
          <section className="editor-workspace">
            {isPhotoLibraryOpen ? (
              <PhotoLibrary
                photos={photos}
                activeId={activeEntry?.id ?? null}
                onAdd={editor.addPhotos}
                onSelect={selectLibraryPhoto}
                onClose={() => setIsPhotoLibraryOpen(false)}
              />
            ) : (
              <>
                <div className="editor-stage" data-canvas-zoom={canvasZoom} ref={editorStageRef}>
                  {activeEntry && (
                    <div className="canvas-zoom-controls">
                      <ButtonGroup size="sm" variant="flat" aria-label={t("canvasZoom")}>
                        {(["fit", "100%", "200%"] as const).map((option) => (
                          <Button
                            key={option}
                            className={
                              canvasZoom === option
                                ? "bg-surface-raised text-text-primary"
                                : "bg-surface-bar text-text-secondary"
                            }
                            aria-pressed={canvasZoom === option}
                            onPress={() => setCanvasZoom(option)}
                          >
                            {option === "fit" ? t("fitScreen") : option}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </div>
                  )}
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
                      onPress={() =>
                        activePhotoIndex < photos.length - 1 && selectPhoto(photos[activePhotoIndex + 1].id)
                      }
                    >
                      <NextPhotoIcon />
                    </Button>
                  )}
                </div>
                {photos.length > 0 && (
                  <div className="editor-filmstrip">
                    <Filmstrip
                      photos={photos}
                      activeId={activeEntry?.id ?? null}
                      onSelect={selectPhoto}
                      onRemove={removePhoto}
                    />
                  </div>
                )}
              </>
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
        <Modal
          isOpen={exportEntries !== null}
          isDismissable={!isExporting}
          isKeyboardDismissDisabled={isExporting}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isExporting) setExportEntries(null);
          }}
          size="sm"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>{t("exportDialogTitle")}</ModalHeader>
                <ModalBody>
                  <Select
                    aria-label={t("exportSize")}
                    className="w-full min-w-0"
                    label={t("exportSize")}
                    labelPlacement="outside"
                    selectedKeys={[exportSize]}
                    size="sm"
                    variant="bordered"
                    isDisabled={isExporting}
                    onSelectionChange={(keys) => {
                      if (keys === "all") return;
                      const [value] = Array.from(keys);
                      if (typeof value === "string") setExportSize(value as PhotoExportSize);
                    }}
                  >
                    <SelectItem key="original">{t("originalSize")}</SelectItem>
                    <SelectItem key="2048px">{t("longestEdge2048")}</SelectItem>
                    <SelectItem key="customMp">{t("customSize")}</SelectItem>
                  </Select>
                  {exportSize === "customMp" && (
                    <label className="flex flex-col gap-1 text-sm">
                      {t("megapixels")}
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={t("megapixels")}
                          className="h-9 min-w-0 flex-1 rounded-medium border border-default-200 bg-content1 px-3"
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={customMegapixels}
                          disabled={isExporting}
                          onChange={(event) => {
                            const value = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(value)) setCustomMegapixels(Math.min(100, Math.max(0.1, value)));
                          }}
                        />
                        <span>MP</span>
                      </div>
                    </label>
                  )}
                  {exportProgress && (
                    <p aria-live="polite" className="text-sm text-default-500">
                      {t("exporting")} {exportProgress.done}/{exportProgress.total}
                    </p>
                  )}
                  {exportError && <Alert color="danger" title={exportError} />}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" isDisabled={isExporting} onPress={onClose}>
                    {t("cancel")}
                  </Button>
                  <Button color="primary" isDisabled={isExporting} onPress={() => void confirmExport()}>
                    {t("confirmExport")}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
        <Modal isOpen={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen} size="sm">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>{t("clearPhotosTitle")}</ModalHeader>
                <ModalBody>
                  <Alert color="warning" title={t("clearPhotosMessage")} />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>
                    {t("cancel")}
                  </Button>
                  <Button
                    color="danger"
                    onPress={() => {
                      setStraightenDraft(null);
                      editor.clearPhotos();
                      onClose();
                    }}
                  >
                    {t("confirmClearPhotos")}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
