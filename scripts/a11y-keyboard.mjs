// Keyboard QA: drives a local Chrome over the DevTools protocol with real
// key events and asserts the things a keyboard or screen-reader user needs:
// the skip link comes first and works, focus is always visible, in-page links
// move focus to their section, and the phone menu traps focus and closes on
// Escape, returning focus to its button. Also checks the page reads without
// JavaScript and honours prefers-reduced-motion.
//
//   npm run build && npm run preview     (in one terminal)
//   npm run test:keyboard                (in another)
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SITE = process.env.SITE_URL ?? 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH ?? 'google-chrome';
const PORT = 9800 + Math.floor(Math.random() * 150);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const profile = await mkdtemp(path.join(os.tmpdir(), 'sim-keys-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

try {
  let version;
  for (let i = 0; i < 60 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    } catch {
      await sleep(150);
    }
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let nextId = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    } else waiters.get(msg.method)?.(msg.params);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const key = async (name, code = name, keyCode = 0, modifiers = 0) => {
    // A real Enter carries text: buttons activate on the keypress it produces.
    const text = name === 'Enter' ? '\r' : undefined;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers, text });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
    await sleep(120);
  };
  const tab = (shift = false) => key('Tab', 'Tab', 9, shift ? 8 : 0);
  const focused = () =>
    evaluate(`(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 48), id: el.id, ring, visible: el.matches(':focus-visible') };
    })()`);
  const load = async (url, metrics) => {
    await send('Emulation.setDeviceMetricsOverride', metrics);
    const loaded = new Promise((resolve) => waiters.set('Page.loadEventFired', resolve));
    await send('Page.navigate', { url });
    await loaded;
    await sleep(1200);
  };
  await send('Page.enable');
  await send('Runtime.enable');

  // ── Desktop: skip link, focus order, in-page navigation ─────────────────
  const desktop = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
  await load(SITE, desktop);
  await tab();
  let f = await focused();
  check('first Tab lands on the skip link', f.text === 'Skip to content', JSON.stringify(f.text));
  check('skip link shows a visible focus indicator', f.ring && f.visible);
  await key('Enter', 'Enter', 13);
  f = await focused();
  check('activating the skip link moves focus to <main>', f.tag === 'main' && f.id === 'main', `${f.tag}#${f.id}`);

  await load(SITE, desktop);
  const order = [];
  let missingRing = 0;
  for (let i = 0; i < 18; i++) {
    await tab();
    f = await focused();
    order.push(`${f.tag}:${f.text}`);
    if (!f.ring) missingRing++;
  }
  console.log(`      focus order: ${order.slice(0, 14).join(' → ')} …`);
  check('every focused control in the first 18 stops shows a focus ring', missingRing === 0, `${missingRing} without`);
  check('primary navigation is reachable in order', order.some((o) => o.includes('Work')) && order.some((o) => o.includes('About')));

  // Focus the "Selected work" call to action and activate it.
  await evaluate(`document.querySelector('.hero__actions a[href="#work"]').focus()`);
  await key('Enter', 'Enter', 13);
  await sleep(900);
  f = await focused();
  check('in-page link moves focus to its section', f.id === 'work', `focused #${f.id}`);
  const hash = await evaluate('location.hash');
  check('URL hash follows in-page navigation', hash === '#work', hash);

  // ── Phone: menu dialog ──────────────────────────────────────────────────
  const phone = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };
  await load(SITE, phone);
  await evaluate(`document.querySelector('.site-header__menu').focus()`);
  await key('Enter', 'Enter', 13);
  await sleep(300);
  const open = await evaluate(`document.getElementById('site-menu').open`);
  check('Menu button opens the menu dialog', open === true);
  const expanded = await evaluate(`document.querySelector('.site-header__menu').getAttribute('aria-expanded')`);
  check('Menu button reports aria-expanded="true"', expanded === 'true', expanded);
  // A modal <dialog> makes the page inert. Tabbing past its last control may
  // hand focus to the browser UI (the document body here) — never to page content.
  let escapedTo = null;
  for (let i = 0; i < 14; i++) {
    await tab();
    const where = await evaluate(`(() => {
      const el = document.activeElement;
      if (document.getElementById('site-menu').contains(el) || el === document.body) return null;
      return el.tagName.toLowerCase() + ':' + (el.textContent || '').trim().slice(0, 30);
    })()`);
    if (where) escapedTo = where;
  }
  check('focus never reaches page content behind the open menu', escapedTo === null, escapedTo ?? '');
  await key('Escape', 'Escape', 27);
  await sleep(300);
  const closed = await evaluate(`!document.getElementById('site-menu').open`);
  f = await focused();
  check('Escape closes the menu', closed);
  check('focus returns to the Menu button', f.text.includes('Menu'), f.text);

  // ── Reduced motion ──────────────────────────────────────────────────────
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load(SITE, desktop);
  const motion = await evaluate(`({ attr: document.documentElement.dataset.motion, smooth: getComputedStyle(document.documentElement).scrollBehavior, rise: getComputedStyle(document.querySelector('.hero__name')).animationDuration })`);
  check('prefers-reduced-motion switches site motion off', motion.attr === 'off', JSON.stringify(motion));
  check('no smooth scrolling under reduced motion', motion.smooth === 'auto');
  check('intro animations collapse under reduced motion', parseFloat(motion.rise) < 0.01, motion.rise);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // ── Without JavaScript ──────────────────────────────────────────────────
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await load(SITE, desktop);
  const noJs = await evaluate(`({
    h1: document.querySelector('h1')?.textContent.trim().slice(0, 40),
    sections: ['work','systems','experience','lab','about','contact'].filter((id) => document.getElementById(id)).length,
    hiddenReveals: [...document.querySelectorAll('[data-reveal]')].filter((el) => getComputedStyle(el).opacity === '0').length,
    mailto: !!document.querySelector('a[href^="mailto:"]'),
  })`).catch(() => null);
  // With scripts disabled Runtime.evaluate still runs (it is the debugger, not the page).
  check('without JavaScript: headline is present', !!noJs?.h1, noJs?.h1);
  check('without JavaScript: all six sections are present', noJs?.sections === 6, String(noJs?.sections));
  check('without JavaScript: nothing is hidden by the reveal system', noJs?.hiddenReveals === 0, String(noJs?.hiddenReveals));
  check('without JavaScript: email link works', noJs?.mailto === true);
  await send('Emulation.setScriptExecutionDisabled', { value: false });

  ws.close();
} finally {
  chrome.kill('SIGTERM');
  await sleep(300);
  await rm(profile, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} keyboard and resilience checks passed`);
process.exitCode = failed ? 1 : 0;
