import {
  Color,
  CustomToneMapping,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
  ShaderChunk,
  WebGLRenderer,
} from 'three';
import type { ProjectId } from '../content/projects';
import { coreTelemetry } from '../lib/telemetry';
import { createBackdrop, createStudioEnvironment } from './environment';
import {
  applyForms,
  computeForm,
  createBaseSphere,
  SCULPTURE_RADIUS,
  STATE_ORDER,
  type SculptureForm,
  type SculptureState,
} from './sculpture';
import { ANCHOR_SELECTOR, anchorState, type CoreController, type CoreOptions } from './types';

const FOV = 24;

/*
  Tone mapping. The backdrop is drawn untouched, but everything seen through
  the glass passes through the tone curve — so the curve must leave the
  backdrop's range alone, or the glass reads as a tinted hole (the standard
  curves' toe crushed a dark studio to black; their shoulder greys a white
  one). This curve is the identity below a knee, with a smooth shoulder above
  it that rolls the brightest highlights off instead of clipping them.
*/
const TONE_KNEE = 0.9;
ShaderChunk.tonemapping_pars_fragment = ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    color *= toneMappingExposure;
    const float knee = ${TONE_KNEE.toFixed(2)};
    float peak = max( color.r, max( color.g, color.b ) );
    if ( peak <= knee ) return color;
    float mapped = knee + ( 1.0 - knee ) * ( 1.0 - exp( -( peak - knee ) / ( 1.0 - knee ) ) );
    color *= mapped / peak;
    float toWhite = 1.0 - 1.0 / ( 0.35 * ( peak - mapped ) + 1.0 );
    return mix( color, vec3( mapped ), toWhite );
  }`,
);
/** Resting three-quarter angle — also the angle the stills are rendered at. */
const BASE_YAW = 0.62;
const BASE_ROLL = -0.08;

interface Spring {
  value: number;
  velocity: number;
  target: number;
}

/** Slightly under-damped spring: shapes settle like liquid, with a hint of overshoot. */
function stepSpring(s: Spring, dt: number, stiffness: number, damping: number): boolean {
  const force = (s.target - s.value) * stiffness - s.velocity * damping;
  s.velocity += force * dt;
  s.value += s.velocity * dt;
  if (Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.velocity) < 1e-4) {
    s.value = s.target;
    s.velocity = 0;
    return false;
  }
  return true;
}

interface Damped {
  value: number;
  target: number;
}

function damp(d: Damped, lambda: number, dt: number, epsilon = 1e-4): boolean {
  const diff = d.target - d.value;
  if (Math.abs(diff) < epsilon) {
    d.value = d.target;
    return false;
  }
  d.value += diff * (1 - Math.exp(-lambda * dt));
  return true;
}

interface Anchor {
  element: HTMLElement;
  state: SculptureState;
  /** The page colour behind this anchor, so refraction stays continuous. */
  base: Color;
}

/**
 * One glass sculpture for the whole page. It lives on a fixed, transparent,
 * viewport-sized canvas and attaches itself to whichever anchor element is
 * on screen — the hero, then the opening of each project chapter — taking
 * that anchor's form on the way in. Between anchors nothing is rendered.
 */
export function createLiquidCore(options: CoreOptions): CoreController {
  performance.mark('core:create');
  const { host, tier, poster = false } = options;
  const high = tier === 'high';
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ── Renderer ─────────────────────────────────────────────────────────── */
  const maxDpr = poster ? 2 : Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1.25);
  const minDpr = Math.min(1, maxDpr);
  let dpr = maxDpr;

  // Adopt the probe's context: GPU context set-up is slow the first time.
  const renderer = new WebGLRenderer({
    canvas: options.gl.canvas,
    context: options.gl.context,
    alpha: true,
    premultipliedAlpha: true,
  });
  // Shader status queries make the main thread wait for the GPU to finish
  // compiling; skip them in production so compilation stays truly parallel.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = CustomToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.transmissionResolutionScale = high ? 0.75 : 0.5;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  const backdrop = createBackdrop();
  scene.add(backdrop.studio, backdrop.overlay);
  if (poster) {
    // A still is an opaque picture of the studio; the overlay is part of it.
    backdrop.uniforms.uPoster.value = 1;
    backdrop.overlay.visible = false;
  }
  const pivot = new Group();
  scene.add(pivot);

  /* ── Glass ────────────────────────────────────────────────────────────── */
  const geometry = createBaseSphere(high ? 224 : 128, high ? 160 : 96);
  const directions = (geometry.getAttribute('position').array as Float32Array).slice();
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 3,
    ior: 1.5,
    dispersion: high ? 0.6 : 0,
    attenuationColor: new Color('#eef1f4'),
    attenuationDistance: 3.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    // A whisper of thin-film interference: the faint spectral sheen that
    // makes clear glass read as glass against a white page.
    iridescence: 0.5,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [220, 560],
    specularIntensity: 1,
    envMapIntensity: 1.15,
  });
  const uTime = { value: 0 };
  const uWobble = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uWobble = uWobble;
    shader.vertexShader = `uniform float uTime;\nuniform float uWobble;\n${shader.vertexShader}`.replace(
      '#include <morphtarget_vertex>',
      `#include <morphtarget_vertex>
      // Liquid surface: a slow, low-frequency undulation along the normal.
      float wob = sin(transformed.x * 2.3 + uTime * 0.9) * sin(transformed.y * 2.6 - uTime * 0.72) * sin(transformed.z * 2.1 + uTime * 0.55);
      transformed += objectNormal * wob * 0.028 * uWobble;`,
    );
  };
  let mesh: Mesh | null = null;
  let disposeEnvironment: (() => void) | null = null;

  /* ── State ────────────────────────────────────────────────────────────── */
  let motion = poster ? false : options.motion;
  let focus: ProjectId | null = null;
  let time = 0;
  let spin = 0;
  const pointer = { x: 0, y: 0 };
  // One spring per project form (the core form is the base geometry).
  const morph: Spring[] = STATE_ORDER.slice(1).map(() => ({ value: 0, velocity: 0, target: 0 }));
  const rig = {
    yaw: { value: 0, target: 0 },
    pitch: { value: 0, target: 0 },
    lift: { value: 0, target: 0 },
    wobble: { value: 1, target: 1 },
  };
  const backdropWeights: Damped[] = STATE_ORDER.map((_, i) => ({ value: i === 0 ? 1 : 0, target: i === 0 ? 1 : 0 }));
  /** How present the sculpture is: 0 between anchors, 1 settled on one. */
  const presence: Damped = { value: poster ? 1 : 0, target: poster ? 1 : 0 };
  /** Screen-space offset left over from the previous anchor, gliding to zero. */
  const glide = { x: { value: 0, target: 0 }, y: { value: 0, target: 0 } };

  let anchors: Anchor[] = [];
  let active: Anchor | null = null;
  let activeRect: DOMRect | null = null;
  let progress = 0.5; // the active anchor's passage through the viewport, 0 → 1
  let lastCentre = { x: 0, y: 0 };

  const refreshAnchors = () => {
    anchors = Array.from(document.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR)).map((element) => ({
      element,
      state: anchorState(element),
      base: new Color(element.dataset.base || '#f5f4f0'),
    }));
  };
  refreshAnchors();

  let width = 1;
  let height = 1;
  let distance = 10;
  let visible = false;

  const measure = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    backdrop.uniforms.uAspect.value = width / height;
  };

  /** Which anchor is on screen, and how much of it. */
  const place = () => {
    let best: Anchor | null = null;
    let bestRect: DOMRect | null = null;
    let bestVisible = 0;
    for (const anchor of anchors) {
      const rect = anchor.element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Counted generously: the drawing around the sculpture is wider than its box.
      const margin = rect.height * 0.4;
      const shown = Math.min(rect.bottom + margin, height) - Math.max(rect.top - margin, 0);
      const fraction = shown / (rect.height + margin * 2);
      if (fraction > bestVisible) {
        best = anchor;
        bestRect = rect;
        bestVisible = fraction;
      }
    }
    if (best !== active) {
      // Hand over from the previous anchor: keep the sculpture where it was
      // and let it glide to the new place (only if it was visible at all).
      if (best && bestRect && presence.value > 0.05 && activeRect) {
        glide.x.value = lastCentre.x - (bestRect.left + bestRect.width / 2);
        glide.y.value = lastCentre.y - (bestRect.top + bestRect.height / 2);
      }
      active = best;
      setTargets();
    }
    activeRect = bestRect;
    presence.target = poster ? 1 : best ? Math.min(1, bestVisible / 0.5) : 0;
    if (bestRect) progress = (height - bestRect.top) / (height + bestRect.height);
  };

  const currentState = (): SculptureState => {
    if (!active) return 'core';
    return active.state === 'core' && focus ? focus : active.state;
  };

  const setTargets = () => {
    const index = STATE_ORDER.indexOf(currentState());
    morph.forEach((spring, i) => (spring.target = i + 1 === index ? 1 : 0));
    backdropWeights.forEach((w, i) => (w.target = i === index ? 1 : 0));
    const px = motion && finePointer ? pointer.x : 0;
    const py = motion && finePointer ? pointer.y : 0;
    rig.yaw.target = px * 0.34;
    rig.pitch.target = -py * 0.2 + (motion ? (progress - 0.5) * 0.5 : 0);
    rig.lift.target = motion ? (progress - 0.5) * 0.6 : 0;
  };

  /** Advance the simulation. Returns true while anything is still changing. */
  const update = (dt: number): boolean => {
    place();
    let changing = false;
    if (motion) {
      time += dt;
      spin += dt * 0.12;
      changing = true;
    }
    for (const spring of morph) {
      changing = (motion ? stepSpring(spring, dt, 38, 8.5) : ((spring.value = spring.target), false)) || changing;
    }
    const lambda = motion ? 3.4 : 60;
    for (const d of Object.values(rig)) changing = damp(d, lambda, dt) || changing;
    for (const w of backdropWeights) changing = damp(w, motion ? 3 : 60, dt) || changing;
    changing = damp(presence, motion ? 4.5 : 60, dt, 0.002) || changing;
    changing = damp(glide.x, motion ? 5 : 60, dt, 0.3) || changing;
    changing = damp(glide.y, motion ? 5 : 60, dt, 0.3) || changing;

    visible = presence.value > 0.004 && activeRect !== null;
    if (!visible) return changing;

    // Where the sculpture sits: the active anchor's box, plus any glide left.
    const rect = activeRect!;
    const cx = rect.left + rect.width / 2 + glide.x.value;
    const cy = rect.top + rect.height / 2 + glide.y.value;
    lastCentre = { x: cx, y: cy };
    const size = Math.max(48, rect.width);
    distance = (SCULPTURE_RADIUS * height) / (size * Math.tan(MathUtils.degToRad(FOV / 2)));
    camera.setViewOffset(width, height, width / 2 - cx, height / 2 - cy, width, height);
    camera.updateProjectionMatrix();
    const u = backdrop.uniforms;
    u.uCore.value.set(cx / width, 1 - cy / height);
    u.uSize.value = size / height;
    u.uPresence.value = presence.value;
    u.uBase.value.copy(active!.base);
    u.uScroll.value = motion ? progress : 0.5;
    u.uTime.value = time;
    u.uWeights.value.set(
      backdropWeights[0]!.value,
      backdropWeights[1]!.value,
      backdropWeights[2]!.value,
      backdropWeights[3]!.value,
    );

    if (mesh?.morphTargetInfluences) morph.forEach((s, i) => (mesh!.morphTargetInfluences![i] = s.value));
    uTime.value = time;
    uWobble.value = motion ? rig.wobble.value : 0;
    const bob = motion ? Math.sin(time * 0.5) * 0.04 : 0;
    // Arrival: the glass settles into place from slightly smaller and lower.
    const arrive = poster ? 1 : presence.value;
    pivot.rotation.set(rig.pitch.value, BASE_YAW + spin + rig.yaw.value, BASE_ROLL);
    pivot.position.y = bob + rig.lift.value - (1 - arrive) * 0.35;
    pivot.scale.setScalar(0.88 + 0.12 * arrive);

    const elevation = 0.12;
    camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    camera.lookAt(0, 0, 0);
    return changing;
  };

  /* ── Loop: render only when visible, and only when something changes ──── */
  let raf = 0;
  let running = false;
  let pageVisible = document.visibilityState === 'visible';
  let disposed = false;
  let isReady = false;
  let lastFrame = 0;
  let lastInput = performance.now();
  let framesRendered = 0;
  let framesThisSecond = 0;
  let fpsWindowStart = performance.now();
  let fps = 0;
  let cpuAvg = 0;
  let slowFrames = 0;
  let lastPublish = 0;
  let shown = true;

  const publish = (now: number, force = false) => {
    if (!force && now - lastPublish < 500) return;
    lastPublish = now;
    const info = renderer.info.render;
    const reason = running
      ? motion
        ? now - lastInput > 2500
          ? 'Ambient motion, capped at 30 fps while you are not interacting'
          : 'Responding to pointer, focus or scroll at full frame rate'
        : 'Settling after a change'
      : !pageVisible
        ? 'Paused: tab is in the background'
        : !visible
          ? 'Paused: the sculpture is off-screen'
          : 'Idle: motion is off, so frames render only on change';
    coreTelemetry.set({
      status: running ? 'running' : 'idle',
      reason,
      tier,
      framesRendered,
      fps: running ? fps : 0,
      pixelRatio: dpr,
      drawCalls: info.calls,
      triangles: info.triangles,
      cpuFrameMs: Math.round(cpuAvg * 100) / 100,
    });
  };

  /** Hide the canvas entirely between anchors, so it costs nothing to composite. */
  const show = (on: boolean) => {
    if (shown === on) return;
    shown = on;
    canvas.style.visibility = on ? '' : 'hidden';
  };

  const render = () => {
    renderer.render(scene, camera);
    framesRendered++;
    framesThisSecond++;
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    fps = 0;
    publish(performance.now(), true);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const sinceInput = now - lastInput;
    const minInterval = motion && sinceInput > 2500 ? 1000 / 31 : 0;
    const elapsed = now - lastFrame;
    if (elapsed < minInterval) return;
    const dt = Math.min(0.05, elapsed / 1000);
    lastFrame = now;

    const t0 = performance.now();
    const changing = update(dt);
    if (visible) render();
    show(visible);
    cpuAvg = cpuAvg * 0.9 + (performance.now() - t0) * 0.1;

    // Adaptive resolution: sustained slow frames at full rate lower the DPR.
    if (visible && minInterval === 0 && elapsed > 26) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45 && dpr > minDpr) {
      dpr = Math.max(minDpr, Math.round((dpr - 0.25) * 100) / 100);
      renderer.setPixelRatio(dpr);
      measure();
      slowFrames = 0;
    }

    if (now - fpsWindowStart >= 1000) {
      fps = Math.round((framesThisSecond * 1000) / (now - fpsWindowStart));
      framesThisSecond = 0;
      fpsWindowStart = now;
    }
    publish(now);
    // Off-screen, ambient motion has nothing to show: sleep until a scroll.
    if (!changing || !visible) stop();
  };

  const start = () => {
    if (running || disposed || !isReady || !pageVisible) return;
    running = true;
    lastFrame = performance.now() - 16;
    fpsWindowStart = performance.now();
    framesThisSecond = 0;
    raf = requestAnimationFrame(frame);
  };

  function invalidate() {
    if (disposed) return;
    setTargets();
    start();
  }

  /* ── Observers and input ──────────────────────────────────────────────── */
  const resizeObserver = new ResizeObserver(() => {
    measure(); // resizing clears the drawing buffer, so always follow with a frame
    invalidate();
  });
  resizeObserver.observe(host);

  const onScroll = () => {
    lastInput = performance.now();
    invalidate();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const onPageVisibility = () => {
    pageVisible = document.visibilityState === 'visible';
    if (pageVisible) invalidate();
    else stop();
  };
  document.addEventListener('visibilitychange', onPageVisibility);

  const onPointerMove = (event: PointerEvent) => {
    if (!motion || event.pointerType !== 'mouse') return;
    pointer.x = MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
    pointer.y = MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
    lastInput = performance.now();
    invalidate();
  };
  if (finePointer && !poster) window.addEventListener('pointermove', onPointerMove, { passive: true });

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    if (!disposed) options.onContextLost();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  /* ── Progressive initialisation ───────────────────────────────────────────
     Each costly step gets its own idle slice: one sculpture form per slice,
     then the studio environment, then an async shader compile (parallel where
     the GPU supports it). The canvas only fades in once a frame exists. */
  const nextIdle = () =>
    new Promise<void>((resolve) => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 150 });
      else setTimeout(resolve, 16);
    });

  performance.mark('core:scene-built');
  performance.measure('core: build scene (sync)', 'core:create', 'core:scene-built');

  const ready = (async () => {
    const forms = {} as Record<SculptureState, SculptureForm>;
    for (const state of STATE_ORDER) {
      await nextIdle();
      if (disposed) return;
      const t0 = performance.now();
      forms[state] = computeForm(directions, state);
      performance.measure(`core: form ${state}`, { start: t0, end: performance.now() });
    }
    applyForms(geometry, forms);
    mesh = new Mesh(geometry, material);
    pivot.add(mesh);

    await nextIdle();
    if (disposed) return;
    const envStart = performance.now();
    const environment = createStudioEnvironment(renderer);
    scene.environment = environment.texture;
    disposeEnvironment = environment.dispose;
    performance.measure('core: studio environment', { start: envStart, end: performance.now() });

    await nextIdle();
    if (disposed) return;
    measure();
    place();
    // Start in the active anchor's form, not morphing into it from the core.
    setTargets();
    morph.forEach((s) => (s.value = s.target));
    backdropWeights.forEach((w) => (w.value = w.target));
    update(0);
    const compileStart = performance.now();
    await renderer.compileAsync(scene, camera);
    performance.measure('core: compile shaders (async)', { start: compileStart, end: performance.now() });

    // The first draw is the expensive one — the driver finishes the glass
    // shader for the real framebuffers, three.js allocates the transmission
    // target — so it gets a slice of its own while the canvas is still
    // invisible, and going live waits for the next.
    await nextIdle();
    if (disposed) return;
    const frameStart = performance.now();
    render();
    performance.measure('core: first frame', { start: frameStart, end: performance.now() });

    await nextIdle();
    if (disposed) return;
    isReady = true;
    show(visible);
    start();
    publish(performance.now(), true);
    if (poster) document.documentElement.dataset.posterReady = 'true';
  })();

  return {
    ready,
    canvas,
    setFocus(id) {
      if (id === focus) return;
      focus = id;
      lastInput = performance.now();
      if (motion && active?.state === 'core') {
        // A brief ripple through the glass as it changes form.
        rig.wobble.value = 2.6;
        rig.wobble.target = 1;
      }
      invalidate();
    },
    setMotion(enabled) {
      motion = poster ? false : enabled;
      if (!motion) {
        pointer.x = 0;
        pointer.y = 0;
      }
      invalidate();
    },
    refreshAnchors() {
      refreshAnchors();
      invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onPageVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      geometry.dispose();
      material.dispose();
      backdrop.dispose();
      disposeEnvironment?.();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
