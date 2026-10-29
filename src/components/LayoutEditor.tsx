"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import Image from "next/image";
import { Alert, Button, Spinner } from "@heroui/react";
import { decodeImage } from "@/lib/photoIO";
import { createOrientedCanvas, renderEdit } from "@/lib/renderPipeline";
import { toEditSettings } from "@/lib/settings";
import { constrainFrame, DEFAULT_LAYOUT, drawLayout, drawLayoutPhoto, getLayoutFrames, PAPER_SIZES } from "@/lib/layout";
import type { LayoutFrame, LayoutMode, LayoutSettings, LayoutTemplate } from "@/lib/layout";
import type { PhotoEntry, SharedSettings } from "@/lib/types";
import { useLanguage } from "./Providers";
import { CloseIcon, DownloadIcon, NextPhotoIcon, PreviousPhotoIcon, RotateLeftIcon } from "./icons";

interface LayoutDocument {
  settings: LayoutSettings;
  excluded: string[];
  order: string[];
  boxes: Record<string, LayoutFrame>;
  photoId: string | null;
}

function createDocument(mode: LayoutMode): LayoutDocument {
  return {
    settings: { ...DEFAULT_LAYOUT, ...(mode === "print" ? { width: PAPER_SIZES.a4.width, height: PAPER_SIZES.a4.height, margin: 118, gap: 59, fit: "contain" as const } : {}) },
    excluded: [],
    order: [],
    boxes: {},
    photoId: null,
  };
}

async function preparePhoto(entry: PhotoEntry, shared: SharedSettings, maxEdge: number): Promise<HTMLCanvasElement> {
  const bitmap = await decodeImage(entry.file);
  try {
    const settings = toEditSettings(entry.edit, shared);
    return renderEdit(createOrientedCanvas(bitmap, settings.orientation, maxEdge), settings, entry.exif, entry.captionOverrides);
  } finally {
    bitmap.close();
  }
}

function NumberField({ label, value, min = 0, max = 6000, onChange }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="layout-field">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={Math.round(value)} onChange={(event) => {
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, Math.round(next))));
      }} />
    </label>
  );
}

export function LayoutEditor({ photos, shared, mode, upload, hidden }: {
  photos: PhotoEntry[];
  shared: SharedSettings;
  mode: LayoutMode;
  upload: ReactNode;
  hidden: boolean;
}) {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<Record<LayoutMode, LayoutDocument>>(() => ({
    collage: createDocument("collage"), freeform: createDocument("freeform"), print: createDocument("print"), composition: createDocument("composition"),
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rendered, setRendered] = useState<{ photos: PhotoEntry[]; shared: SharedSettings; sources: Map<string, HTMLCanvasElement> } | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ frame: LayoutFrame; x: number; y: number; resize: boolean } | null>(null);
  const doc = documents[mode];
  const { settings } = doc;
  const availableIds = photos.map((photo) => photo.id);
  const orderedIds = [...doc.order.filter((id) => availableIds.includes(id)), ...availableIds.filter((id) => !doc.order.includes(id))];
  const includedIds = orderedIds.filter((id) => !doc.excluded.includes(id));
  const ids = mode === "composition" ? [availableIds.includes(doc.photoId ?? "") ? doc.photoId! : availableIds[0]].filter(Boolean) : includedIds;
  const automaticFrames = getLayoutFrames(ids, settings, mode);
  const frames = mode === "freeform" ? automaticFrames.map((frame) => constrainFrame(doc.boxes[frame.id] ?? frame, settings.width, settings.height)) : automaticFrames;
  const selectedFrame = frames.find((frame) => frame.id === selectedId);
  const ready = rendered?.photos === photos && rendered?.shared === shared;
  const frameKey = JSON.stringify(frames);

  function updateDocument(patch: Partial<LayoutDocument>) {
    setDocuments((current) => ({ ...current, [mode]: {
      ...current[mode],
      ...(mode === "freeform" ? { boxes: { ...current[mode].boxes, ...Object.fromEntries(frames.map((frame) => [frame.id, frame])) } } : {}),
      ...patch,
    } }));
  }

  function updateSettings(patch: Partial<LayoutSettings>) {
    updateDocument({ settings: { ...settings, ...patch } });
  }

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    async function load() {
      const sources = new Map<string, HTMLCanvasElement>();
      try {
        for (const photo of photos) {
          const source = await preparePhoto(photo, shared, 1200);
          if (cancelled) return;
          sources.set(photo.id, source);
        }
        if (!cancelled) {
          setRendered({ photos, shared, sources });
          setError("");
        }
      } catch {
        if (!cancelled) setError("cannotOpen");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [photos, shared, hidden]);

  useEffect(() => {
    if (hidden || !canvasRef.current || !rendered) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled && canvasRef.current) drawLayout(canvasRef.current, settings, JSON.parse(frameKey) as LayoutFrame[], rendered.sources, mode, 1200);
    });
    return () => { cancelled = true; };
  }, [settings, frameKey, rendered, mode, hidden]);

  function updateFrame(frame: LayoutFrame) {
    updateDocument({ boxes: { ...doc.boxes, ...Object.fromEntries(frames.map((item) => [item.id, item])), [frame.id]: constrainFrame(frame, settings.width, settings.height) } });
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, frame: LayoutFrame, resize = false) {
    setSelectedId(frame.id);
    if (mode !== "freeform") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { frame, x: event.clientX, y: event.clientY, resize };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!drag || !bounds) return;
    const deltaX = (event.clientX - drag.x) / bounds.width * settings.width;
    const deltaY = (event.clientY - drag.y) / bounds.height * settings.height;
    updateFrame(drag.resize
      ? { ...drag.frame, width: Math.max(40, Math.min(settings.width - drag.frame.x, drag.frame.width + deltaX)), height: Math.max(40, Math.min(settings.height - drag.frame.y, drag.frame.height + deltaY)) }
      : { ...drag.frame, x: drag.frame.x + deltaX, y: drag.frame.y + deltaY });
  }

  function reorder(direction: number) {
    if (!selectedId) return;
    const index = ids.indexOf(selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    updateDocument({ order: [...next, ...orderedIds.filter((id) => !next.includes(id))] });
  }

  async function exportLayout(print = false) {
    if (!frames.length) return;
    const printWindow = print ? window.open("", "_blank") : null;
    if (print && !printWindow) { setError("printBlocked"); return; }
    if (printWindow) printWindow.opener = null;
    setExporting(true);
    setError("");
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      drawLayout(canvas, settings, frames, new Map(), mode);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      for (const frame of frames) {
        const entry = photos.find((photo) => photo.id === frame.id);
        if (!entry) continue;
        const source = await preparePhoto(entry, shared, Math.max(settings.width, settings.height));
        drawLayoutPhoto(context, frame, source, settings.fit);
        source.width = 1;
        source.height = 1;
      }
      if (printWindow) {
        const page = printWindow.document;
        page.title = "Stillframe";
        const style = page.createElement("style");
        style.textContent = `@page { size: ${settings.width / 300 * 25.4}mm ${settings.height / 300 * 25.4}mm; margin: 0; } body { margin: 0; } img { display: block; width: 100%; } @media screen { img { max-width: 800px; margin: auto; } }`;
        const image = page.createElement("img");
        image.alt = t("layout");
        const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; });
        image.src = canvas.toDataURL("image/png");
        page.head.append(style);
        page.body.append(image);
        await loaded;
        printWindow.focus();
        printWindow.print();
      } else {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Export failed")), "image/png"));
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `stillframe-${mode}-${settings.width}x${settings.height}.png`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch {
      printWindow?.close();
      setError("exportError");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="layout-shell" hidden={hidden}>
      <aside className="layout-sidebar">
        <div className="layout-upload">{upload}</div>
        <div className="layout-controls" inert={exporting}>
          <fieldset>
            <legend>{mode === "print" ? t("paperSize") : t("canvasSize")}</legend>
            <label className="layout-field">
              <span>{t("preset")}</span>
              <select aria-label={t("preset")} value="" onChange={(event) => {
                const value = event.target.value;
                if (value in PAPER_SIZES) {
                  const paper = PAPER_SIZES[value as keyof typeof PAPER_SIZES];
                  updateSettings({ width: paper.width, height: paper.height });
                } else {
                  const [width, height] = value.split("x").map(Number);
                  if (width && height) updateSettings({ width, height });
                }
              }}>
                <option value="" disabled>{settings.width} × {settings.height} px{mode === "print" ? " · 300 dpi" : ""}</option>
                {mode === "print" ? <><option value="a4">A4</option><option value="a5">A5</option><option value="postcard">4 × 6 in</option></> : <><option value="2400x2400">1:1</option><option value="2400x3000">4:5</option><option value="2400x1600">3:2</option><option value="1920x1080">16:9</option><option value="1080x1920">9:16</option></>}
              </select>
            </label>
            <div className="layout-field-row">
              <NumberField label={`${t("width")} (px)`} min={320} value={settings.width} onChange={(width) => updateSettings({ width })} />
              <NumberField label={`${t("height")} (px)`} min={320} value={settings.height} onChange={(height) => updateSettings({ height })} />
              <Button isIconOnly variant="flat" aria-label={t("swapDimensions")} title={t("swapDimensions")} onPress={() => updateSettings({ width: settings.height, height: settings.width })}><RotateLeftIcon /></Button>
            </div>
            {mode === "print" && <p className="layout-dimensions">{(settings.width / 300 * 25.4).toFixed(1)} × {(settings.height / 300 * 25.4).toFixed(1)} mm · 300 dpi</p>}
          </fieldset>
          {(mode === "collage" || mode === "print") && <fieldset>
            <legend>{t("template")}</legend>
            <div className="layout-template-options">
              {(["grid", "columns", "rows", "feature"] as LayoutTemplate[]).map((template) => <button key={template} type="button" title={t(template)} aria-label={t(template)} aria-pressed={settings.template === template} onClick={() => updateSettings({ template })}>
                <span className={`layout-template-symbol template-${template}`} aria-hidden="true"><i /><i /><i /><i /></span>
                <span>{t(template)}</span>
              </button>)}
            </div>
            {settings.template === "grid" && <NumberField label={t("columnCount")} min={1} max={12} value={settings.columns} onChange={(columns) => updateSettings({ columns })} />}
          </fieldset>}
          <fieldset>
            <legend>{t("appearance")}</legend>
            {mode !== "freeform" && <div className="layout-field-row">
              <NumberField label={`${t("margin")} (px)`} max={Math.floor(Math.min(settings.width, settings.height) * 0.2)} value={settings.margin} onChange={(margin) => updateSettings({ margin })} />
              {mode !== "composition" && <NumberField label={`${t("gap")} (px)`} max={300} value={settings.gap} onChange={(gap) => updateSettings({ gap })} />}
            </div>}
            <label className="layout-field layout-color-field"><span>{t("backgroundColor")}</span><input type="color" value={settings.background} onChange={(event) => updateSettings({ background: event.target.value })} /></label>
            <label className="layout-field"><span>{t("photoFit")}</span><select value={settings.fit} onChange={(event) => updateSettings({ fit: event.target.value as LayoutSettings["fit"] })}><option value="cover">{t("fillFrame")}</option><option value="contain">{t("fitFrame")}</option></select></label>
          </fieldset>
          {mode === "composition" && <fieldset>
            <legend>{t("text")}</legend>
            <label className="layout-field"><span>{t("heading")}</span><input maxLength={150} value={settings.title} onChange={(event) => updateSettings({ title: event.target.value })} /></label>
            <label className="layout-field"><span>{t("subtitle")}</span><input maxLength={200} value={settings.subtitle} onChange={(event) => updateSettings({ subtitle: event.target.value })} /></label>
            <NumberField label={`${t("fontSize")} (px)`} min={16} max={240} value={settings.fontSize} onChange={(fontSize) => updateSettings({ fontSize })} />
            <label className="layout-field layout-color-field"><span>{t("textColor")}</span><input type="color" value={settings.textColor} onChange={(event) => updateSettings({ textColor: event.target.value })} /></label>
          </fieldset>}
          {frames.length > 0 && mode !== "composition" && <fieldset>
            <legend>{mode === "freeform" ? t("layers") : t("photoOrder")}</legend>
            <label className="layout-field"><span>{t("selectedPhoto")}</span><select value={selectedFrame?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}><option value="" disabled>{t("selectedPhoto")}</option>{frames.map((frame, index) => <option key={frame.id} value={frame.id}>{index + 1}. {photos.find((photo) => photo.id === frame.id)?.file.name}</option>)}</select></label>
            <div className="layout-layer-actions">
              <Button isIconOnly variant="flat" isDisabled={!selectedFrame || ids.indexOf(selectedFrame.id) === 0} title={t("moveBackward")} aria-label={t("moveBackward")} onPress={() => reorder(-1)}><PreviousPhotoIcon /></Button>
              <Button isIconOnly variant="flat" isDisabled={!selectedFrame || ids.indexOf(selectedFrame.id) === ids.length - 1} title={t("moveForward")} aria-label={t("moveForward")} onPress={() => reorder(1)}><NextPhotoIcon /></Button>
              <Button isIconOnly variant="flat" isDisabled={!selectedFrame} title={t("removeFromLayout")} aria-label={t("removeFromLayout")} onPress={() => selectedFrame && updateDocument({ excluded: [...doc.excluded, selectedFrame.id] })}><CloseIcon /></Button>
            </div>
            {mode === "freeform" && selectedFrame && <div className="layout-coordinate-grid">
              <NumberField label="X" max={settings.width - selectedFrame.width} value={selectedFrame.x} onChange={(x) => updateFrame({ ...selectedFrame, x })} />
              <NumberField label="Y" max={settings.height - selectedFrame.height} value={selectedFrame.y} onChange={(y) => updateFrame({ ...selectedFrame, y })} />
              <NumberField label={t("width")} min={40} max={settings.width - selectedFrame.x} value={selectedFrame.width} onChange={(width) => updateFrame({ ...selectedFrame, width })} />
              <NumberField label={t("height")} min={40} max={settings.height - selectedFrame.y} value={selectedFrame.height} onChange={(height) => updateFrame({ ...selectedFrame, height })} />
            </div>}
          </fieldset>}
          <Button variant="light" startContent={<RotateLeftIcon />} onPress={() => { updateDocument(createDocument(mode)); setSelectedId(null); }}>{t("resetLayout")}</Button>
        </div>
        <div className="layout-export">
          {error && <Alert color="danger" title={t(error as "cannotOpen" | "exportError" | "printBlocked")} />}
          <Button color="primary" startContent={<DownloadIcon />} isLoading={exporting} isDisabled={!frames.length || !ready || exporting} onPress={() => void exportLayout()}>{t("downloadLayout")}</Button>
          {mode === "print" && <Button variant="bordered" isDisabled={!frames.length || !ready || exporting} onPress={() => void exportLayout(true)}>{t("printLayout")}</Button>}
        </div>
      </aside>
      <section className="layout-workspace">
        <div className="layout-workspace-status"><span>{t(mode)}</span><span>{frames.length} {t("photosUnit")} · {settings.width} × {settings.height} px</span></div>
        <div className="layout-stage">
          {!photos.length ? <p className="text-default-500">{t("startPrompt")}</p> : !ready && !error ? <Spinner aria-label={t("loadingPhoto")} /> : <div className="layout-board" ref={boardRef} style={{ "--layout-ratio": settings.width / settings.height } as CSSProperties}>
            <canvas ref={canvasRef} aria-label={t("layoutPreview")} role="img" />
            <div className="layout-frame-overlays" inert={exporting}>
              {frames.map((frame) => <div key={frame.id} className={`layout-frame ${frame.id === selectedId ? "is-selected" : ""}`} style={{ left: `${frame.x / settings.width * 100}%`, top: `${frame.y / settings.height * 100}%`, width: `${frame.width / settings.width * 100}%`, height: `${frame.height / settings.height * 100}%` }}>
                <button type="button" className={`layout-frame-select ${mode === "freeform" ? "is-movable" : ""}`} aria-label={`${t("selectedPhoto")}: ${photos.find((photo) => photo.id === frame.id)?.file.name}`} aria-pressed={frame.id === selectedId} onClick={() => setSelectedId(frame.id)} onPointerDown={(event) => startDrag(event, frame)} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={(event) => {
                  if (mode !== "freeform" || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                  event.preventDefault();
                  const step = event.shiftKey ? 20 : 2;
                  updateFrame({ ...frame, x: frame.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: frame.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
                }} />
                {mode === "freeform" && frame.id === selectedId && <button className="layout-resize-handle" type="button" aria-label={t("resizePhoto")} title={t("resizePhoto")} onPointerDown={(event) => startDrag(event, frame, true)} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} />}
              </div>)}
            </div>
          </div>}
        </div>
        <div className="layout-photo-tray" inert={exporting}>
          <div className="layout-tray-header"><span>{t("layoutPhotos")}</span>{mode !== "composition" && <Button size="sm" variant="light" onPress={() => updateDocument({ excluded: includedIds.length === photos.length ? availableIds : [] })}>{includedIds.length === photos.length ? t("deselectAll") : t("selectAll")}</Button>}</div>
          <div className="layout-photo-list">
            {photos.map((photo) => <label key={photo.id} className={`layout-photo-option ${ids.includes(photo.id) ? "is-included" : ""}`} title={photo.file.name}>
              <input type={mode === "composition" ? "radio" : "checkbox"} name="layout-photo" checked={ids.includes(photo.id)} aria-label={photo.file.name} onChange={() => {
                if (mode === "composition") updateDocument({ photoId: photo.id });
                else updateDocument({ excluded: doc.excluded.includes(photo.id) ? doc.excluded.filter((id) => id !== photo.id) : [...doc.excluded, photo.id] });
                setSelectedId(photo.id);
              }} />
              <Image src={photo.thumbnailUrl} alt={photo.file.name} width={72} height={72} unoptimized />
            </label>)}
          </div>
        </div>
      </section>
    </main>
  );
}