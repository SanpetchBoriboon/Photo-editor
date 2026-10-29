export type LayoutMode = "collage" | "freeform" | "print" | "composition";
export type LayoutTemplate = "grid" | "columns" | "rows" | "feature";

export interface LayoutFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutSettings {
  width: number;
  height: number;
  margin: number;
  gap: number;
  background: string;
  fit: "cover" | "contain";
  template: LayoutTemplate;
  columns: number;
  title: string;
  subtitle: string;
  textColor: string;
  fontSize: number;
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  width: 2400,
  height: 2400,
  margin: 80,
  gap: 32,
  background: "#ffffff",
  fit: "cover",
  template: "grid",
  columns: 2,
  title: "",
  subtitle: "",
  textColor: "#202024",
  fontSize: 96,
};

export const PAPER_SIZES = {
  a4: { width: 2480, height: 3508, mmWidth: 210, mmHeight: 297 },
  a5: { width: 1748, height: 2480, mmWidth: 148, mmHeight: 210 },
  postcard: { width: 1200, height: 1800, mmWidth: 101.6, mmHeight: 152.4 },
} as const;

export function constrainFrame(frame: LayoutFrame, width: number, height: number): LayoutFrame {
  const frameWidth = Math.max(1, Math.min(width, frame.width));
  const frameHeight = Math.max(1, Math.min(height, frame.height));
  return {
    ...frame,
    width: frameWidth,
    height: frameHeight,
    x: Math.max(0, Math.min(width - frameWidth, frame.x)),
    y: Math.max(0, Math.min(height - frameHeight, frame.y)),
  };
}

export function getLayoutFrames(ids: string[], settings: LayoutSettings, mode: LayoutMode): LayoutFrame[] {
  if (!ids.length) return [];
  const { width, height, template } = settings;
  const margin = Math.min(settings.margin, Math.min(width, height) * 0.2);
  const contentWidth = width - margin * 2;
  const contentHeight = height - margin * 2;
  if (mode === "composition") {
    const textHeight = settings.title || settings.subtitle ? contentHeight * 0.25 : 0;
    return [{ id: ids[0], x: margin, y: margin, width: contentWidth, height: contentHeight - textHeight }];
  }
  if (template === "feature" && ids.length > 1) {
    const gap = Math.min(settings.gap, contentWidth * 0.1, contentHeight / (ids.length * 2));
    const leadWidth = (contentWidth - gap) * 0.64;
    const smallHeight = (contentHeight - gap * (ids.length - 2)) / (ids.length - 1);
    return ids.map((id, index) => index === 0
      ? { id, x: margin, y: margin, width: leadWidth, height: contentHeight }
      : { id, x: margin + leadWidth + gap, y: margin + (index - 1) * (smallHeight + gap), width: contentWidth - leadWidth - gap, height: smallHeight });
  }
  const columns = template === "rows" ? 1 : template === "columns" ? ids.length : Math.min(ids.length, Math.max(1, settings.columns));
  const rows = Math.ceil(ids.length / columns);
  const gap = Math.min(settings.gap, contentWidth / (columns * 2), contentHeight / (rows * 2));
  const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
  const cellHeight = (contentHeight - gap * (rows - 1)) / rows;
  return ids.map((id, index) => ({
    id,
    x: margin + (index % columns) * (cellWidth + gap),
    y: margin + Math.floor(index / columns) * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight,
  }));
}

export function drawLayoutPhoto(
  context: CanvasRenderingContext2D,
  frame: LayoutFrame,
  source: HTMLCanvasElement,
  fit: LayoutSettings["fit"],
): void {
  const ratio = fit === "cover"
    ? Math.max(frame.width / source.width, frame.height / source.height)
    : Math.min(frame.width / source.width, frame.height / source.height);
  const drawWidth = source.width * ratio;
  const drawHeight = source.height * ratio;
  context.save();
  context.beginPath();
  context.rect(frame.x, frame.y, frame.width, frame.height);
  context.clip();
  context.drawImage(source, frame.x + (frame.width - drawWidth) / 2, frame.y + (frame.height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

export function drawLayout(
  canvas: HTMLCanvasElement,
  settings: LayoutSettings,
  frames: LayoutFrame[],
  sources: Map<string, HTMLCanvasElement>,
  mode: LayoutMode,
  maxEdge = Infinity,
): void {
  const scale = Math.min(1, maxEdge / Math.max(settings.width, settings.height));
  canvas.width = Math.max(1, Math.round(settings.width * scale));
  canvas.height = Math.max(1, Math.round(settings.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.scale(scale, scale);
  context.fillStyle = settings.background;
  context.fillRect(0, 0, settings.width, settings.height);
  for (const frame of frames) {
    const source = sources.get(frame.id);
    if (!source) continue;
    drawLayoutPhoto(context, frame, source, settings.fit);
  }
  if (mode === "composition" && frames.length) {
    const frame = frames[0];
    const textTop = frame.y + frame.height;
    const availableHeight = settings.height - settings.margin - textTop;
    const titleSize = Math.min(settings.fontSize, availableHeight * 0.36);
    const font = getComputedStyle(document.body).fontFamily;
    context.fillStyle = settings.textColor;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 ${titleSize}px ${font}`;
    context.fillText(settings.title, settings.width / 2, textTop + availableHeight * (settings.subtitle ? 0.36 : 0.5), frame.width);
    context.font = `400 ${titleSize * 0.48}px ${font}`;
    context.fillText(settings.subtitle, settings.width / 2, textTop + availableHeight * 0.72, frame.width);
  }
}