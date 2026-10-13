// Post-build checks on dist/: the prerendered HTML must carry the essential
// content (so the site reads without JavaScript), and every emitted asset is
// listed with its real gzip size — numbers for the README, not estimates.
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const exists = (file) =>
  access(path.join(dist, file)).then(
    () => true,
    () => false,
  );

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])));
  return files.flat();
}

const files = await walk(dist);
const code = (await Promise.all(files.filter((f) => /\.(js|css|html|svg|txt)$/.test(f)).map((f) => readFile(f, 'utf8')))).join('\n');

const required = [
  ['placeholder replaced', !html.includes('<!--app-html-->')],
  ['name', html.includes('Mohit Kumar')],
  ['role', html.includes('Software Engineer')],
  ['headline', html.replace(/<[^>]+>/g, '').includes('I build software that connects ideas to reality.')],
  ['primary navigation', html.includes('aria-label="Primary"')],
  ['skip link', html.includes('Skip to content')],
  ...['top', 'work', 'systems', 'experience', 'lab', 'about', 'contact'].map((id) => [`section #${id}`, html.includes(`id="${id}"`)]),
  ...['beamtransfer', 'ambiora', 'sggs-erp'].map((id) => [`project #project-${id}`, html.includes(`id="project-${id}"`)]),
  ['mailto link', html.includes('href="mailto:100mohit@gmail.com"')],
  ['GitHub link', html.includes('https://github.com/VibeWithMohit')],
  ['LinkedIn link', html.includes('https://www.linkedin.com/in/mohitkumar2822/')],
  ['stills in HTML', (html.match(/class="core-still"/g) ?? []).length === 4],
  ...(await Promise.all(
    ['core', 'beamtransfer', 'ambiora', 'sggs-erp'].flatMap((state) =>
      [1200, 640].map(async (size) => [`still ${state}-${size} emitted`, await exists(`poster/${state}-${size}.webp`)]),
    ),
  )),
  ['Inter emitted', await exists('fonts/inter-var.woff2')],
  ['no three.js in HTML', !/three\.module|WebGLRenderer/.test(html)],
  // The earlier lime/cyan direction must be gone from everything shipped.
  ['no lime or cyan accents', !/#cbff6a|#83d6ff|203 ?,? ?255 ?,? ?106|131 ?,? ?214 ?,? ?255|--lime|--cyan/i.test(code)],
  ['no retired typefaces', !/Archivo|Martian Mono/.test(code)],
];

let failed = 0;
for (const [label, ok] of required) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const rows = [];
for (const file of files) {
  if (!/\.(js|css|html|woff2|svg|webp)$/.test(file)) continue;
  const buffer = await readFile(file);
  rows.push({
    file: path.relative(dist, file),
    kb: (await stat(file)).size / 1024,
    gz: /\.(woff2|webp)$/.test(file) ? buffer.length / 1024 : gzipSync(buffer, { level: 9 }).length / 1024,
  });
}
rows.sort((a, b) => b.gz - a.gz);
console.log('\nAsset                                            raw KB   gzip KB');
for (const r of rows) console.log(`${r.file.padEnd(46)} ${r.kb.toFixed(1).padStart(8)} ${r.gz.toFixed(1).padStart(9)}`);

const entryScript = /<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"/.exec(html)?.[1];
const entryCss = /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"/.exec(html)?.[1];
const critical = rows.filter((r) => r.file === 'index.html' || r.file === entryScript || r.file === entryCss || r.file.startsWith('fonts/'));
const total = critical.reduce((sum, r) => sum + r.gz, 0);
console.log(`\nCritical path (HTML + entry JS + CSS + fonts): ${total.toFixed(1)} KB over the wire (gzip; fonts are already compressed)`);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll content checks passed.');
