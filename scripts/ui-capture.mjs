// Captures UI screenshots with the locally installed Chrome over raw CDP (no extra dependencies).
// Usage: node scripts/ui-capture.mjs [--base URL] [--suffix NAME] [--out DIR] [--export] [--states]
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

const result = { shots: [], meta: [], downloads: [], notes: [] };

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

  await navigate("/");
  await recordMeta("/");
  await shootAll("home");

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

  await ev(`document.querySelector('button[aria-label="ลองภาพภูเขา"]').click(); true`);
  await waitFor("document.querySelector('.preview-canvas')");
  await sleep(1500);
  await recordMeta("/edit (photo)");
  await shootAll("edit-photo");

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
