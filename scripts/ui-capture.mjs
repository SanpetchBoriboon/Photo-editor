// Captures UI screenshots with the locally installed Chrome over raw CDP (no extra dependencies).
// Usage: node scripts/ui-capture.mjs [--base URL] [--suffix NAME] [--out DIR] [--export] [--states] [--metrics] [--interactions] [--only-edit] [--photo FILE]
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}
const flag = (name) => process.argv.includes(`--${name}`);

const base = option("base", "http://localhost:3000");
const suffix = option("suffix", "after");
const outDir = option("out", "test-output/ui");
const doExport = flag("export");
const doStates = flag("states");
const doMetrics = flag("metrics");
const doInteractions = flag("interactions");
const onlyEdit = flag("only-edit");
const photoPath = option("photo", "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORTS = [
  [1440, 900],
  [1024, 768],
  [390, 844],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const port = 9400 + Math.floor(Math.random() * 400);
const profile = await fs.mkdtemp(`${os.tmpdir()}/ui-capture-chrome-`);
const downloads = await fs.mkdtemp(`${os.tmpdir()}/ui-capture-downloads-`);
await fs.mkdir(outDir, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const result = { shots: [], meta: [], downloads: [], notes: [], metrics: [] };

// Evaluated in the page: canvas bitmap vs CSS size, scrollers, and the size and hit area of every control.
const metricsExpression = (scope = "document") => `(() => {
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const label = (el) => el.getAttribute('aria-label') || el.innerText.replace(/\\s+/g, ' ').trim() || el.getAttribute('data-slot') || el.tagName;
  const hitSize = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const owns = (x, y) => { const hit = document.elementFromPoint(x, y); return !!hit && (el === hit || el.contains(hit)); };
    const scan = (dx, dy) => { let n = 0; while (n < 60 && owns(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
    return [scan(1, 0) + scan(-1, 0) + 1, scan(0, 1) + scan(0, -1) + 1];
  };
  const canvas = document.querySelector('.preview-canvas, .crop-canvas');
  const stage = document.querySelector('.editor-stage');
  let canvasInfo = null;
  if (canvas && stage) {
    const c = canvas.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    canvasInfo = {
      bitmap: [canvas.width, canvas.height],
      css: [+c.width.toFixed(1), +c.height.toFixed(1)],
      aspectErrorPct: +(Math.abs(canvas.width / canvas.height / (c.width / c.height) - 1) * 100).toFixed(2),
      bitmapPerCssPx: +(canvas.width / c.width).toFixed(2),
      dpr: devicePixelRatio,
      stage: [+s.width.toFixed(1), +s.height.toFixed(1)],
      insideStage: c.left >= s.left - 0.5 && c.right <= s.right + 0.5 && c.top >= s.top - 0.5 && c.bottom <= s.bottom + 0.5,
    };
  }
  const scrollers = [...document.querySelectorAll('*')]
    .filter((el) => { const s = getComputedStyle(el); return visible(el) && ((/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1)); })
    .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : '') + ' [' + el.scrollWidth + 'x' + el.scrollHeight + ' in ' + el.clientWidth + 'x' + el.clientHeight + ']');
  const tools = document.querySelector('.editor-tools');
  const t = tools && tools.getBoundingClientRect();
  const slidersInView = tools ? [...tools.querySelectorAll('[data-slot="thumb"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.top >= t.top && r.bottom <= t.bottom; }).length : 0;
  const controls = [...${scope}.querySelectorAll('button, a[href], [role="tab"], [data-slot="thumb"]')]
    .filter((el) => visible(el) && el.getBoundingClientRect().width > 0)
    .map((el) => { const r = el.getBoundingClientRect(); const [hw, hh] = hitSize(el); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { control: label(el).slice(0, 40), size: [Math.round(r.width), Math.round(r.height)], hit: [hw, hh], at: [Math.round(r.x), Math.round(r.y)], coveredBy: top && !(el === top || el.contains(top)) ? top.tagName.toLowerCase() + '.' + String(top.className).split(' ').slice(0, 2).join('.') : undefined }; });
  return {
    viewport: [innerWidth, innerHeight],
    documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
    headerRightEdge: Math.round(Math.max(0, ...[...document.querySelectorAll('.workspace-heading button, .workspace-heading a')].filter((el) => el.getClientRects().length > 0).map((el) => el.getBoundingClientRect().right))),
    canvas: canvasInfo,
    scrollers,
    slidersFullyVisibleInTools: slidersInView,
    controls,
  };
})()`;

try {
  let wsUrl;
  for (let attempt = 0; attempt < 100 && !wsUrl; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) throw new Error("Chrome did not start");

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) {
      throw new Error(`${response.exceptionDetails.text} ${response.exceptionDetails.exception?.description ?? ""}`);
    }
    return response.result.value;
  };
  const waitFor = async (expression, timeout = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await ev(`Boolean(${expression})`)) return;
      await sleep(150);
    }
    throw new Error(`timeout waiting for: ${expression}`);
  };
  const click = (selector) => ev(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
  const clickText = (text) =>
    ev(
      `(() => { const el = [...document.querySelectorAll('button')].find((b) => b.innerText.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)} && !b.disabled); if (!el) throw new Error('no button with text ${text}'); el.click(); return true; })()`,
    );
  const setViewport = (width, height) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });

  await send("Page.enable");
  await send("Runtime.enable");
  try {
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });
  } catch {
    await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  }

  const navigate = async (path) => {
    await send("Page.navigate", { url: `${base}${path}` });
    await sleep(600);
    await waitFor(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`);
    await ev("document.fonts.ready.then(() => true)");
    await sleep(500);
  };
  const recordMeta = async (label) => {
    const meta = await ev(
      `({ path: location.pathname, title: document.title, h1InDom: document.querySelectorAll('h1').length, h1Visible: [...document.querySelectorAll('h1')].filter((h) => h.getClientRects().length > 0).map((h) => h.textContent.trim()) })`,
    );
    result.meta.push({ label, ...meta });
  };
  const shootAll = async (name) => {
    for (const [width, height] of VIEWPORTS) {
      await setViewport(width, height);
      await sleep(700);
      const [innerWidth, innerHeight] = await ev("[innerWidth, innerHeight]");
      if (innerWidth !== width || innerHeight !== height) {
        throw new Error(`viewport mismatch ${innerWidth}x${innerHeight} vs ${width}x${height} for ${name}`);
      }
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const file = `${outDir}/${name}-${width}x${height}-${suffix}.png`;
      await fs.writeFile(file, Buffer.from(data, "base64"));
      result.shots.push(file);
    }
  };
  const expectDownload = async (label) => {
    const known = new Set(await fs.readdir(downloads));
    return async () => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const added = (await fs.readdir(downloads)).filter((f) => !known.has(f) && !f.endsWith(".crdownload"));
        if (added.length) {
          result.downloads.push({ label, file: added[0] });
          return;
        }
        await sleep(150);
      }
      throw new Error(`download timeout: ${label}`);
    };
  };
  const openLayout = async (mode) => {
    await click(`.workspace-nav a[href="/layout/${mode}"]`);
    await waitFor(`location.pathname === '/layout/${mode}'`);
    await waitFor("!document.querySelector('.layout-shell').hidden");
    await sleep(2500);
  };

  // Real keyboard/mouse input so react-aria sets keyboard modality and hover state.
  const pressKey = async (key, code, keyCode) => {
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode });
    }
  };
  const tabTo = async (expression) => {
    await ev("document.activeElement && document.activeElement.blur(); true");
    for (let step = 0; step < 150; step++) {
      await pressKey("Tab", "Tab", 9);
      if (await ev(`document.activeElement === (${expression})`)) return;
    }
    throw new Error(`could not Tab to ${expression}`);
  };
  const rectOf = (expression) =>
    ev(
      `(() => { const el = ${expression}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
    );
  const hover = async (expression) => {
    const rect = await rectOf(expression);
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    await sleep(400);
  };
  const unhover = () => send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
  const clipShot = async (name, expression, pad = 20) => {
    const rect = await rectOf(expression);
    const x = Math.max(0, rect.x - pad);
    const y = Math.max(0, rect.y - pad);
    const clip = { x, y, width: rect.width + (rect.x - x) + pad, height: rect.height + (rect.y - y) + pad, scale: 2 };
    const { data } = await send("Page.captureScreenshot", { format: "png", clip });
    const file = `${outDir}/${name}-${suffix}.png`;
    await fs.writeFile(file, Buffer.from(data, "base64"));
    result.shots.push(file);
  };
  const focusStyle = (expression) =>
    ev(
      `(() => { const el = ${expression}; const s = getComputedStyle(el); return { outlineColor: s.outlineColor, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, boxShadow: s.boxShadow, dataFocusVisible: el.getAttribute('data-focus-visible') }; })()`,
    );

  await setViewport(1440, 900);

  if (!onlyEdit) {
    await navigate("/");
    await recordMeta("/");
    await shootAll("home");
  }

  await navigate("/edit");
  await recordMeta("/edit (empty)");
  await shootAll("edit-empty");
  if (doExport) {
    await clickText("EN");
    await sleep(300);
    result.notes.push({
      enWelcome: await ev("document.querySelector('.photo-empty-state').innerText.split('\\n')[0]"),
    });
    await clickText("TH");
    await sleep(300);
    result.notes.push({
      thWelcome: await ev("document.querySelector('.photo-empty-state').innerText.split('\\n')[0]"),
    });
  }

  if (photoPath) {
    // Real upload through the hidden file input, then confirm the import dialog.
    await send("DOM.enable");
    const { root } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" });
    await send("DOM.setFileInputFiles", { files: photoPath.split(","), nodeId });
    await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.startsWith('นำเข้ารูปที่เลือก'))");
    await ev(
      "[...document.querySelectorAll('button')].find((b) => b.innerText.startsWith('นำเข้ารูปที่เลือก')).click(); true",
    );
  } else {
    await ev(`document.querySelector('button[aria-label="ลองภาพภูเขา"]').click(); true`);
  }
  await waitFor("document.querySelector('.preview-canvas')");
  await sleep(1500);
  await recordMeta("/edit (photo)");
  await shootAll("edit-photo");

  if (doMetrics) {
    for (const [width, height] of VIEWPORTS) {
      await setViewport(width, height);
      await sleep(1500);
      const menuToggle = "document.querySelector('.workspace-menu-toggle')";
      const hasMenu = await ev(
        `(() => { const t = ${menuToggle}; return Boolean(t) && t.getClientRects().length > 0; })()`,
      );
      const metrics = await ev(metricsExpression());
      if (hasMenu) {
        // Menu items are only reachable (and hit-testable) while the menu is open.
        await ev(`${menuToggle}.click(); true`);
        await sleep(400);
        const menu = await ev(metricsExpression("document.querySelector('.workspace-menu')"));
        metrics.menuControls = menu.controls;
        await ev(`${menuToggle}.click(); true`);
        await sleep(300);
      }
      result.metrics.push(metrics);
    }
  }

  if (doInteractions) {
    const clickSelector = async (selector, wait = 600) => {
      await ev(`document.querySelector(${JSON.stringify(selector)}).click(); true`);
      await sleep(wait);
    };
    await setViewport(1440, 900);

    await clickSelector('[role=tab][aria-label="ตัดภาพ"]', 1500);
    await shootAll("edit-crop");
    if (doMetrics) {
      for (const [width, height] of VIEWPORTS) {
        await setViewport(width, height);
        await sleep(1500);
        const metrics = await ev(metricsExpression());
        result.metrics.push({ ...metrics, label: "crop tab" });
      }
    }
    await setViewport(1440, 900);
    if (doMetrics) {
      // Every tool panel on the phone: all of its controls count towards the touch-target table.
      for (const tabLabel of ["ขอบ", "ข้อมูล"]) {
        await clickSelector(`[role=tab][aria-label="${tabLabel}"]`, 800);
        await setViewport(390, 844);
        await sleep(1200);
        result.metrics.push({ ...(await ev(metricsExpression())), label: `${tabLabel} tab` });
        await setViewport(1440, 900);
      }
    }
    await clickSelector('[role=tab][aria-label="ปรับแต่ง"]', 800);

    await clickSelector(".editor-library-action", 1000);
    await shootAll("edit-library");
    await setViewport(1440, 900);
    await clickText("กลับไปแก้ไข");
    await sleep(800);

    // The collapse state is shared: it hides the desktop panel and collapses the mobile sheet.
    await clickSelector(".workspace-panel-toggle", 800);
    await shootAll("edit-collapsed");
    await setViewport(1440, 900);
    await clickSelector(".workspace-panel-toggle", 800);

    await setViewport(390, 844);
    await sleep(600);
    await clickSelector(".workspace-menu-toggle", 600);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const menuFile = `${outDir}/edit-menu-open-390x844-${suffix}.png`;
    await fs.writeFile(menuFile, Buffer.from(data, "base64"));
    result.shots.push(menuFile);
    await clickSelector(".workspace-menu-toggle", 400);

    // Drag the sheet handle with real mouse input: up, then far down to collapse.
    const sheetHeight = () =>
      ev("Math.round(document.querySelector('.editor-sidebar').getBoundingClientRect().height)");
    const dragHandle = async (deltaY) => {
      const handle = await rectOf("document.querySelector('.editor-sheet-handle')");
      const x = handle.x + handle.width / 2;
      const y = handle.y + handle.height / 2;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      for (let step = 1; step <= 10; step++) {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: y + (deltaY * step) / 10, buttons: 1 });
      }
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y: y + deltaY,
        button: "left",
        clickCount: 1,
      });
      await sleep(500);
    };
    const sheet = { initial: await sheetHeight() };
    await dragHandle(-120);
    sheet.afterDragUp120 = await sheetHeight();
    await dragHandle(400);
    sheet.afterDragDown400 = await sheetHeight();
    sheet.panelAfterDragDown = await ev("document.querySelector('.workspace-photo').dataset.panel");
    await dragHandle(-200);
    sheet.afterDragUp200 = await sheetHeight();
    sheet.panelAfterDragUp = await ev("document.querySelector('.workspace-photo').dataset.panel");
    result.notes.push({ sheet });
  }

  if (doStates) {
    await setViewport(1440, 900);
    await sleep(600);
    const targets = {
      "language-button": {
        hover: `[...document.querySelectorAll('.workspace-heading [role=group] button')].find((b) => b.innerText.trim() === 'EN')`,
      },
      tab: {
        hover: `document.querySelector('[role=tab][aria-selected=false]')`,
        focus: `document.querySelector('[role=tab][aria-selected=true]')`,
        clip: `document.querySelector('[role=tablist]')`,
      },
      "zoom-button": {
        hover: `[...document.querySelectorAll('.canvas-zoom-controls button')].find((b) => b.innerText.trim() === '100%')`,
      },
      "download-button": {
        hover: `[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'ดาวน์โหลดรูปนี้')`,
      },
    };
    for (const [name, target] of Object.entries(targets)) {
      const focus = target.focus ?? target.hover;
      await unhover();
      await hover(target.hover);
      await clipShot(`state-${name}-hover-1440x900`, target.clip ?? target.hover);
      await unhover();
      await tabTo(focus);
      await sleep(300);
      result.notes.push({ [`focus-${name}`]: await focusStyle(focus) });
      await clipShot(`state-${name}-focus-1440x900`, target.clip ?? focus);
    }
    const slider = `document.querySelector('.editor-tools input[type="range"]')`;
    const sliderGroup = `document.querySelector('.editor-tools [role=group]')`;
    await unhover();
    await hover(slider);
    await clipShot("state-slider-hover-1440x900", sliderGroup, 12);
    await unhover();
    await tabTo(slider);
    await sleep(300);
    result.notes.push({
      "focus-slider": await focusStyle(`document.querySelector('.editor-tools [data-slot="thumb"]')`),
    });
    await clipShot("state-slider-focus-1440x900", sliderGroup, 12);
    for (let step = 0; step < 5; step++) await pressKey("ArrowRight", "ArrowRight", 39);
    await sleep(300);
    await clipShot("state-slider-changed-1440x900", sliderGroup, 12);
    for (let step = 0; step < 5; step++) await pressKey("ArrowLeft", "ArrowLeft", 37);
    await unhover();
  }

  if (doExport) {
    await setViewport(1440, 900);
    const done = await expectDownload("photo export");
    await clickText("ดาวน์โหลดรูปนี้");
    await waitFor("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'ส่งออก')");
    await clickText("ส่งออก");
    await done();
  }

  // Client-side navigation only: editor state lives in memory and is lost on reload.
  if (!onlyEdit) {
    await click('a[aria-label="หน้าแรก"]');
    await waitFor("location.pathname === '/'");
    await click('a[href="/layout/collage"]');
    await waitFor("location.pathname === '/layout/collage'");
    await waitFor("!document.querySelector('.layout-shell').hidden");
    await sleep(2500);
    await recordMeta("/layout/collage (photo)");
    await shootAll("collage-photos");

    if (doExport) {
      await setViewport(1440, 900);
      const done = await expectDownload("layout download (collage)");
      await clickText("ดาวน์โหลด PNG");
      await done();
    }

    await openLayout("freeform");
    await shootAll("freeform-photos");
    await openLayout("print");
    await shootAll("print-photos");

    if (doExport) {
      await setViewport(1440, 900);
      await ev(
        `window.__printDoc = null; window.open = () => { const doc = document.implementation.createHTMLDocument(''); window.__printDoc = doc; return { document: doc, focus() {}, print() {}, close() {} }; }; true`,
      );
      await clickText("พิมพ์ / บันทึก PDF");
      await waitFor(
        "window.__printDoc && window.__printDoc.body.querySelector('img') && window.__printDoc.body.querySelector('img').src",
      );
      result.notes.push({ printDocumentTitle: await ev("window.__printDoc.title") });
    }

    await openLayout("composition");
    await shootAll("composition-photos");

    // Empty layout pages use fresh loads and the same names as the baseline set.
    for (const mode of ["collage", "freeform", "print", "composition"]) {
      await navigate(`/layout/${mode}`);
      await sleep(800);
      await recordMeta(`/layout/${mode} (empty)`);
      await shootAll(mode);
    }
  }

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(JSON.stringify(result, null, 2));
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  chrome.kill("SIGKILL");
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  await fs.rm(downloads, { recursive: true, force: true }).catch(() => {});
}
process.exit(process.exitCode ?? 0);
