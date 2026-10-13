import { useEffect, useRef, type RefObject } from 'react';

/**
 * A minimal scroll engine. One passive scroll listener and one
 * IntersectionObserver serve every subscriber; only elements near the
 * viewport are measured, and all measurement happens in a single rAF.
 *
 * Progress is 0 when an element's top touches the bottom of the viewport and
 * 1 when its bottom leaves the top — a continuous "pass-through" value.
 */
export type ScrollCallback = (progress: number, rect: DOMRectReadOnly) => void;

interface Subscriber {
  callback: ScrollCallback;
}

interface Tracked {
  active: boolean;
  subscribers: Set<Subscriber>;
}

const tracked = new Map<Element, Tracked>();
let observer: IntersectionObserver | null = null;
let frame = 0;

function schedule() {
  if (frame === 0) frame = requestAnimationFrame(flush);
}

function flush() {
  frame = 0;
  const viewport = window.innerHeight;
  for (const [element, entry] of tracked) {
    if (!entry.active) continue;
    const rect = element.getBoundingClientRect();
    const raw = (viewport - rect.top) / (viewport + rect.height);
    const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    for (const sub of entry.subscribers) sub.callback(progress, rect);
  }
}

function ensureListening() {
  if (observer) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const item of entries) {
        const entry = tracked.get(item.target);
        if (entry) entry.active = item.isIntersecting;
      }
      schedule();
    },
    { rootMargin: '15% 0px 15% 0px' },
  );
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

function stopListening() {
  if (!observer || tracked.size > 0) return;
  observer.disconnect();
  observer = null;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
}

export function observeScroll(element: Element, callback: ScrollCallback): () => void {
  ensureListening();
  let entry = tracked.get(element);
  if (!entry) {
    entry = { active: false, subscribers: new Set() };
    tracked.set(element, entry);
    observer?.observe(element);
  }
  const subscriber: Subscriber = { callback };
  entry.subscribers.add(subscriber);
  schedule();

  return () => {
    const current = tracked.get(element);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      tracked.delete(element);
      observer?.unobserve(element);
      stopListening();
    }
  };
}

/** Subscribe an element to scroll progress while `enabled`. The callback may change freely. */
export function useScrollProgress<T extends Element>(
  ref: RefObject<T | null>,
  callback: ScrollCallback,
  enabled = true,
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return observeScroll(element, (p, rect) => callbackRef.current(p, rect));
  }, [ref, enabled]);
}
