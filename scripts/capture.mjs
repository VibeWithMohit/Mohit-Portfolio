// Responsive QA harness: drives a locally installed Chrome over the DevTools
// protocol (no npm dependencies — Node 22's built-in WebSocket) to capture
// every section at desktop, tablet and phone sizes, and to report console
// errors, uncaught exceptions and horizontal overflow.
//
//   npm run build && npm run preview      (in one terminal)
//   npm run capture                        (in another)
//
// Options (env): SITE_URL (default http://127.0.0.1:4173/), CHROME_PATH,
// MOTION=reduce|no-preference (default no-preference), ONLY=desktop,mobile,
// GPU=1 to render WebGL on the real GPU instead of headless software GL.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SITE_URL ?? 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH ?? 'google-chrome';
const MOTION = process.env.MOTION ?? 'no-preference';
const PORT = 9333 + Math.floor(Math.random() * 400);
const OUT = path.join(root, 'reports', 'screens');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, mobile: false },
  laptop: { width: 1280, height: 720, mobile: false },
  tablet: { width: 834, height: 1112, mobile: true },
  mobile: { width: 390, height: 844, mobile: true },
};
const ANCHORS = ['top', 'work', 'project-beamtransfer', 'project-ambiora', 'project-sggs-erp', 'systems', 'experience', 'lab', 'about', 'contact'];
const only = process.env.ONLY?.split(',');

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

const profile = await mkdtemp(path.join(os.tmpdir(), 'sim-capture-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    // GPU=1 uses the machine's real GPU; otherwise headless Chrome rasterises
    // WebGL in software, and the site deliberately serves the still image.
    ...(process.env.GPU ? ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'] : []),
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
  const listeners = new Map();
  const problems = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      if (msg.method === 'Runtime.exceptionThrown') problems.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
        problems.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
      }
      listeners.get(msg.method)?.forEach((fn) => fn(msg.params));
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method) =>
    new Promise((resolve) => {
      const fns = listeners.get(method) ?? new Set();
      const fn = (params) => {
        fns.delete(fn);
        resolve(params);
      };
      fns.add(fn);
      listeners.set(method, fns);
    });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  /** Two animation frames plus a pause: the compositor has really drawn. */
  const settle = (ms) => evaluate(`new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), ${ms}))`);

  await send('Page.enable');
  await send('Runtime.enable');
  await mkdir(OUT, { recursive: true });

  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    if (only && !only.includes(name)) continue;
    await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
    await send('Emulation.setTouchEmulationEnabled', vp.mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: MOTION }] });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: SITE });
    await loaded;
    await settle(2200); // hero intro + idle-time 3D decision

    const report = await evaluate(`({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      core: document.querySelector('.core-layer')?.dataset.mode,
      motion: document.documentElement.dataset.motion,
    })`);
    console.log(`\n${name} ${vp.width}×${vp.height} — core: ${report.core}, motion: ${report.motion}, horizontal overflow: ${report.overflow}px`);
    if (report.overflow > 0) problems.push(`${name}: page is ${report.overflow}px wider than the viewport`);

    for (const anchor of ANCHORS) {
      await evaluate(`document.getElementById(${JSON.stringify(anchor)}).scrollIntoView({ behavior: 'instant', block: 'start' })`);
      await settle(700);
      // The floating glass bar must stay pinned near the top of the visual viewport.
      const header = await evaluate(`(() => {
        const r = document.querySelector('.site-header__bar').getBoundingClientRect();
        return { top: Math.round(r.top), viewportTop: Math.round(window.visualViewport?.offsetTop ?? 0), scrollY: Math.round(scrollY) };
      })()`);
      if (header.top < 0 || header.top > 24 || header.viewportTop !== 0) {
        problems.push(`${name} #${anchor}: header at ${header.top}px, visual viewport offset ${header.viewportTop}px (scrollY ${header.scrollY})`);
      }
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, `${name}-${anchor}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(`  ${path.relative(root, file)}`);
    }

    // Whole-element captures of every figure and Lab experiment.
    const targets = await evaluate(`[...document.querySelectorAll('figure.fig, .experiment')].length`);
    for (let i = 0; i < targets; i++) {
      await evaluate(`document.querySelectorAll('figure.fig, .experiment')[${i}].scrollIntoView({ behavior: 'instant', block: 'center' })`);
      await settle(1200); // lazy chunks load and render
      const box = await evaluate(`(() => {
        const el = document.querySelectorAll('figure.fig, .experiment')[${i}];
        const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, id: el.closest('[id]')?.id ?? 'figure' };
      })()`);
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
      });
      const file = path.join(OUT, `${name}-element-${String(i + 1).padStart(2, '0')}-${box.id}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(`  ${path.relative(root, file)}`);
    }
  }

  console.log(problems.length ? `\nProblems (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}` : '\nNo console errors, exceptions or overflow.');
  ws.close();
  process.exitCode = problems.length ? 1 : 0;
} finally {
  chrome.kill('SIGTERM');
  await sleep(300);
  await rm(profile, { recursive: true, force: true });
}
