import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MOTION_STORAGE_KEY, MotionContext } from './motion-context';

/**
 * The inline script in index.html sets <html data-motion> before first
 * paint (stored choice, else the OS reduced-motion preference). This provider
 * adopts that value and keeps it in sync with the in-page toggle.
 */
function readDocumentMotion(): boolean {
  return typeof document === 'undefined' ? true : document.documentElement.dataset.motion !== 'off';
}

function readStoredChoice(): string | null {
  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(readDocumentMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (readStoredChoice()) return; // an explicit choice outranks the OS setting
      const on = !query.matches;
      document.documentElement.dataset.motion = on ? 'on' : 'off';
      setEnabledState(on);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    document.documentElement.dataset.motion = on ? 'on' : 'off';
    try {
      window.localStorage.setItem(MOTION_STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
    setEnabledState(on);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}
