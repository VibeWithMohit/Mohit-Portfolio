// Post-build step: inject the server-rendered app into dist/index.html so the
// page's text, navigation and links exist before any JavaScript runs, and
// inline the entry stylesheet so first paint needs no extra request.
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const templatePath = path.join(dist, 'index.html');
const ssrDir = path.join(root, 'dist-ssr');
const placeholder = '<!--app-html-->';

let html = await readFile(templatePath, 'utf8');
if (!html.includes(placeholder)) {
  throw new Error(`prerender: ${placeholder} not found in dist/index.html — was it already prerendered?`);
}

const { render } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href);
const appHtml = render();
if (!appHtml || appHtml.length < 1000) throw new Error('prerender: render() returned suspiciously little HTML');
html = html.replace(placeholder, appHtml);

// Inline the entry stylesheet (lazy chunks keep their own CSS files).
const stylesheet = /<link rel="stylesheet" crossorigin href="\/(assets\/[^"]+\.css)">/.exec(html);
if (!stylesheet) throw new Error('prerender: entry stylesheet link not found');
const css = await readFile(path.join(dist, stylesheet[1]), 'utf8');
if (css.includes('</style')) throw new Error('prerender: stylesheet cannot be inlined safely');
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);

await writeFile(templatePath, html);
// The inlined file is referenced nowhere else (checked: no JS chunk imports it).
await rm(path.join(dist, stylesheet[1]));
await rm(ssrDir, { recursive: true, force: true });

console.log(
  `prerender: dist/index.html — ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB with prerendered markup and ${(css.length / 1024).toFixed(1)} KB of inlined CSS`,
);
