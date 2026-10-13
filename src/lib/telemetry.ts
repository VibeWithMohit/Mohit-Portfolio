import { useSyncExternalStore } from 'react';
import type { Tier } from './device';

/**
 * Live, honest numbers from the hero sculpture's render loop, published at
 * most twice a second so React never re-renders per frame.
 */
export type CoreStatus = 'pending' | 'static' | 'loading' | 'running' | 'idle' | 'failed';

export interface CoreTelemetry {
  status: CoreStatus;
  /** Why the core is in its current status, in plain words. */
  reason: string;
  tier: Tier | null;
  framesRendered: number;
  fps: number;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
  cpuFrameMs: number;
}

let state: CoreTelemetry = {
  status: 'pending',
  reason: 'Waiting for the page to settle',
  tier: null,
  framesRendered: 0,
  fps: 0,
  pixelRatio: 0,
  drawCalls: 0,
  triangles: 0,
  cpuFrameMs: 0,
};

const listeners = new Set<() => void>();

export const coreTelemetry = {
  get: (): CoreTelemetry => state,
  set(patch: Partial<CoreTelemetry>) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const serverSnapshot = state;

export function useCoreTelemetry(): CoreTelemetry {
  return useSyncExternalStore(coreTelemetry.subscribe, coreTelemetry.get, () => serverSnapshot);
}
