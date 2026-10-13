/**
 * Progressive reveal for `[data-reveal]` elements.
 *
 * Prerendered content is visible by default. Before enabling the hidden
 * "pre-reveal" state we mark everything already on (or above) screen as
 * shown, so the only elements that ever start hidden are ones the reader
 * has not reached yet. If this never runs, nothing is ever hidden.
 */
export function initReveal(root: ParentNode = document): () => void {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  const threshold = window.innerHeight * 0.94;

  const pending: HTMLElement[] = [];
  for (const el of elements) {
    if (el.getBoundingClientRect().top < threshold) el.setAttribute('data-shown', '');
    else pending.push(el);
  }

  document.documentElement.classList.add('reveal-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-shown', '');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.01 },
  );
  for (const el of pending) observer.observe(el);

  return () => observer.disconnect();
}
