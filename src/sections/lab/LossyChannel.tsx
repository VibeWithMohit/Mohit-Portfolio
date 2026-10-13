import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { LTDecoder, LTEncoder } from '../../lib/fountain/lt';
import { useMotion } from '../../lib/motion-context';
import { hash32 } from '../../lib/random';
import { useInView, usePageVisible } from '../../lib/useInView';
import './lossy-channel.css';

/**
 * Experiment 01 — Lossy Channel. Type a message; it is cut into 4-byte
 * blocks and LT-encoded. Frames cross a channel that drops a share of them;
 * the peeling decoder's state is drawn as a bipartite graph (blocks above,
 * still-unresolved frames below) until the message is whole again.
 *
 * State is just the message, a stream seed and the log of transmissions.
 * Whether a frame is lost is a deterministic function of (seed, frame id),
 * so the reducer is pure; the decoder state is derived by replaying the log.
 */
const BLOCK = 4;
const MAX_CHARS = 48;
const AUTO_MS = 520;
const DEFAULT_MESSAGE = 'Rebuilt from whichever frames survive.';
const VIEW_W = 640;
const VIEW_H = 250;

interface Transmission {
  id: number;
  lost: boolean;
}

interface ChannelState {
  text: string;
  seed: number;
  log: Transmission[];
}

type Action = { type: 'send'; loss: number } | { type: 'reset'; text: string };

/** Uniform [0, 1) from (seed, frame) — the channel's coin flip, reproducible. */
const coin = (seed: number, frame: number) => hash32(seed, frame, 0x1d) / 4294967296;

function reducer(state: ChannelState, action: Action): ChannelState {
  if (action.type === 'reset') return { text: action.text, seed: state.seed + 1, log: [] };
  const id = state.log.length;
  return { ...state, log: [...state.log, { id, lost: coin(state.seed, id) < action.loss }] };
}

const encode = (text: string) => new TextEncoder().encode(text.length > 0 ? text : ' ');

/** Printable view of a block: ASCII as-is, anything else as a middle dot. */
function blockText(bytes: Uint8Array | null): string {
  if (!bytes) return '····';
  return Array.from(bytes, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
}

export default function LossyChannel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reducer, { text: DEFAULT_MESSAGE, seed: 1, log: [] });
  const [loss, setLoss] = useState(0.4);
  const [auto, setAuto] = useState<boolean | null>(null);
  const { enabled: motion } = useMotion();
  const inView = useInView(rootRef, { rootMargin: '0px' });
  const pageVisible = usePageVisible();
  const inputId = useId();
  const lossId = useId();
  const autoOn = auto ?? motion;

  const bytes = useMemo(() => encode(state.text), [state.text]);
  const encoder = useMemo(() => new LTEncoder(bytes, BLOCK, state.seed), [bytes, state.seed]);
  const { decoder, lastSolved, degrees } = useMemo(() => {
    const replay = new LTDecoder(encoder.k, BLOCK, bytes.length);
    let solvedByLast: number[] = [];
    const frameDegrees: number[] = [];
    for (const t of state.log) {
      const droplet = encoder.droplet(t.id);
      frameDegrees.push(droplet.indices.length);
      solvedByLast = t.lost ? [] : replay.add(droplet);
    }
    return { decoder: replay, lastSolved: solvedByLast, degrees: frameDegrees };
  }, [encoder, bytes.length, state.log]);

  const complete = decoder.complete;

  useEffect(() => {
    if (!autoOn || !inView || !pageVisible || complete) return;
    const timer = window.setInterval(() => dispatch({ type: 'send', loss }), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [autoOn, inView, pageVisible, complete, loss]);

  const k = decoder.k;
  const snapshot = decoder.snapshot();
  const pending = snapshot.pending.slice(-8);
  const sent = state.log.length;
  const lostCount = sent - decoder.received;
  const decoded = Array.from({ length: k }, (_, i) => {
    const text = blockText(decoder.block(i));
    return i === k - 1 ? text.slice(0, decoder.length - i * BLOCK) : text;
  }).join('');

  // Geometry for the graph.
  const gap = 6;
  const cellW = (VIEW_W - 40 - gap * (k - 1)) / k;
  const cellX = (i: number) => 20 + i * (cellW + gap);
  const dropX = (j: number, n: number) => 20 + ((j + 0.5) * (VIEW_W - 40)) / Math.max(n, 1);

  return (
    <div ref={rootRef} className="channel">
      <div className="channel__input">
        <label htmlFor={inputId} className="label">
          Message
        </label>
        <input
          id={inputId}
          type="text"
          value={state.text}
          maxLength={MAX_CHARS}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => dispatch({ type: 'reset', text: event.target.value })}
        />
        <span className="label channel__meta">
          {k} blocks × {BLOCK} bytes
        </span>
      </div>

      <svg
        className="channel__graph"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={`Decoder state: ${decoder.solved} of ${k} blocks known; ${snapshot.pending.length} received frames still waiting on unknown blocks.`}
      >
        <text x={20} y={14} className="channel__axis">
          SOURCE BLOCKS
        </text>
        <text x={20} y={VIEW_H - 6} className="channel__axis">
          RECEIVED FRAMES STILL UNRESOLVED
        </text>
        {pending.map((p, j) =>
          p.remaining.map((i) => (
            <line
              key={`${p.id}-${i}`}
              x1={dropX(j, pending.length)}
              y1={VIEW_H - 52}
              x2={cellX(i) + cellW / 2}
              y2={78}
              className="channel__edge"
            />
          )),
        )}
        {Array.from({ length: k }, (_, i) => {
          const solved = snapshot.solved[i];
          const fresh = lastSolved.includes(i);
          return (
            <g
              key={`${state.seed}-${i}`}
              className={`channel__block${solved ? ' is-solved' : ''}${fresh ? ' is-fresh' : ''}`}
            >
              <rect x={cellX(i)} y={22} width={cellW} height={56} rx={4} />
              <text x={cellX(i) + cellW / 2} y={55} textAnchor="middle" className="channel__chars">
                {blockText(decoder.block(i))}
              </text>
              <text x={cellX(i) + cellW / 2} y={72} textAnchor="middle" className="channel__index">
                b{i}
              </text>
            </g>
          );
        })}
        {pending.map((p, j) => (
          <g key={p.id} className="channel__drop">
            <circle cx={dropX(j, pending.length)} cy={VIEW_H - 38} r={13} />
            <text x={dropX(j, pending.length)} y={VIEW_H - 34} textAnchor="middle">
              {p.remaining.length}
            </text>
          </g>
        ))}
      </svg>

      <ol className="channel__strip" aria-hidden="true">
        {state.log.slice(-32).map((t) => (
          <li key={t.id} className={t.lost ? 'is-lost' : 'is-received'} title={`Frame ${t.id}, degree ${degrees[t.id]}`} />
        ))}
      </ol>

      <div className="channel__controls">
        <button
          type="button"
          className="button button--small glass glass--prominent glass--interactive"
          onClick={() => dispatch({ type: 'send', loss })}
          disabled={complete}
        >
          <Icon name="step" className="icon" />
          Send a frame
        </button>
        <button type="button" className="button button--small button--quiet" aria-pressed={autoOn} onClick={() => setAuto(!autoOn)}>
          Auto-send
        </button>
        <button
          type="button"
          className="button button--small button--quiet"
          onClick={() => dispatch({ type: 'reset', text: state.text })}
        >
          <Icon name="reset" className="icon" />
          Reset
        </button>
        <div className="channel__loss">
          <label htmlFor={lossId} className="label">
            Loss
          </label>
          <input
            id={lossId}
            type="range"
            min={0}
            max={80}
            step={5}
            value={Math.round(loss * 100)}
            aria-valuetext={`${Math.round(loss * 100)} percent of frames lost`}
            onChange={(event) => setLoss(Number(event.target.value) / 100)}
          />
          <output htmlFor={lossId} className="tabular">
            {Math.round(loss * 100)}%
          </output>
        </div>
      </div>

      <dl className="channel__stats">
        <div>
          <dt className="label">Sent</dt>
          <dd>{sent}</dd>
        </div>
        <div>
          <dt className="label">Lost</dt>
          <dd className="channel__lost">{lostCount}</dd>
        </div>
        <div>
          <dt className="label">Received</dt>
          <dd>{decoder.received}</dd>
        </div>
        <div>
          <dt className="label">Redundant</dt>
          <dd>{decoder.redundant}</dd>
        </div>
        <div>
          <dt className="label">Known</dt>
          <dd>
            {decoder.solved}/{k}
          </dd>
        </div>
      </dl>

      <div className={`channel__output${complete ? ' is-complete' : ''}`}>
        <p className="label channel__output-label">{complete ? 'Decoded — every block recovered' : 'Decoded so far'}</p>
        <output className="channel__decoded">{complete ? state.text : decoded}</output>
        {complete && (
          <p className="channel__summary">
            {decoder.received} frames received for {k} blocks ({(decoder.received / k).toFixed(2)}×), despite{' '}
            {lostCount} lost on the way.
          </p>
        )}
      </div>
      {/* Announce the outcome once, not every frame. */}
      <p className="sr-only" aria-live="polite">
        {complete ? `Message decoded from ${decoder.received} received frames; ${lostCount} were lost.` : ''}
      </p>
    </div>
  );
}
