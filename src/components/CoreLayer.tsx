import { useEffect, useRef } from 'react';
import type { ProjectId } from '../content/projects';
import { coreStore, useCoreStore } from '../lib/coreStore';
import { acquireWebGL2, readDeviceProfile, releaseWebGL2, type AcquiredContext } from '../lib/device';
import { useMotion } from '../lib/motion-context';
import { coreTelemetry } from '../lib/telemetry';
import { coreContextAttributes, type CoreController } from '../three/types';
import './core-layer.css';

/** Run after the browser has finished the urgent work of the first load. */
function whenIdle(callback: () => void): () => void {
  // Safari has no requestIdleCallback; the DOM typings assume it does.
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 250);
  return () => clearTimeout(id);
}

const isPosterRender = () => new URLSearchParams(window.location.search).has('poster');

/** ?poster=<project> renders that project's form (scripts/poster.mjs renders all four). */
function posterFocus(): ProjectId | null {
  const value = new URLSearchParams(window.location.search).get('poster');
  return value === 'beamtransfer' || value === 'ambiora' || value === 'sggs-erp' ? value : null;
}

/**
 * The liquid-glass sculpture's canvas: one fixed, transparent layer behind
 * the page's content. The sculpture appears at the hero, then at the opening
 * of each project chapter, in that project's form. Stills of every form are
 * in the prerendered HTML and paint immediately; on capable devices the live
 * scene initialises in idle time and cross-fades in over them. Phones keep
 * the stills unless the visitor asks for 3D; any failure keeps them too.
 */
export function CoreLayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CoreController | null>(null);
  const { enabled: motion } = useMotion();
  const motionRef = useRef(motion);
  const { mode, requested } = useCoreStore();

  useEffect(() => {
    motionRef.current = motion;
    controllerRef.current?.setMotion(motion);
  }, [motion]);

  useEffect(() => {
    let disposed = false;
    let run = 0; // invalidates work started by an earlier decision
    let controller: CoreController | null = null;
    let acquired: AcquiredContext | null = null; // a probe context not yet handed to the scene
    let cancelIdle: (() => void) | null = null;
    let unwatchFocus: (() => void) | null = null;
    const poster = isPosterRender();
    if (poster) {
      document.documentElement.classList.add('poster-mode');
      // Each still is rendered on the page colour of the anchor that shows it.
      const base = new URLSearchParams(window.location.search).get('base');
      const hero = document.querySelector<HTMLElement>('[data-anchor="core"]');
      if (hero && base && /^[0-9a-f]{6}$/i.test(base)) hero.dataset.base = `#${base}`;
    }

    const teardown = () => {
      run++;
      cancelIdle?.();
      cancelIdle = null;
      unwatchFocus?.();
      unwatchFocus = null;
      controller?.dispose();
      controller = null;
      controllerRef.current = null;
      if (acquired) releaseWebGL2(acquired);
      acquired = null;
    };

    const fail = (reason: string) => {
      teardown();
      coreStore.set({ mode: 'fallback' });
      coreTelemetry.set({ status: 'failed', reason });
    };

    const decide = () => {
      teardown();
      const ticket = run;
      cancelIdle = whenIdle(() => {
        if (disposed || ticket !== run) return;
        const forced = new URLSearchParams(window.location.search).get('core');
        const device = readDeviceProfile();

        if (forced === 'static') {
          coreStore.set({ mode: 'poster' });
          coreTelemetry.set({ status: 'static', tier: device.tier, reason: 'Still images requested with ?core=static' });
          return;
        }
        // Phones keep the stills without touching the GPU; 3D stays one tap away.
        if (device.tier === 'low' && !requested && forced !== '3d' && !poster) {
          coreStore.set({ mode: 'poster', offer3d: typeof WebGL2RenderingContext !== 'undefined' });
          coreTelemetry.set({
            status: 'static',
            tier: device.tier,
            reason: 'Small screen or data saver: the still images are used unless you ask for 3D',
          });
          return;
        }
        const probeStart = performance.now();
        acquired = acquireWebGL2(coreContextAttributes(poster));
        performance.measure('core: acquire WebGL2 context', { start: probeStart, end: performance.now() });
        if (!acquired) {
          coreStore.set({ mode: 'fallback', offer3d: false });
          coreTelemetry.set({
            status: 'failed',
            tier: device.tier,
            reason: 'Hardware-accelerated WebGL2 is not available here, so the still images are shown',
          });
          return;
        }

        coreStore.set({ mode: 'loading' });
        coreTelemetry.set({ status: 'loading', tier: device.tier, reason: 'Fetching the 3D module after the page settled' });
        const importStart = performance.now();
        import('../three/liquidCore')
          .then(({ createLiquidCore }) => {
            performance.measure('core: fetch + evaluate module', { start: importStart, end: performance.now() });
            if (disposed || ticket !== run || !hostRef.current || !acquired) return;
            const gl = acquired;
            acquired = null; // the scene owns it now, and loses it on dispose
            controller = createLiquidCore({
              gl,
              host: hostRef.current,
              tier: poster || device.tier === 'high' ? 'high' : 'medium',
              motion: motionRef.current,
              poster,
              onContextLost: () => fail('The GPU context was lost; the still images were restored'),
            });
            controller.setFocus(poster ? posterFocus() : coreStore.getFocus());
            unwatchFocus = coreStore.watchFocus((id) => controller?.setFocus(id));
            controllerRef.current = controller;
            return controller.ready.then(() => {
              if (!disposed && ticket === run) coreStore.set({ mode: 'live', offer3d: false });
            });
          })
          .catch(() => {
            if (!disposed && ticket === run) fail('The 3D module could not be started');
          });
      });
    };

    // Crossing the breakpoint tears the scene down; show the stills at once.
    const redecide = () => {
      coreStore.set({ mode: 'poster' });
      decide();
    };

    decide();
    const breakpoint = window.matchMedia('(min-width: 48rem)');
    breakpoint.addEventListener('change', redecide);
    return () => {
      disposed = true;
      breakpoint.removeEventListener('change', redecide);
      teardown();
    };
  }, [requested]);

  return <div ref={hostRef} className="core-layer" data-mode={mode} aria-hidden="true" />;
}
