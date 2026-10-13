// Renders the stills of the sculpture — one per form — from the live scene
// itself, so what paints first and the WebGL sculpture that replaces it
// always match. Each is rendered on the page colour of the anchor that
// shows it (read from the page's own data-base attributes).
// Drives a locally installed Chrome on the real GPU over the DevTools
// protocol (no npm dependencies — Node 22's built-in WebSocket).
//
//   npm run build && npm run preview   (in one terminal)
//   npm run poster                      (in another), then build again
//
// The page is opened with ?poster[=form]: everything but the sculpture is
// hidden, the sculpture fills 80% of a square viewport at its resting pose,
// and the scene sets html[data-poster-ready] after its first complete frame.
// The canvas is rendered at 2× and downsampled, which supersamples the edges.
//
// Options (env): SITE_URL (default http://127.0.0.1:4173/), CHROME_PATH,
// REVIEW=1 to also write full-size PNGs of each form into reports/sculpture/.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SITE_URL ?? 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH ?? 'google-chrome';
const PORT = 9333 + Math.floor(Math.random() * 400);
const REVIEW = Boolean(process.env.REVIEW);
const OUT = path.join(root, 'public', 'poster');
const REVIEW_OUT = path.join(root, 'reports', 'sculpture');
const STATES = ['core', 'beamtransfer', 'ambiora', 'sggs-erp'];
const VIEWPORT = 1200;
const SIZES = [1200, 640];
const QUALITY = 0.88;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`Chrome did not expose ${url}`);
}

const profile = await mkdtemp(path.join(os.tmpdir(), 'sim-poster-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--use-angle=gl',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  await poll(`http://127.0.0.1:${PORT}/json/version`);
  const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT, height: VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await mkdir(OUT, { recursive: true });
  if (REVIEW) await mkdir(REVIEW_OUT, { recursive: true });
  // The page colour behind each anchor, from the markup itself.
  await send('Page.navigate', { url: `${new URL(SITE).href}?poster` });
  await sleep(800);
  const bases = Object.fromEntries(
    await evaluate(`[...document.querySelectorAll('[data-anchor]')].map((el) => [el.dataset.anchor, el.dataset.base])`),
  );
  for (const state of STATES) {
    const url = new URL(SITE);
    url.searchParams.set('poster', state === 'core' ? '' : state);
    url.searchParams.set('base', String(bases[state] ?? '#f5f4f0').replace('#', ''));
    await send('Page.navigate', { url: url.href });

    let ready = false;
    for (let i = 0; i < 200 && !ready; i++) {
      await sleep(150);
      ready = await evaluate(`document.documentElement.dataset.posterReady === 'true'`).catch(() => false);
    }
    if (!ready) {
      const status = await evaluate(`document.querySelector('.core-stage')?.dataset.mode`).catch(() => 'unknown');
      throw new Error(
        `The scene never became ready (stage mode: ${status}). A GPU is required: the site refuses software WebGL.${errors.length ? `\n${errors.join('\n')}` : ''}`,
      );
    }
    await sleep(250); // let the last frame land

    const info = await evaluate(`(() => {
      const c = document.querySelector('.core-layer canvas');
      const gl = c.getContext('webgl2');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { width: c.width, height: c.height, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' };
    })()`);
    console.log(`${state} on ${bases[state] ?? '#f5f4f0'}: rendered ${info.width}×${info.height} on ${info.renderer}`);
    if (info.width !== info.height) throw new Error('Expected a square canvas');

    const outputs = SIZES.map((size) => [size, 'image/webp', path.join(OUT, `${state}-${size}.webp`)]);
    if (REVIEW) outputs.push([1200, 'image/png', path.join(REVIEW_OUT, `${state}.png`)]);
    for (const [size, type, file] of outputs) {
      const dataUrl = await evaluate(`(() => {
        const src = document.querySelector('.core-layer canvas');
        const out = document.createElement('canvas');
        out.width = out.height = ${size};
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, 0, 0, ${size}, ${size});
        return out.toDataURL('${type}', ${QUALITY});
      })()`);
      if (!dataUrl.startsWith(`data:${type}`)) throw new Error(`This Chrome cannot encode ${type}`);
      const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
      await writeFile(file, buffer);
      console.log(`  ${path.relative(root, file)}  ${(buffer.length / 1024).toFixed(1)} KB`);
    }
  }
  if (errors.length) console.warn(`Page exceptions:\n${errors.join('\n')}`);
  ws.close();
} finally {
  chrome.kill('SIGTERM');
  await sleep(300);
  await rm(profile, { recursive: true, force: true });
}
