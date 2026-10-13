/**
 * Interactive glass follows the pointer: one delegated listener moves the
 * specular highlight (--g-x / --g-y) of whichever `.glass--interactive`
 * element is under the pointer or finger. Keyboard focus gets the same
 * highlight from CSS (centred). Direct manipulation, so it stays on even
 * when ambient motion is paused.
 */
export function installGlassPointer(): () => void {
  let current: HTMLElement | null = null;
  let frame = 0;
  let x = 0;
  let y = 0;

  const apply = () => {
    frame = 0;
    if (!current) return;
    const rect = current.getBoundingClientRect();
    current.style.setProperty('--g-x', `${(((x - rect.left) / rect.width) * 100).toFixed(1)}%`);
    current.style.setProperty('--g-y', `${(((y - rect.top) / rect.height) * 100).toFixed(1)}%`);
  };

  const track = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.glass--interactive') : null;
    if (target !== current) {
      current?.style.removeProperty('--g-x');
      current?.style.removeProperty('--g-y');
      current = target;
    }
    if (!current) return;
    x = event.clientX;
    y = event.clientY;
    if (frame === 0) frame = requestAnimationFrame(apply);
  };

  document.addEventListener('pointermove', track, { passive: true });
  document.addEventListener('pointerdown', track, { passive: true });
  return () => {
    document.removeEventListener('pointermove', track);
    document.removeEventListener('pointerdown', track);
    cancelAnimationFrame(frame);
  };
}

/** Chromium accepts SVG filter references in backdrop-filter; others don't render them. */
export function detectRefractionSupport(): boolean {
  const brands = navigator.userAgentData?.brands ?? [];
  return brands.some((b) => /Chromium/i.test(b.brand));
}
