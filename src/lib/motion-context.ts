import { createContext, useContext, useSyncExternalStore } from 'react';

export const MOTION_STORAGE_KEY = 'sim:motion';

export interface MotionState {
  /** True when ambient and decorative motion may run. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

export const MotionContext = createContext<MotionState>({ enabled: true, setEnabled: () => {} });

export function useMotion(): MotionState {
  return useContext(MotionContext);
}

const noopSubscribe = () => () => {};

/**
 * False during prerender and the hydration pass, true afterwards. Use it to
 * gate markup that depends on browser-only state, so hydration always matches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
