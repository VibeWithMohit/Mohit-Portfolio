# SYSTEMS IN MOTION

The portfolio of **Mohit Kumar**, Software Engineer — Chandigarh, India.

*A living digital system.* One sculptural piece of liquid glass runs through the page: it is the hero, and
it is the opening of every project chapter — a light pipe for BeamTransfer, an arch for Ambiora, a glass
block for SGGS ERP — morphing from one form to the next as the visitor scrolls. Around it, a light
Apple-inspired Liquid Glass language: pearl and white surfaces, graphite type, frosted glass for navigation
and controls, kinetic typography and a moving line of expertise. Then three case studies with working figures,
a Systems Map backed by project evidence, Experience, a Lab of real in-browser experiments, About and Contact.

This is a **new, standalone project**, built from an empty directory. It shares no code, assets or
dependencies with the existing `VibeWithMohit/portfolio` repository, which was not touched. It is not yet a
git repository and has not been published anywhere.

---

## Quick start

Requires Node 20.19+ (built with Node 22.22). Google Chrome is needed only for the QA and still-rendering scripts.

```bash
npm install
npm run dev          # http://localhost:5173 — development server
npm run build        # type-check → client build → SSR build → prerender into dist/
npm run preview      # http://127.0.0.1:4173 — serve the production build
```

| Script | What it does |
| --- | --- |
| `npm run check` | Type-check (tsc), lint (oxlint, including jsx-a11y rules), unit tests (Vitest) |
| `npm run verify` | After a build: 32 assertions on `dist/` (every section, project and contact link prerendered; all eight stills and the font emitted; no lime/cyan or retired typefaces anywhere), plus real gzip sizes |
| `npm run test:keyboard` | With `preview` running: 19 keyboard, reduced-motion and no-JavaScript checks in headless Chrome |
| `npm run capture` | With `preview` running: screenshots of every section and figure at 1440, 1280, 834 and 390 px, plus console-error, overflow and pinned-navigation checks → `reports/screens/`. `GPU=1` renders WebGL on the real GPU |
| `npm run poster` | With `preview` running, on a machine with a GPU: renders the four stills of the sculpture from the live scene → `public/poster/`. Rebuild afterwards. `REVIEW=1` also writes full-size PNGs to `reports/sculpture/` |

`dist/` is a fully static site: one `index.html` with prerendered markup and inlined CSS, plus hashed assets.

---

## The page

| | Section | What it is |
| --- | --- | --- |
| 01 | **The Signal** | "MOHIT / SOFTWARE ENGINEER / I build software that connects ideas to reality." as prerendered HTML, arriving in stages; the glass sculpture; project chips that morph it; the expertise ticker |
| 02 | **Selected Work** | BeamTransfer, Ambiora Hotel & Resorts, SGGS ERP — each opening with the sculpture in its form, then a working figure and a conventional case study |
| 03 | **Systems Map** | Capabilities × projects as an accessible `<table>`; every row cites a project (enforced by a unit test) |
| 04 | **Experience** | Rankfirst Technology (since 22 Apr 2024) and education on a live timeline |
| 05 | **The Lab** | Lossy Channel (fountain codes), Perspective Rectifier (homography), Core Telemetry |
| 06 | **About** | Short biography, education and working principles |
| 07 | **Contact** | `mailto:`, copy-to-clipboard, GitHub, LinkedIn, local time; the résumé link appears once configured |

### The central visual system

One reusable component (`src/components/CoreLayer.tsx` + `src/three/`) with four states, as the brief asks:

| State | Form | The drawing it refracts |
| --- | --- | --- |
| Engineering Core | a thick, softly twisted glass tile | lens rings |
| BeamTransfer | a curved light pipe | a band of QR frames — a new frame twice a second — on a beam |
| Ambiora | an arch | a colonnade of arches at three depths, sliding at three rates with scroll |
| SGGS ERP | a rounded glass block | a network of nodes and paths, with packets in flight along them |

It is a **true continuous mesh morph**: every form is computed from the same sphere vertices (superquadrics,
twisted and bent, with analytic normals) and attached as morph targets, so the glass flows from one shape to
the next on spring physics. No separate models are loaded, and nothing is faked.

The sculpture lives on **one fixed, transparent canvas** between the page's backgrounds and its content. Any
element with `data-anchor="<state>"` — the hero, and the opening of each chapter — is a place it can appear;
it attaches to whichever anchor is on screen, in that anchor's form, arrives from slightly smaller and lower,
and lets go as the anchor leaves. Between anchors the canvas is hidden and nothing renders. Text sits above
the glass; glass controls (the chips, the navigation) blur it.

### Figures — what is real and how each is labelled

- **Fig. 02 BeamTransfer — Frame stream**: the four stages of a transfer (file selected → QR frames generated →
  camera capturing → file rebuilt) above a live simulation running a real LT fountain encoder/decoder
  (`src/lib/fountain/lt.ts`, unit-tested) with adjustable frame loss. Captioned as a visualisation: the frames
  are not scannable codes and this is not BeamTransfer's codec.
- **Fig. 03 Ambiora — Depth walk**: a working CSS 3D walk (scale-compensated layers in one perspective) with a
  camera-depth control on frosted glass and an exploded view that shows how it is built. Abstract art, captioned
  as a reconstruction of the technique; no production photography — none was supplied, so none is shown.
- **Fig. 04 SGGS ERP — System diagram**: interactive architecture at the level of the public description only;
  a glass lens glides to the selected component. No hostnames, environment variable names, schema, credentials or
  student data.
- **Lab**: *Lossy Channel*, *Perspective Rectifier* (an 8×8 homography solve, bilinear resampling and adaptive
  threshold on a synthetic photo, with glass corner handles) and *Core Telemetry* (live numbers from the
  sculpture's render loop). Each states that it is not production code.

---

## Design: Liquid Glass, translated for the web

The references — the SwiftUI Liquid Glass skill and Apple's HIG Materials — describe native iOS 26 APIs. None of
that is used here; the principles are translated into CSS and WebGL. The Anjali Agrawal portfolio was studied
for its kinetic typography, moving expertise strip and editorial rhythm; nothing from it is reproduced.

**Palette.** Pearl `#F5F4F0` and white surfaces, silver `#C9CDD2` and titanium `#858B94` for structure, graphite
ink `#1C1D21` for type and `#3A3D43` for primary actions. No colour accents: variation comes from light,
reflection, shadow and what is behind the glass. The brief's obsidian/graphite are used for type, buttons and the
glass's dark edges only — a dark studio was tried first and set aside after review.

**Glass is a functional layer, used sparingly** — the floating navigation, primary actions, small control panels
(the Systems Map segmented control, the Depth Walk camera bar, the contact links) and the hero sculpture.
Case-study text sits on solid "standard material" surfaces (`.surface`).

**The glass material** (`src/styles/glass.css`) is built in layers: a translucent white fill with a top-lit
thickness gradient; backdrop blur, saturation and brightness; an inner catch-light and a hairline; an illuminated
rim; a soft specular plus a pointer-tracked highlight; layered soft shadows. In Chromium the navigation bar also
**refracts** what passes beneath it, through an SVG displacement map inside `backdrop-filter`.

### The motion system

Five layers with different timing, spacing and roles — no component gets the same generic fade-up as the next:

1. **Ambient** — the sculpture's slow turn, bob and liquid undulation; the rings and packets of its drawing;
   the expertise ticker. Capped at 30 fps when nobody is interacting; off entirely with motion off.
2. **Typography** — the name rises through a clipping mask and tips up out of the page plane; the role
   tightens into its letter-spacing; the statement arrives word by word, each through its own mask; the chips
   stagger in; section and project titles tip up as they scroll in (`data-reveal="depth"`); figures are unmasked
   (`"clip"`); cards scale into place (`"scale"`); plain text rises (default).
3. **Interaction** — glass controls respond to pointer, touch and keyboard focus alike and press with a slight
   liquid overshoot; the primary actions are magnetic (they lean a few pixels towards a fine pointer); the
   navigation's lens morphs between links; hovering a chip morphs the sculpture.
4. **Scroll choreography** — the sculpture pitches and lifts as its anchor passes through the viewport, arrives
   at each chapter from slightly smaller and lower, and glides if two anchors hand over on screen; the drawing
   drifts, and the Ambiora colonnade parallaxes at three depths; figures rise out of the page plane
   (`DepthStage`). Native scrolling throughout — nothing is hijacked.
5. **Project demonstrations** — the frame stream, the depth walk and the system diagram, each a working thing.

**Readability, measured.** With the navigation parked over the busiest and darkest content on the page and the
pixels behind its labels sampled from real screenshots, label contrast is **14.1:1** (secondary labels **8.7:1**)
over the darkest photograph and **16.7:1** over white. Every text token pair is listed with its ratio in
`src/styles/tokens.css`. Reduce Transparency, Increase Contrast and forced colours all switch the glass to an
opaque material with a defined edge.

### How the sculpture is made to read as glass on white

Clear glass on a white page is nearly invisible, so the scene borrows two techniques from product photography:

1. **Something to refract.** The drawing behind the sculpture — rings, QR band, arches or network — is faint
   where you see it directly and bent and magnified *through* the glass.
2. **Bright-field lighting.** Photographers place dark cards just outside the frame so glass edges pick them up.
   Here the backdrop draws soft dark cards **only in the transmission pass** (what the glass refracts), never on
   screen; the environment the glass reflects has a dark back wall, so its silhouette turns into a fine line.

The backdrop is two full-screen quads: an opaque *studio* (page colour, glow, drawing, cards) that exists only to
be refracted, and a translucent *overlay* that draws the drawing's lines on screen. The page's own CSS provides
the colour, the glow and the contact shadow, so the canvas composites cleanly over pearl and white sections
alike. Physically based glass (`MeshPhysicalMaterial` with transmission, IOR 1.5, clear-coat, a whisper of
thin-film iridescence and, on desktop, dispersion); a studio environment baked once; a custom tone curve that
leaves the backdrop's range untouched; a camera offset so the sculpture lands exactly in each anchor's box — the
same box the still and the glow use.

---

## Decisions

### Stack (versions checked against the registry before installing)

| | Version | Why |
| --- | --- | --- |
| React | 19.3 | UI and hydration |
| TypeScript | 6.0 (`~6.0.3`) | TS 7 is out, but typescript-eslint still requires `<6.1` |
| Vite | 8.3 | Build, dev server, code splitting; also the SSR prerender build |
| three.js | 0.186 | The sculpture only, imported by name and loaded lazily |
| Vitest | 5.0 | Unit tests |
| oxlint | 1.87 | One fast binary: hooks rules, React Compiler-style checks and the jsx-a11y suite |

Runtime dependencies are **react, react-dom and three** — nothing else. The brief allows React Three Fiber and
GSAP/ScrollTrigger "if their current compatible versions suit the project"; both were evaluated and not used.
R3F registers the whole `THREE` namespace and adds a reconciler for what is one imperative object that needs
explicit control of its loop (render only on change, 30 fps ambient cap, on-demand with motion off, adaptive
pixel ratio, progressive start-up). GSAP would add ~40 KB for choreography that one passive scroll listener,
one IntersectionObserver and CSS transitions already do (`src/lib/scroll.ts`, `src/lib/reveal.ts`).

### Content first, 3D second

- **Prerendered HTML.** `vite build --ssr` + `scripts/prerender.mjs` render the whole app into `dist/index.html`,
  so all text, navigation and links paint before any JavaScript. The page reads fully with JavaScript disabled.
- **The entry CSS is inlined**, so nothing blocks rendering. **Inter** (variable, 300–700) is the only web font:
  self-hosted, subset, preloaded, with a metric-matched fallback face to avoid layout shift.
- **No preloader.** The hero shows a still of the sculpture immediately (25 KB, preloaded); each chapter opens
  with the still of its form (12–24 KB, lazy). The stills are rendered from the live scene by `scripts/poster.mjs`,
  on the page colour of the anchor that shows them. On capable devices the 3D starts in idle time and cross-fades
  in from the same pose:
  - *high* (desktop) — full material including dispersion, pixel ratio ≤ 1.5;
  - *medium* (tablets, small or 4-core laptops) — lighter mesh and transmission pass, pixel ratio ≤ 1.25;
  - *low* (phones, data saver, ≤ 2 GB memory) — the stills, plus a "View in 3D" button.
  Software WebGL is treated as unavailable. The capability probe's GPU context is handed to the renderer (one
  context, not two); sculpture forms are computed one per idle slice; shaders compile in parallel; the first draw
  gets a slice of its own while the canvas is still invisible. QA overrides: `?tier=high|medium|low`,
  `?core=static|3d`.
- **Rendering on demand.** Frames render only while an anchor is on screen and something changes; the canvas is
  hidden between anchors; ambient motion is capped at 30 fps; the pixel ratio adapts to sustained slow frames; a
  lost GPU context restores the stills.

### Motion and accessibility

- `prefers-reduced-motion` is honoured before first paint, and a **Motion switch** in the navigation pauses all
  ambient motion and persists the choice (WCAG 2.2.2). With motion off the sculpture renders single frames on
  change, the ticker becomes a static scrollable list, the intro collapses and magnetic buttons stay still.
- Skip link; landmarks and heading order; a native `<dialog>` phone menu (focus containment, Escape); in-page links
  move focus to their section; visible focus everywhere; interactive targets meet WCAG 2.5.8 (24 px), with
  navigation, primary actions and the Systems Map column links at 40–48 px; `aria-live` only for meaningful
  outcomes; the ticker's duplicate strip is hidden from assistive technology.

---

## Measured results

Production build served by `vite preview` on the development machine (Intel UHD Graphics CML GT2, Chrome,
Lighthouse 13.5.0, default throttling). Reports are in `reports/lighthouse/` (git-ignored).

| Lighthouse | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile (stills) | 99 | 100 | 100 | 100 | 1.4 s | 1.9 s | 40 ms | 0 | 192 KiB |
| Desktop, software GL (stills) | 100 | 100 | 100 | 100 | 0.3 s | 0.4 s | 0 ms | 0 | 237 KiB |
| Desktop, real GPU (live 3D) | 83–89¹ | 100 | 100 | 100 | 0.3 s | 0.5 s | 280–390 ms¹ | 0 | 372 KiB |

¹ Range across runs. The blocking time is the sculpture's one-off set-up after load, on a machine whose GPU
process starts cold for every headless run (see below); it does not recur, and nothing in it is on the critical
path for text or interaction. The only best-practices note is Lighthouse asking for source maps.

**Bundles** (`npm run verify`, gzip):

| Asset | gzip |
| --- | --- |
| `index.html` — prerendered markup and inlined CSS | 24.4 KB |
| Entry JS (React + app) | 91.6 KB |
| Inter (variable) | 50.8 KB |
| **Critical path total** | **166.9 KB** |
| Hero still (WebP, preloaded) | 25.0 KB desktop · 11.4 KB phones |
| Chapter stills (lazy) | 23.5 + 19.0 + 12.1 KB desktop · 11.4 + 8.3 + 5.6 KB phones |
| Sculpture — three.js, lazy, tablet/desktop only | 133.9 KB |
| Rectifier — lazy | 4.4 KB + 1.2 KB CSS |
| Lossy Channel — lazy | 2.2 KB + 1.1 KB CSS |

**Sculpture start-up on the real GPU** (User Timing marks, visible in DevTools › Performance; typical values
across runs): WebGL context 180–270 ms (the first GPU use in a cold headless Chrome) · module 42 ms · scene
29–42 ms · four forms 26–42 ms each, in separate idle slices · studio environment 80–115 ms · shader compile
≈ 500–590 ms in parallel, off the main thread · first draw 140–190 ms in its own slice. Afterwards rendering is
on demand; Core Telemetry in the Lab shows it live, and the count stands still while the sculpture is off-screen.

**QA status**: 27/27 unit tests · oxlint with 0 findings · 32/32 build assertions · 19/19 keyboard and resilience
checks · zero console errors and zero horizontal overflow at 1440, 1280, 834 and 390 px, with the sculpture live
at the first three and the stills at 390 px.

---

## Content — verified vs. to confirm

Identity, employer, dates, education and the three projects come from the brief. Nothing has been invented: no
metrics, clients, links or achievements. Where a statement explains a technique (what a fountain code or
environment-driven configuration *is*), it is phrased as general engineering, not as a measured result.

**Copy written for this site — please review** (in `src/content/` and `src/sections/about/About.tsx`): the
project taglines and "insight" notes, the section ledes, the About statement and biography, and the four *Working
principles*. The ticker lists the Systems Map's capabilities verbatim.

**Information to add once confirmed** — the UI already handles each case:

- **Role highlights** at Rankfirst → `src/content/experience.ts` (`highlights: []` renders nothing).
- **Résumé** → put the PDF in `public/` and set `resumeUrl` in `src/content/profile.ts`; the hero and Contact
  links appear.
- **Project links and live demos** (repositories, sites, store pages) — none are shown until verified.
- **Ambiora screenshots** — the brief asks for real ones when available; none were supplied, so the figure stays
  abstract and says so.
- **Staffify, Talksy, Fittoo** — omitted until there are verified descriptions.
- **Canonical URL / Open Graph image** — need the final domain.

---

## Project structure

```
index.html                  shell: meta, JSON-LD, font + hero-still preloads, pre-paint motion script
public/                     Inter (+ OFL licence), the four stills × two sizes, favicon, robots.txt, llms.txt
scripts/
  prerender.mjs             SSR → dist/index.html, inline entry CSS
  verify-dist.mjs           build assertions + real gzip sizes
  capture.mjs               responsive screenshots & checks (Chrome DevTools protocol)
  a11y-keyboard.mjs         keyboard, reduced-motion and no-JS checks
  poster.mjs                renders the stills from the live scene (GPU)
src/
  content/                  profile, sections, projects, systems, experience (+ integrity tests)
  styles/                   fonts, tokens (with measured contrast), base (reveal variants, layering), glass
  lib/                      scroll engine, reveal, motion, device tiers + WebGL probe, telemetry, coreStore,
                            glass pointer, magnetic, fountain/lt.ts (LT codec), geometry/homography.ts (+ tests)
  components/               CoreLayer (the sculpture canvas), CoreStill, Ticker, glass navigation + menu dialog,
                            refraction filter, motion switch, section heads, figure, lazy mount
  sections/
    signal/                 hero: typography choreography, the hero anchor, project chips
    work/                   SelectedWork (chapter openings with anchors), BeamStream, DepthWalk, ErpDiagram
    systems/ experience/ lab/ about/ contact/
  three/                    liquidCore.ts (renderer, anchors, loop, morphs), sculpture.ts (forms),
                            environment.ts (studio, backdrop quads), types.ts
```

---

## Deploying later

- `dist/` is static and assumes the domain root (fonts, stills and the favicon use absolute `/…` paths). For a
  sub-path (for example GitHub Pages project pages), set Vite's `base`.
- With a strict Content-Security-Policy, allow the two inline scripts (motion pre-paint, JSON-LD) and the inline
  `<style>` by hash, or remove the CSS-inlining step in `scripts/prerender.mjs`.
- Once the domain is known: add `<link rel="canonical">`, `og:url` and an `og:image` (1200×630) to `index.html`,
  and a sitemap line to `public/robots.txt`.
- Hashed files in `dist/assets/` can be cached long-term; `index.html` should be revalidated. If the sculpture,
  its lighting or a section's colour changes, run `npm run poster` so the stills keep matching.

## Licences

Code: © Mohit Kumar. Inter: SIL Open Font License 1.1 (see `public/fonts/OFL-Inter.txt`).
