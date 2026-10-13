import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useMotion } from '../../lib/motion-context';
import { useInView } from '../../lib/useInView';
import './depth-walk.css';

/**
 * Fig. 03 — an interactive reconstruction of the *technique* behind a CSS 3D
 * walk: layers placed at real depths inside one perspective, each scaled so
 * it fills the frame from the starting camera. Moving the camera forward
 * produces true parallax. The art is abstract; no production photography.
 */
const LAYER_GAP = 600; // px between layers along Z
const PERSPECTIVE = 900; // must match .depth__viewport perspective
const CAMERA_TRAVEL = 2000; // px of camera movement at depth = 100

function FrameArt() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path
        fillRule="evenodd"
        fill="#e9dfd0"
        d="M0 0H1600V900H0Z M330 900V470A470 470 0 0 1 1270 470V900Z"
      />
      <path d="M330 900V470A470 470 0 0 1 1270 470V900" fill="none" stroke="#c9b597" strokeWidth="10" />
      <path d="M250 900V0M1350 900V0" stroke="#dccfbb" strokeWidth="60" />
    </svg>
  );
}

function TerraceArt() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="amb-pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ccdd3" />
          <stop offset="1" stopColor="#4c8a97" />
        </linearGradient>
      </defs>
      <path d="M0 660H1600V900H0Z" fill="#e6d8c3" />
      <path d="M420 700H1180L1400 900H200Z" fill="url(#amb-pool)" />
      <g stroke="#e9fbff" strokeOpacity="0.55" strokeWidth="3">
        <path d="M640 740H760M860 760H1010M560 800H700M900 830H1080M700 860H840" />
      </g>
      <g fill="#cdbba0">
        <rect x="90" y="700" width="170" height="26" rx="10" />
        <rect x="1340" y="700" width="170" height="26" rx="10" />
        <rect x="60" y="760" width="200" height="30" rx="12" />
        <rect x="1340" y="760" width="200" height="30" rx="12" />
      </g>
    </svg>
  );
}

function ColonnadeArt() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* Arch openings are true holes (even-odd), so the horizon and sky
          layers behind show through them — with real parallax. */}
      <path
        fillRule="evenodd"
        fill="#efe5d4"
        d={`M0 430H1600V700H0Z ${Array.from({ length: 7 }, (_, i) => {
          const x = 110 + i * 205;
          return `M${x} 700V550A62 62 0 0 1 ${x + 124} 550V700Z`;
        }).join(' ')}`}
      />
      <path d="M0 430H1600V452H0Z" fill="#d9c9ae" />
      <path d="M0 690H1600V700H0Z" fill="#d6c4a7" />
    </svg>
  );
}

function HorizonArt() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="amb-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#adc7c4" />
          <stop offset="1" stopColor="#6f979b" />
        </linearGradient>
      </defs>
      <path
        d="M0 575C200 535 360 490 560 515S900 575 1100 528S1450 488 1600 538V900H0Z"
        fill="#c79f7c"
        fillOpacity="0.7"
      />
      <rect y="600" width="1600" height="300" fill="url(#amb-sea)" />
      <g stroke="#fff4df" strokeOpacity="0.6" strokeWidth="3">
        <path d="M940 630H1040M920 660H1060M950 690H1030M930 720H1050" />
      </g>
    </svg>
  );
}

function SkyArt() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="amb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e3c8" />
          <stop offset="0.65" stopColor="#efc89c" />
          <stop offset="1" stopColor="#e6b183" />
        </linearGradient>
        <radialGradient id="amb-sun" cx="0.62" cy="0.64" r="0.4">
          <stop offset="0" stopColor="#fff7e6" />
          <stop offset="0.3" stopColor="#ffeacb" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffeacb" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#amb-sky)" />
      <rect width="1600" height="900" fill="url(#amb-sun)" />
      <circle cx="990" cy="560" r="64" fill="#fff5de" />
    </svg>
  );
}

const LAYERS = [
  { id: 'frame', label: 'Foreground arch', Art: FrameArt },
  { id: 'terrace', label: 'Terrace', Art: TerraceArt },
  { id: 'colonnade', label: 'Colonnade', Art: ColonnadeArt },
  { id: 'horizon', label: 'Horizon', Art: HorizonArt },
  { id: 'sky', label: 'Sky', Art: SkyArt },
];

export function DepthWalk() {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [depth, setDepth] = useState(0);
  const [exploded, setExploded] = useState(false);
  const touched = useRef(false);
  const { enabled: motion } = useMotion();
  const seen = useInView(rootRef, { rootMargin: '-20% 0px', once: true });
  const sliderId = useId();

  // A single, short walk-in the first time the figure is seen.
  useEffect(() => {
    if (seen && motion && !touched.current) setDepth(8);
  }, [seen, motion]);

  // Gentle pointer parallax (mouse only, motion on). Written straight to CSS.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !motion) return;
    let frame = 0;
    let mx = 0;
    let my = 0;
    const apply = () => {
      frame = 0;
      viewport.style.setProperty('--mx', mx.toFixed(3));
      viewport.style.setProperty('--my', my.toFixed(3));
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = viewport.getBoundingClientRect();
      mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      my = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (frame === 0) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      mx = 0;
      my = 0;
      if (frame === 0) frame = requestAnimationFrame(apply);
    };
    viewport.addEventListener('pointermove', onMove, { passive: true });
    viewport.addEventListener('pointerleave', onLeave);
    return () => {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      viewport.style.removeProperty('--mx');
      viewport.style.removeProperty('--my');
    };
  }, [motion]);

  const cameraPx = Math.round((depth / 100) * CAMERA_TRAVEL);

  return (
    <div
      ref={rootRef}
      className="depth"
      data-exploded={exploded ? '' : undefined}
      style={{ '--z': depth / 100, '--view': exploded ? 1 : 0 } as CSSProperties}
    >
      <div className="depth__frame">
        <div ref={viewportRef} className="depth__viewport" aria-hidden="true">
          <div className="depth__world">
            {LAYERS.map(({ id, label, Art }, d) => (
              <div key={id} className={`depth__layer depth__layer--${id}`} style={{ '--d': d } as CSSProperties}>
                <Art />
                <span className="depth__tag">
                  L{d} · {label} · z −{d * LAYER_GAP}px
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls float over the imagery on frosted glass. */}
        <div className="depth__controls glass">
          <label htmlFor={sliderId} className="depth__label">
            Camera depth
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            value={depth}
            disabled={exploded}
            aria-valuetext={`Camera moved ${cameraPx} pixels into the scene`}
            onChange={(event) => {
              touched.current = true;
              setDepth(Number(event.target.value));
            }}
          />
          <output htmlFor={sliderId} className="depth__value tabular">
            +{cameraPx}px
          </output>
          <button
            type="button"
            className="depth__toggle"
            aria-pressed={exploded}
            onClick={() => setExploded((v) => !v)}
          >
            Exploded view
          </button>
        </div>
      </div>
      <p className="depth__note label">
        {LAYERS.length} layers · {LAYER_GAP}px apart · perspective {PERSPECTIVE}px
      </p>
    </div>
  );
}
