import type { SculptureState } from '../three/sculpture';

/**
 * A still of the sculpture in one of its forms, rendered from the live scene
 * by scripts/poster.mjs. Transparent, so it sits on any page colour.
 */
export function CoreStill({ state, eager = false }: { state: SculptureState; eager?: boolean }) {
  const base = `/poster/${state}`;
  return (
    <img
      className="core-still"
      src={`${base}-1200.webp`}
      srcSet={`${base}-640.webp 640w, ${base}-1200.webp 1200w`}
      sizes="(min-width: 64rem) min(48vw, 80vh, 50rem), min(75vw, 50vh, 27.5rem)"
      width={1200}
      height={1200}
      alt=""
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
    />
  );
}
