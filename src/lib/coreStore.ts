import { useSyncExternalStore } from 'react';
import type { ProjectId } from '../content/projects';

/**
 * The sculpture layer's state, shared between the fixed canvas (which
 * decides it) and the places that react to it: the hero's "View in 3D"
 * button, and — via `html[data-core]` — the stills that cross-fade out
 * once the live scene has taken over.
 */
export type CoreMode = 'poster' | 'loading' | 'live' | 'fallback';

export interface CoreState {
  mode: CoreMode;
  /** A phone (or other low-tier device) that could run the scene on request. */
  offer3d: boolean;
  /** The visitor asked for the scene. */
  requested: boolean;
}

let state: CoreState = { mode: 'poster', offer3d: false, requested: false };
const serverSnapshot = state;
const listeners = new Set<() => void>();

let focus: ProjectId | null = null;
let onFocus: ((id: ProjectId | null) => void) | null = null;

function set(patch: Partial<CoreState>) {
  state = { ...state, ...patch };
  if (patch.mode) document.documentElement.dataset.core = patch.mode;
  for (const listener of listeners) listener();
}

export const coreStore = {
  get: (): CoreState => state,
  set,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  request3d() {
    set({ requested: true });
  },
  /** Hovering or focusing a project chip in the hero previews that project's form. */
  setFocus(id: ProjectId | null) {
    focus = id;
    onFocus?.(id);
  },
  getFocus: (): ProjectId | null => focus,
  watchFocus(listener: (id: ProjectId | null) => void): () => void {
    onFocus = listener;
    return () => {
      if (onFocus === listener) onFocus = null;
    };
  },
};

export function useCoreStore(): CoreState {
  return useSyncExternalStore(coreStore.subscribe, coreStore.get, () => serverSnapshot);
}
