import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { isConvexQuad, solveHomography, type Mat3, type Point } from '../../lib/geometry/homography';
import { mulberry32 } from '../../lib/random';
import './rectifier.css';

/**
 * Experiment 02 — Perspective Rectifier. A synthetic photo of a page is made
 * by warping a flat document through a homography; you place four corners
 * and the page is resampled back through the homography solved from them.
 * Everything runs on the CPU in this tab: an 8×8 linear solve, bilinear
 * sampling and (optionally) an adaptive threshold built on an integral image.
 */
const PHOTO_W = 640;
const PHOTO_H = 480;
const DOC_W = 420;
const DOC_H = 594; // 1 : √2
const OUT_W = 300;
const OUT_H = 424;

/** Where the page actually sits in the generated photo (TL, TR, BR, BL). */
const PAGE_QUAD: Point[] = [
  { x: 156, y: 56 },
  { x: 508, y: 104 },
  { x: 548, y: 430 },
  { x: 88, y: 394 },
];

/** Deliberately rough starting guess. */
const START_QUAD: Point[] = [
  { x: 118, y: 84 },
  { x: 522, y: 72 },
  { x: 528, y: 412 },
  { x: 112, y: 420 },
];

const CORNERS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

type Filter = 'original' | 'gray' | 'document';

const OUT_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: OUT_W, y: 0 },
  { x: OUT_W, y: OUT_H },
  { x: 0, y: OUT_H },
];

/* ── Synthetic source ─────────────────────────────────────────────────── */
function drawDocument(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = DOC_W;
  canvas.height = DOC_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, DOC_W, DOC_H);

  ctx.fillStyle = '#17181d';
  ctx.font = '700 26px Inter, Arial, sans-serif';
  ctx.fillText('FIELD NOTES', 34, 66);
  ctx.font = '500 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.fillStyle = '#5b5c63';
  ctx.fillText('SYSTEMS IN MOTION · LAB SHEET 02', 34, 90);
  ctx.fillStyle = '#17181d';
  ctx.fillRect(34, 104, DOC_W - 68, 2);

  const lines = [
    'A homography maps one plane onto another.',
    'Four point pairs give eight equations for',
    'eight unknowns — enough to solve it exactly.',
    '',
    'Resample every output pixel through it and',
    'the page stands up straight again.',
  ];
  ctx.font = '400 14px Inter, Arial, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 34, 140 + i * 24));

  // A small table.
  const top = 300;
  ctx.strokeStyle = '#17181d';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, top, DOC_W - 68, 120);
  for (let r = 1; r < 4; r++) {
    ctx.beginPath();
    ctx.moveTo(34, top + r * 30);
    ctx.lineTo(DOC_W - 34, top + r * 30);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(180, top);
  ctx.lineTo(180, top + 120);
  ctx.stroke();
  ctx.font = '500 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  [
    ['STEP', 'OPERATION'],
    ['01', 'Place four corners'],
    ['02', 'Solve 8×8 system'],
    ['03', 'Resample + filter'],
  ].forEach(([a, b], r) => {
    ctx.fillText(a!, 46, top + 20 + r * 30);
    ctx.fillText(b!, 192, top + 20 + r * 30);
  });

  // Finder-style registration square and a signature stroke.
  ctx.fillRect(DOC_W - 96, DOC_H - 96, 56, 56);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(DOC_W - 88, DOC_H - 88, 40, 40);
  ctx.fillStyle = '#17181d';
  ctx.fillRect(DOC_W - 80, DOC_H - 80, 24, 24);
  ctx.strokeStyle = '#232838';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, DOC_H - 70);
  ctx.bezierCurveTo(80, DOC_H - 110, 110, DOC_H - 30, 150, DOC_H - 72);
  ctx.bezierCurveTo(170, DOC_H - 95, 190, DOC_H - 60, 220, DOC_H - 74);
  ctx.stroke();
  return canvas;
}

function bilinear(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Float32Array): boolean {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return false;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 3; c++) {
    const top = src[i00 + c]! * (1 - fx) + src[i10 + c]! * fx;
    const bottom = src[i01 + c]! * (1 - fx) + src[i11 + c]! * fx;
    out[c] = top * (1 - fy) + bottom * fy;
  }
  return true;
}

/** Warp the flat document into PAGE_QUAD over a desk — our "photograph". */
function renderPhoto(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const desk = ctx.createLinearGradient(0, 0, PHOTO_W, PHOTO_H);
  desk.addColorStop(0, '#c2b298');
  desk.addColorStop(1, '#8f7e66');
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.strokeStyle = 'rgba(70, 48, 26, 0.07)';
  for (let y = 6; y < PHOTO_H; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(PHOTO_W * 0.3, y + 6, PHOTO_W * 0.6, y - 6, PHOTO_W, y + 3);
    ctx.stroke();
  }
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  PAGE_QUAD.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 10, p.y + 14) : ctx.lineTo(p.x + 10, p.y + 14)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const photo = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H);
  const docData = drawDocument().getContext('2d')!.getImageData(0, 0, DOC_W, DOC_H).data;
  const toDoc = solveHomography(PAGE_QUAD, [
    { x: 0, y: 0 },
    { x: DOC_W, y: 0 },
    { x: DOC_W, y: DOC_H },
    { x: 0, y: DOC_H },
  ]);
  const px = new Float32Array(3);
  const noise = mulberry32(42);
  const minX = Math.floor(Math.min(...PAGE_QUAD.map((p) => p.x)));
  const maxX = Math.ceil(Math.max(...PAGE_QUAD.map((p) => p.x)));
  const minY = Math.floor(Math.min(...PAGE_QUAD.map((p) => p.y)));
  const maxY = Math.ceil(Math.max(...PAGE_QUAD.map((p) => p.y)));
  const [a, b, c, d, e, f, g, h, i] = toDoc;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w = g * x + h * y + i;
      const u = (a * x + b * y + c) / w;
      const v = (d * x + e * y + f) / w;
      if (!bilinear(docData, DOC_W, DOC_H, u, v, px)) continue;
      // Uneven light: brighter toward the top-left, as from a desk lamp.
      const light = 0.8 + 0.22 * (1 - y / PHOTO_H) - 0.1 * (x / PHOTO_W);
      const grain = (noise() - 0.5) * 10;
      const o = (y * PHOTO_W + x) * 4;
      photo.data[o] = px[0]! * light * 0.98 + grain;
      photo.data[o + 1] = px[1]! * light * 0.95 + grain;
      photo.data[o + 2] = px[2]! * light * 0.88 + grain;
    }
  }
  return photo;
}

/* ── Rectification and filters ────────────────────────────────────────── */
function rectify(photo: ImageData, H: Mat3, out: ImageData): void {
  const [a, b, c, d, e, f, g, h, i] = H;
  const src = photo.data;
  const dst = out.data;
  const px = new Float32Array(3);
  for (let v = 0; v < OUT_H; v++) {
    for (let u = 0; u < OUT_W; u++) {
      const x0 = u + 0.5;
      const y0 = v + 0.5;
      const w = g * x0 + h * y0 + i;
      const o = (v * OUT_W + u) * 4;
      if (bilinear(src, PHOTO_W, PHOTO_H, (a * x0 + b * y0 + c) / w, (d * x0 + e * y0 + f) / w, px)) {
        dst[o] = px[0]!;
        dst[o + 1] = px[1]!;
        dst[o + 2] = px[2]!;
      } else {
        dst[o] = dst[o + 1] = dst[o + 2] = 20;
      }
      dst[o + 3] = 255;
    }
  }
}

function applyFilter(image: ImageData, filter: Filter): void {
  if (filter === 'original') return;
  const { data, width, height } = image;
  const gray = new Float32Array(width * height);
  for (let p = 0; p < gray.length; p++) {
    gray[p] = data[p * 4]! * 0.299 + data[p * 4 + 1]! * 0.587 + data[p * 4 + 2]! * 0.114;
  }
  if (filter === 'gray') {
    for (let p = 0; p < gray.length; p++) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = gray[p]!;
    return;
  }
  // Adaptive threshold (Bradley–Roth): compare each pixel to its local mean,
  // read in O(1) from an integral image — robust to the uneven lighting.
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + row;
    }
  }
  const r = 12;
  const t = 0.14;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      const sum = integral[y1 * stride + x1]! - integral[y0 * stride + x1]! - integral[y1 * stride + x0]! + integral[y0 * stride + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const ink = gray[y * width + x]! < mean * (1 - t);
      const o = (y * width + x) * 4;
      data[o] = ink ? 24 : 250;
      data[o + 1] = ink ? 24 : 248;
      data[o + 2] = ink ? 30 : 242;
    }
  }
}

/** Corners of the page found as extreme points of the bright region. */
function detectPage(photo: ImageData): Point[] | null {
  const { data } = photo;
  let tl: Point | null = null;
  let tr: Point | null = null;
  let br: Point | null = null;
  let bl: Point | null = null;
  for (let y = 0; y < PHOTO_H; y += 2) {
    for (let x = 0; x < PHOTO_W; x += 2) {
      const o = (y * PHOTO_W + x) * 4;
      const lum = data[o]! * 0.299 + data[o + 1]! * 0.587 + data[o + 2]! * 0.114;
      if (lum < 150) continue;
      if (!tl || x + y < tl.x + tl.y) tl = { x, y };
      if (!br || x + y > br.x + br.y) br = { x, y };
      if (!tr || x - y > tr.x - tr.y) tr = { x, y };
      if (!bl || x - y < bl.x - bl.y) bl = { x, y };
    }
  }
  return tl && tr && br && bl ? [tl, tr, br, bl] : null;
}

const fmt = (n: number) => (Math.abs(n) < 0.01 && n !== 0 ? n.toExponential(1) : n.toFixed(3));

/* ── Component ─────────────────────────────────────────────────────────── */
export default function Rectifier() {
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<ImageData | null>(null);
  const outRef = useRef<ImageData | null>(null);
  const dragRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const [quad, setQuad] = useState<Point[]>(START_QUAD);
  const [filter, setFilter] = useState<Filter>('original');
  const [showGrid, setShowGrid] = useState(true);
  const [matrix, setMatrix] = useState<Mat3 | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const helpId = useId();
  const convex = isConvexQuad(quad);

  useEffect(() => {
    const photo = renderPhoto();
    photoRef.current = photo;
    photoCanvasRef.current?.getContext('2d')?.putImageData(photo, 0, 0);
    outRef.current = new ImageData(OUT_W, OUT_H);
    // No state update needed: the rectification effect below is declared
    // after this one, so on mount it runs once the photo exists.
  }, []);

  useEffect(() => {
    const photo = photoRef.current;
    const out = outRef.current;
    if (!photo || !out || !convex) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      try {
        const H = solveHomography(OUT_CORNERS, quad);
        rectify(photo, H, out);
        applyFilter(out, filter);
        outCanvasRef.current?.getContext('2d')?.putImageData(out, 0, 0);
        setMatrix(H);
      } catch {
        // Degenerate corner placement — keep the previous result.
      }
    });
    return () => cancelAnimationFrame(frameRef.current);
  }, [quad, filter, convex]);

  const toPhoto = useCallback((clientX: number, clientY: number): Point | null => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.round(Math.min(PHOTO_W, Math.max(0, ((clientX - rect.left) / rect.width) * PHOTO_W))),
      y: Math.round(Math.min(PHOTO_H, Math.max(0, ((clientY - rect.top) / rect.height) * PHOTO_H))),
    };
  }, []);

  const moveCorner = (index: number, point: Point) =>
    setQuad((q) => q.map((p, i) => (i === index ? point : p)));

  const onPointerDown = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = index;
  };
  const onPointerMove = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current !== index) return;
    const point = toPhoto(event.clientX, event.clientY);
    if (point) moveCorner(index, point);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const p = quad[index]!;
    const next = {
      x: Math.min(PHOTO_W, Math.max(0, p.x + move[0])),
      y: Math.min(PHOTO_H, Math.max(0, p.y + move[1])),
    };
    moveCorner(index, next);
    setAnnouncement(`${CORNERS[index]} corner at ${next.x}, ${next.y}`);
  };

  const detect = () => {
    const found = photoRef.current ? detectPage(photoRef.current) : null;
    if (found) {
      setQuad(found);
      setAnnouncement('Page corners detected');
    } else {
      setAnnouncement('No page found');
    }
  };

  // Grid lines of the output, mapped into the photo (straight lines stay straight).
  const gridLines: [Point, Point][] = [];
  if (matrix && convex && showGrid) {
    const H = matrix;
    const map = (p: Point): Point => {
      const w = H[6] * p.x + H[7] * p.y + H[8];
      return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
    };
    for (let k = 1; k < 6; k++) {
      gridLines.push([map({ x: (OUT_W * k) / 6, y: 0 }), map({ x: (OUT_W * k) / 6, y: OUT_H })]);
      gridLines.push([map({ x: 0, y: (OUT_H * k) / 6 }), map({ x: OUT_W, y: (OUT_H * k) / 6 })]);
    }
  }

  return (
    <div className="rectifier">
      <div className="rectifier__panes">
        <div className="rectifier__pane">
          <p className="label rectifier__label">Input · synthetic photo</p>
          <div ref={stageRef} className="rectifier__stage">
            <canvas
              ref={photoCanvasRef}
              width={PHOTO_W}
              height={PHOTO_H}
              className="rectifier__photo"
              role="img"
              aria-label="A photo of a printed page lying at an angle on a wooden desk."
            />
            <svg className="rectifier__overlay" viewBox={`0 0 ${PHOTO_W} ${PHOTO_H}`} aria-hidden="true">
              {gridLines.map(([p, q], k) => (
                <line key={k} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="rectifier__grid" />
              ))}
              <polygon
                points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
                className={`rectifier__quad${convex ? '' : ' is-invalid'}`}
              />
            </svg>
            {quad.map((p, index) => (
              <button
                key={CORNERS[index]}
                type="button"
                className="rectifier__handle"
                style={{ left: `${(p.x / PHOTO_W) * 100}%`, top: `${(p.y / PHOTO_H) * 100}%` }}
                aria-label={`${CORNERS[index]} corner, at ${p.x}, ${p.y}`}
                aria-describedby={helpId}
                onPointerDown={onPointerDown(index)}
                onPointerMove={onPointerMove(index)}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown(index)}
              >
                <span className="rectifier__handle-dot" />
              </button>
            ))}
          </div>
          <p id={helpId} className="rectifier__help">
            Drag the four handles onto the page corners, or focus one and use the arrow keys (Shift for bigger steps).
          </p>
        </div>

        <div className="rectifier__pane rectifier__pane--out">
          <p className="label rectifier__label">Output · rectified {OUT_W}×{OUT_H}</p>
          <div className="rectifier__out-frame">
            <canvas
              ref={outCanvasRef}
              width={OUT_W}
              height={OUT_H}
              className="rectifier__out"
              role="img"
              aria-label="The page after perspective correction."
            />
            {!convex && <p className="rectifier__warning">Corners must form a convex shape.</p>}
          </div>
        </div>
      </div>

      <div className="rectifier__controls">
        <button type="button" className="button button--small glass glass--prominent glass--interactive" onClick={detect}>
          Detect page
        </button>
        <button type="button" className="button button--small button--quiet" onClick={() => setQuad(START_QUAD)}>
          <Icon name="reset" className="icon" />
          Reset corners
        </button>
        <button type="button" className="button button--small button--quiet" aria-pressed={showGrid} onClick={() => setShowGrid((v) => !v)}>
          Projected grid
        </button>
        <fieldset className="rectifier__filters">
          <legend className="label">Filter</legend>
          {(
            [
              ['original', 'Original'],
              ['gray', 'Grayscale'],
              ['document', 'Document'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="rectifier-filter" value={value} checked={filter === value} onChange={() => setFilter(value)} />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      {matrix && (
        <figure className="rectifier__matrix">
          <figcaption className="label">Solved homography H (output → photo)</figcaption>
          <table>
            <tbody>
              {[0, 1, 2].map((row) => (
                <tr key={row}>
                  {[0, 1, 2].map((col) => (
                    <td key={col}>
                      {fmt(matrix[row * 3 + col]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
