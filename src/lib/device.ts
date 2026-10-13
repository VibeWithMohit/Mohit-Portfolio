/**
 * Device tiering for the 3D scene. Decided once, on the client, from cheap
 * signals — the scene then adapts further at runtime by measuring frames.
 *
 *   high   — desktop-class: full material (dispersion), DPR up to 1.5
 *   medium — tablets, small laptops, coarse pointers: lighter mesh and
 *            transmission pass, DPR ≤ 1.25
 *   low    — phones, data saver, low memory: still image (3D on request)
 */
export type Tier = 'high' | 'medium' | 'low';

export interface DeviceProfile {
  tier: Tier;
  coarsePointer: boolean;
  saveData: boolean;
}

const TIERS: readonly Tier[] = ['high', 'medium', 'low'];

export function readDeviceProfile(): DeviceProfile {
  const width = window.innerWidth;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection?.saveData === true;
  const slowNetwork = ['slow-2g', '2g'].includes(navigator.connection?.effectiveType ?? '');
  const memory = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;

  let tier: Tier = 'high';
  if (width < 768 || saveData || slowNetwork || memory <= 2) tier = 'low';
  else if (coarsePointer || width < 1100 || cores <= 4 || memory <= 4) tier = 'medium';

  // QA override: ?tier=high|medium|low
  const forced = new URLSearchParams(window.location.search).get('tier');
  if (forced && (TIERS as readonly string[]).includes(forced)) tier = forced as Tier;

  return { tier, coarsePointer, saveData };
}

/** Renderer strings of CPU rasterisers (SwiftShader, Mesa llvmpipe/softpipe, Microsoft Basic Render). */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** A hardware WebGL2 context, ready for the scene to adopt. */
export interface AcquiredContext {
  canvas: HTMLCanvasElement;
  context: WebGL2RenderingContext;
}

/**
 * A hardware-accelerated WebGL2 context, or null. three.js r163+ needs
 * WebGL2; a software rasteriser can draw the scene but only by burning CPU,
 * so it gets the still image instead. `failIfMajorPerformanceCaveat`
 * usually catches that; the renderer string is checked too, because some
 * environments (headless or virtualised browsers) don't report the caveat.
 *
 * The probe context is created with the scene's own attributes and handed
 * to the renderer, so the (slow, first-time) GPU context set-up happens once.
 */
export function acquireWebGL2(attributes: WebGLContextAttributes): AcquiredContext | null {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { ...attributes, failIfMajorPerformanceCaveat: true });
    if (!context) return null;
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER) ?? '');
    if (SOFTWARE_RENDERER.test(renderer)) {
      releaseWebGL2({ canvas, context });
      return null;
    }
    return { canvas, context };
  } catch {
    return null;
  }
}

export function releaseWebGL2(acquired: AcquiredContext): void {
  acquired.context.getExtension('WEBGL_lose_context')?.loseContext();
}
