import type { ProjectId } from '../content/projects';
import type { SculptureState } from './sculpture';

/**
 * The contract between React and the imperative WebGL scene. Kept in its own
 * module so importing the types never pulls three.js into the main bundle.
 */
export interface CoreController {
  /**
   * Resolves once the scene has initialised progressively (forms computed,
   * environment prefiltered, shaders compiled) and its first frame exists.
   */
  ready: Promise<void>;
  canvas: HTMLCanvasElement;
  /** Hover/focus override while the hero anchor is active (null = the anchor's own state). */
  setFocus(id: ProjectId | null): void;
  /** Ambient animation on/off. Off renders single frames on demand only. */
  setMotion(enabled: boolean): void;
  /** Re-read the page's anchors (after layout changes that add or remove them). */
  refreshAnchors(): void;
  dispose(): void;
}

/** Context attributes the scene needs; the WebGL probe creates its context with them. */
export function coreContextAttributes(poster: boolean): WebGLContextAttributes {
  return {
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    depth: true,
    stencil: false,
    powerPreference: 'default',
    preserveDrawingBuffer: poster,
  };
}

/**
 * Where the sculpture may appear. Any element with `data-anchor="<state>"`
 * is one: the hero, and the opening of each project chapter. The scene
 * follows whichever anchor is on screen, in that anchor's form.
 */
export const ANCHOR_SELECTOR = '[data-anchor]';

export function anchorState(element: Element): SculptureState {
  const value = element.getAttribute('data-anchor');
  return value === 'beamtransfer' || value === 'ambiora' || value === 'sggs-erp' ? value : 'core';
}

export interface CoreOptions {
  /** The hardware WebGL2 context (and its canvas) acquired by the probe. */
  gl: { canvas: HTMLCanvasElement; context: WebGL2RenderingContext };
  /** Fixed, viewport-filling element the canvas fills. */
  host: HTMLElement;
  tier: 'high' | 'medium';
  motion: boolean;
  onContextLost: () => void;
  /** Render a single still at 2× for the poster images. */
  poster?: boolean;
}
