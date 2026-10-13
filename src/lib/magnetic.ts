/**
 * Magnetic controls: elements marked `.magnetic` lean towards a fine pointer
 * that comes near, by a few pixels, and settle back when it leaves. The
 * movement is written to --mx / --my and applied in CSS with the glass
 * material's own easing. Mouse only, motion on only; nothing depends on it.
 */
export function installMagnetic(): () => void {
  if (!window.matchMedia('(pointer: fine)').matches) return () => {};

  let elements: HTMLElement[] = [];
  let rects: DOMRect[] = [];
  let frame = 0;
  let px = -1e6;
  let py = -1e6;

  const collect = () => {
    elements = Array.from(document.querySelectorAll<HTMLElement>('.magnetic'));
    rects = elements.map((el) => el.getBoundingClientRect());
  };

  const clear = (el: HTMLElement) => {
    if (!el.dataset.magnet) return;
    delete el.dataset.magnet;
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  };

  const apply = () => {
    frame = 0;
    const on = document.documentElement.dataset.motion !== 'off';
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]!;
      const r = rects[i]!;
      if (!on || r.width === 0) {
        clear(el);
        continue;
      }
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height / 2);
      const reach = Math.max(r.width, r.height) * 0.75 + 28;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) {
        clear(el);
        continue;
      }
      const pull = (1 - dist / reach) * 0.28;
      el.dataset.magnet = '';
      el.style.setProperty('--mx', `${(dx * pull).toFixed(1)}px`);
      el.style.setProperty('--my', `${(dy * pull).toFixed(1)}px`);
    }
  };

  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(apply);
  };
  const onPointerMove = (event: PointerEvent) => {
    px = event.clientX;
    py = event.clientY;
    schedule();
  };
  const onLayout = () => {
    collect();
    schedule();
  };

  collect();
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onLayout, { passive: true });
  window.addEventListener('resize', onLayout, { passive: true });
  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onLayout);
    window.removeEventListener('resize', onLayout);
    cancelAnimationFrame(frame);
    for (const el of elements) clear(el);
  };
}
