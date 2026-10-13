import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { LTDecoder, LTEncoder, type Droplet } from '../../lib/fountain/lt';
import { useHydrated, useMotion } from '../../lib/motion-context';
import { hash32, mulberry32 } from '../../lib/random';
import { useInView, usePageVisible } from '../../lib/useInView';
import './beam-stream.css';

/**
 * Fig. 02 — the BeamTransfer pipeline as a live simulation. A real LT
 * encoder (src/lib/fountain/lt.ts) streams droplets as frames from a sender
 * screen, across an optical gap that drops a configurable share of them, into
 * a receiving camera whose peeling decoder rebuilds the file block by block.
 * The frame graphics are visualisations of each droplet, not scannable codes.
 */
const BLOCK_SIZE = 8;
const BLOCKS = 24;
const EMIT_MS = 230;
const TRAVEL_MS = 860;
const HOLD_MS = 2800;
const MODULES = 21;

const WHITE = '#ffffff';
const SCREEN = '#ebeae5';
const INK = '#1c1d21';
const GRAPHITE = '#3a3d43';
const MUTE = '#656a72';
const LINE = 'rgba(28, 29, 33, 0.18)';
const FONT = 'Inter, "Inter Fallback", system-ui, sans-serif';

const SOURCE_TEXT =
  'BeamTransfer: files carried by light, fountain-coded into frames and rebuilt from whatever the camera catches. ';

const FILE = (() => {
  const bytes = new TextEncoder().encode(SOURCE_TEXT);
  return Uint8Array.from({ length: BLOCK_SIZE * BLOCKS }, (_, i) => bytes[i % bytes.length]!);
})();

interface Flight {
  droplet: Droplet;
  t: number;
  lost: boolean;
}

interface Sim {
  encoder: LTEncoder;
  decoder: LTDecoder;
  channel: () => number;
  next: number;
  emitClock: number;
  flights: Flight[];
  sent: number;
  lost: number;
  received: number;
  current: Droplet | null;
  captured: Droplet | null;
  captureGlow: number;
  solvedAt: Float64Array;
  clock: number;
  doneAt: number | null;
}

function createSim(seed: number): Sim {
  const encoder = new LTEncoder(FILE, BLOCK_SIZE, seed);
  return {
    encoder,
    decoder: new LTDecoder(encoder.k, BLOCK_SIZE, FILE.length),
    channel: mulberry32(seed ^ 0x5bd1e995),
    next: 0,
    emitClock: EMIT_MS,
    flights: [],
    sent: 0,
    lost: 0,
    received: 0,
    current: null,
    captured: null,
    captureGlow: 0,
    solvedAt: new Float64Array(encoder.k).fill(-1),
    clock: 0,
    doneAt: null,
  };
}

/** Advance the simulation by dt ms. Returns true when counters changed. */
function advance(sim: Sim, dt: number, loss: number): boolean {
  sim.clock += dt;
  if (sim.doneAt !== null) return false;
  let changed = false;

  sim.emitClock += dt;
  while (sim.emitClock >= EMIT_MS) {
    sim.emitClock -= EMIT_MS;
    const droplet = sim.encoder.droplet(sim.next++);
    sim.flights.push({ droplet, t: 0, lost: sim.channel() < loss });
    sim.current = droplet;
    sim.sent++;
    changed = true;
  }

  sim.captureGlow = Math.max(0, sim.captureGlow - dt / 420);
  for (const flight of sim.flights) flight.t += dt / TRAVEL_MS;

  while (sim.flights.length > 0 && sim.flights[0]!.t >= 1) {
    const flight = sim.flights.shift()!;
    changed = true;
    if (flight.lost) {
      sim.lost++;
      continue;
    }
    sim.received++;
    for (const index of sim.decoder.add(flight.droplet)) sim.solvedAt[index] = sim.clock;
    sim.captured = flight.droplet;
    sim.captureGlow = 1;
    if (sim.decoder.complete) {
      sim.doneAt = sim.clock;
      sim.flights = [];
      break;
    }
  }
  return changed;
}

/* ── Frame graphics (cached per droplet) ─────────────────────────────── */
const frameCache = new Map<number, HTMLCanvasElement>();

function isFinder(i: number, j: number): boolean {
  const n = MODULES;
  return (i < 7 && j < 7) || (i >= n - 7 && j < 7) || (i < 7 && j >= n - 7);
}

function finderOn(i: number, j: number): boolean {
  const n = MODULES;
  const x = i >= n - 7 ? i - (n - 7) : i;
  const y = j >= n - 7 ? j - (n - 7) : j;
  const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
  return ring !== 2;
}

function frameImage(droplet: Droplet): HTMLCanvasElement {
  const cached = frameCache.get(droplet.seed);
  if (cached) return cached;
  const px = 4;
  const quiet = 2;
  const size = (MODULES + quiet * 2) * px;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = INK;
  for (let i = 0; i < MODULES; i++) {
    for (let j = 0; j < MODULES; j++) {
      let on: boolean;
      if (isFinder(i, j)) on = finderOn(i, j);
      else {
        const payloadBit = (droplet.data[(i * MODULES + j) % droplet.data.length]! >> ((i + j) % 8)) & 1;
        on = ((hash32(droplet.seed, i, j) & 1) ^ payloadBit) === 1;
      }
      if (on) ctx.fillRect((i + quiet) * px, (j + quiet) * px, px, px);
    }
  }
  frameCache.set(droplet.seed, canvas);
  if (frameCache.size > 48) frameCache.delete(frameCache.keys().next().value!);
  return canvas;
}

/* ── Layout and drawing ──────────────────────────────────────────────── */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  sender: Rect;
  receiver: Rect;
  senderScreen: Rect;
  receiverScreen: Rect;
  senderGrid: Rect;
  receiverGrid: Rect;
  a: { x: number; y: number };
  b: { x: number; y: number };
  frame: number;
  vertical: boolean;
}

function deviceParts(device: Rect): { screen: Rect; grid: Rect } {
  const inset = 12;
  if (device.w >= device.h) {
    // Landscape device: screen on the left, block grid on the right.
    const side = device.h - inset * 2 - 14;
    const screen = { x: device.x + inset, y: device.y + inset + 14, w: side, h: side };
    const grid = { x: screen.x + side + inset, y: screen.y, w: device.w - side - inset * 3, h: side };
    return { screen, grid };
  }
  const side = device.w - inset * 2;
  const screen = { x: device.x + inset, y: device.y + inset + 14, w: side, h: side };
  const grid = { x: screen.x, y: screen.y + side + inset, w: side, h: device.y + device.h - (screen.y + side + inset) - inset };
  return { screen, grid };
}

function computeLayout(w: number, h: number): Layout {
  const vertical = w < 560;
  const pad = vertical ? 14 : 18;
  let sender: Rect;
  let receiver: Rect;
  if (!vertical) {
    const devH = h - pad * 2;
    const devW = Math.min(devH * 0.66, w * 0.25);
    sender = { x: pad, y: pad, w: devW, h: devH };
    receiver = { x: w - pad - devW, y: pad, w: devW, h: devH };
  } else {
    const devW = w - pad * 2;
    const devH = Math.min(h * 0.32, devW * 0.52);
    sender = { x: pad, y: pad, w: devW, h: devH };
    receiver = { x: pad, y: h - pad - devH, w: devW, h: devH };
  }
  const s = deviceParts(sender);
  const r = deviceParts(receiver);
  const a = vertical
    ? { x: s.screen.x + s.screen.w / 2, y: sender.y + sender.h + 10 }
    : { x: sender.x + sender.w + 12, y: s.screen.y + s.screen.h / 2 };
  const b = vertical
    ? { x: r.screen.x + r.screen.w / 2, y: receiver.y - 10 }
    : { x: receiver.x - 12, y: r.screen.y + r.screen.h / 2 };
  const laneLength = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    sender,
    receiver,
    senderScreen: s.screen,
    receiverScreen: r.screen,
    senderGrid: s.grid,
    receiverGrid: r.grid,
    a,
    b,
    frame: Math.max(22, Math.min(46, laneLength / 7)),
    vertical,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function setLabel(ctx: CanvasRenderingContext2D, size: number, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${size * 0.12}px`;
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: Rect, k: number, sim: Sim | null, source: boolean) {
  const cols = 6;
  const rows = Math.ceil(k / cols);
  const gap = 4;
  const cw = (grid.w - gap * (cols - 1)) / cols;
  const ch = Math.min(16, (grid.h - 16 - gap * (rows - 1)) / rows);
  for (let i = 0; i < k; i++) {
    const x = grid.x + (i % cols) * (cw + gap);
    const y = grid.y + 16 + Math.floor(i / cols) * (ch + gap);
    const solvedAt = sim ? sim.solvedAt[i]! : -1;
    const solved = source || solvedAt >= 0;
    const flash = sim && solvedAt >= 0 ? Math.max(0, 1 - (sim.clock - solvedAt) / 600) : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 3);
    if (solved) {
      ctx.save();
      if (flash > 0) {
        ctx.shadowColor = `rgba(28, 29, 33, ${0.5 * flash})`;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = source ? 'rgba(28, 29, 33, 0.16)' : flash > 0 ? INK : GRAPHITE;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/** A device drawn as a slab of frosted glass: soft shadow, top-lit fill, a hairline rim. */
function drawDevice(ctx: CanvasRenderingContext2D, device: Rect, label: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(52, 48, 40, 0.16)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, device, 18);
  const fill = ctx.createLinearGradient(0, device.y, 0, device.y + device.h);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  fill.addColorStop(0.5, 'rgba(255, 255, 255, 0.82)');
  fill.addColorStop(1, 'rgba(250, 249, 246, 0.9)');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, device, 18);
  const rim = ctx.createLinearGradient(device.x, device.y, device.x + device.w, device.y + device.h);
  rim.addColorStop(0, 'rgba(28, 29, 33, 0.08)');
  rim.addColorStop(0.6, 'rgba(28, 29, 33, 0.12)');
  rim.addColorStop(1, 'rgba(28, 29, 33, 0.2)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.stroke();
  setLabel(ctx, 9.5);
  ctx.fillStyle = MUTE;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label.toUpperCase(), device.x + 14, device.y + 18);
}

function draw(canvas: HTMLCanvasElement, sim: Sim, size: { w: number; h: number; dpr: number }) {
  const { w, h, dpr } = size;
  if (w === 0 || h === 0) return;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const L = computeLayout(w, h);
  const k = sim.decoder.k;

  // Optical gap: a faint beam of light between the devices.
  const beam = ctx.createLinearGradient(L.a.x, L.a.y, L.b.x, L.b.y);
  beam.addColorStop(0, 'rgba(28, 29, 33, 0.06)');
  beam.addColorStop(0.5, 'rgba(28, 29, 33, 0.025)');
  beam.addColorStop(1, 'rgba(28, 29, 33, 0.06)');
  ctx.save();
  ctx.strokeStyle = beam;
  ctx.lineWidth = L.frame * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L.a.x, L.a.y);
  ctx.lineTo(L.b.x, L.b.y);
  ctx.stroke();
  ctx.setLineDash([2, 6]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(L.a.x, L.a.y);
  ctx.lineTo(L.b.x, L.b.y);
  ctx.stroke();
  ctx.restore();

  drawDevice(ctx, L.sender, 'Sender');
  drawDevice(ctx, L.receiver, 'Receiver');

  // Sender screen: the frame being shown right now.
  roundRect(ctx, L.senderScreen, 6);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (sim.current && sim.doneAt === null) {
    ctx.save();
    roundRect(ctx, L.senderScreen, 6);
    ctx.clip();
    ctx.drawImage(frameImage(sim.current), L.senderScreen.x, L.senderScreen.y, L.senderScreen.w, L.senderScreen.h);
    ctx.restore();
  }
  drawGrid(ctx, L.senderGrid, k, null, true);
  setLabel(ctx, 9);
  ctx.fillStyle = MUTE;
  ctx.fillText(`FILE · ${k} BLOCKS`, L.senderGrid.x, L.senderGrid.y + 9);

  // Frames in flight; lost frames fall out of the beam, outlined and fading.
  const dx = L.b.x - L.a.x;
  const dy = L.b.y - L.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (const flight of sim.flights) {
    const f = L.frame;
    let x = L.a.x + dx * flight.t;
    let y = L.a.y + dy * flight.t;
    let alpha = Math.min(1, flight.t * 6);
    const falling = flight.lost && flight.t > 0.42;
    if (falling) {
      const fall = (flight.t - 0.42) / 0.58;
      const drop = fall * fall * 70;
      x += nx * drop * (L.vertical ? -1 : 1);
      y += ny * drop * (L.vertical ? -1 : 1);
      alpha *= 1 - fall;
    }
    ctx.globalAlpha = Math.max(0, alpha) * (falling ? 0.45 : 1);
    ctx.drawImage(frameImage(flight.droplet), x - f / 2, y - f / 2, f, f);
    ctx.globalAlpha = Math.max(0, alpha);
    if (falling) {
      ctx.save();
      ctx.strokeStyle = MUTE;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - f / 2 - 2, y - f / 2 - 2, f + 4, f + 4);
      ctx.setLineDash([]);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - f / 4, y - f / 4);
      ctx.lineTo(x + f / 4, y + f / 4);
      ctx.moveTo(x + f / 4, y - f / 4);
      ctx.lineTo(x - f / 4, y + f / 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Receiver screen: camera viewfinder with the last captured frame.
  const rs = L.receiverScreen;
  roundRect(ctx, rs, 6);
  ctx.fillStyle = SCREEN;
  ctx.fill();
  if (sim.captured) {
    ctx.globalAlpha = 0.28 + sim.captureGlow * 0.72;
    const inset = rs.w * 0.12;
    ctx.drawImage(frameImage(sim.captured), rs.x + inset, rs.y + inset, rs.w - inset * 2, rs.h - inset * 2);
    ctx.globalAlpha = 1;
  }
  const bracket = rs.w * 0.16;
  ctx.strokeStyle = GRAPHITE;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [
    [rs.x + 7, rs.y + 7, 1, 1],
    [rs.x + rs.w - 7, rs.y + 7, -1, 1],
    [rs.x + 7, rs.y + rs.h - 7, 1, -1],
    [rs.x + rs.w - 7, rs.y + rs.h - 7, -1, -1],
  ] as const) {
    ctx.moveTo(cx, cy + bracket * sy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + bracket * sx, cy);
  }
  ctx.stroke();

  drawGrid(ctx, L.receiverGrid, k, sim, false);
  setLabel(ctx, 9);
  ctx.fillStyle = sim.doneAt !== null ? INK : MUTE;
  ctx.fillText(
    sim.doneAt !== null ? 'FILE REBUILT' : `DECODED ${sim.decoder.solved}/${k}`,
    L.receiverGrid.x,
    L.receiverGrid.y + 9,
  );

  if (sim.doneAt !== null) {
    ctx.fillStyle = 'rgba(245, 244, 240, 0.9)';
    roundRect(ctx, rs, 6);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    setLabel(ctx, Math.round(rs.w * 0.085), 650);
    ctx.fillText('REBUILT', rs.x + rs.w / 2, rs.y + rs.h / 2);
    setLabel(ctx, Math.max(9, Math.round(rs.w * 0.05)), 500);
    ctx.fillStyle = MUTE;
    ctx.fillText(`${sim.received} FRAMES · ${k} BLOCKS`, rs.x + rs.w / 2, rs.y + rs.h / 2 + rs.w * 0.12);
    ctx.textAlign = 'start';
  }
}

/* ── Component ───────────────────────────────────────────────────────── */
interface Stats {
  sent: number;
  lost: number;
  received: number;
  solved: number;
  k: number;
  done: boolean;
}

const INITIAL_STATS: Stats = { sent: 0, lost: 0, received: 0, solved: 0, k: BLOCKS, done: false };

export function BeamStream() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const seedRef = useRef(7);
  const lossRef = useRef(0.25);
  const [loss, setLoss] = useState(0.25);
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [announcement, setAnnouncement] = useState('');
  const { enabled: motion } = useMotion();
  const hydrated = useHydrated();
  const inView = useInView(wrapRef, { rootMargin: '120px 0px' });
  const pageVisible = usePageVisible();
  const sliderId = useId();
  const playing = userPlaying ?? motion;

  const publish = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    setStats({
      sent: sim.sent,
      lost: sim.lost,
      received: sim.received,
      solved: sim.decoder.solved,
      k: sim.decoder.k,
      done: sim.doneAt !== null,
    });
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (canvas && sim) draw(canvas, sim, sizeRef.current);
  }, []);

  const restart = useCallback(() => {
    seedRef.current++;
    simRef.current = createSim(seedRef.current);
    setAnnouncement('');
    publish();
    redraw();
  }, [publish, redraw]);

  useEffect(() => {
    simRef.current = createSim(seedRef.current);
    // Show a representative first frame even before the stream starts.
    advance(simRef.current, EMIT_MS * 0.2, lossRef.current);
    publish();
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const observer = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sizeRef.current = { w, h, dpr };
      redraw();
    });
    observer.observe(wrap);
    const fonts = document.fonts;
    fonts?.ready.then(redraw).catch(() => {});
    return () => observer.disconnect();
  }, [publish, redraw]);

  useEffect(() => {
    if (!playing || !inView || !pageVisible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const sim = simRef.current;
      if (sim) {
        if (sim.doneAt !== null && sim.clock - sim.doneAt > HOLD_MS) {
          seedRef.current++;
          simRef.current = createSim(seedRef.current);
          publish();
        } else if (advance(sim, dt, lossRef.current)) {
          publish();
          if (sim.doneAt !== null) {
            setAnnouncement(
              `File rebuilt from ${sim.received} received frames for ${sim.decoder.k} blocks. ${sim.lost} frames were lost on the way.`,
            );
          }
        }
        redraw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, pageVisible, publish, redraw]);

  const overhead = stats.received / stats.k;
  const stage = stats.done ? 3 : stats.received > 0 ? 2 : stats.sent > 0 ? 1 : 0;
  const stages = ['File selected', 'QR frames generated', 'Camera capturing', 'File rebuilt'];

  return (
    <div className="beam">
      {/* The progression the real app makes, in order; the live one is marked. */}
      <ol className="beam__steps" aria-label="Transfer stages">
        {stages.map((name, i) => (
          <li key={name} className="beam__step" aria-current={i === stage ? 'step' : undefined} data-done={i < stage ? '' : undefined}>
            <span className="beam__step-num tabular">{i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <div ref={wrapRef} className="beam__stage">
        <canvas
          ref={canvasRef}
          className="beam__canvas"
          role="img"
          aria-label="Simulation: frames stream from a sender screen to a receiving camera. Some frames are lost on the way; the receiver rebuilds the file block by block from whichever frames arrive."
        />
      </div>

      <div className="beam__controls">
        <div className="beam__buttons">
          <button type="button" className="button button--small button--quiet" onClick={() => setUserPlaying(!playing)}>
            <Icon name={playing && hydrated ? 'pause' : 'play'} className="icon" />
            {playing && hydrated ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="button button--small button--quiet" onClick={restart}>
            <Icon name="reset" className="icon" />
            New file
          </button>
        </div>

        <div className="beam__loss">
          <label htmlFor={sliderId} className="label">
            Frame loss
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={60}
            step={5}
            value={Math.round(loss * 100)}
            aria-valuetext={`${Math.round(loss * 100)} percent of frames lost`}
            onChange={(event) => {
              const value = Number(event.target.value) / 100;
              lossRef.current = value;
              setLoss(value);
            }}
          />
          <output htmlFor={sliderId} className="beam__loss-value tabular">
            {Math.round(loss * 100)}%
          </output>
        </div>

        <dl className="beam__stats">
          <div>
            <dt>Sent</dt>
            <dd>{stats.sent}</dd>
          </div>
          <div>
            <dt>Lost</dt>
            <dd className="beam__lost">{stats.lost}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{stats.received}</dd>
          </div>
          <div>
            <dt>Blocks</dt>
            <dd>
              {stats.solved}/{stats.k}
            </dd>
          </div>
          <div>
            <dt>Overhead</dt>
            <dd>{stats.done ? `${overhead.toFixed(2)}×` : '—'}</dd>
          </div>
        </dl>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
