/**
 * In-page navigation that works for every input method: smooth scrolling
 * only when motion is enabled, the URL hash kept in sync, and keyboard /
 * screen-reader focus moved to the destination so the next Tab continues
 * from there instead of from the link that was activated.
 */
export function installAnchorNavigation(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;

    const id = decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '');
    const destination = id ? document.getElementById(id) : null;
    if (!destination) return;

    event.preventDefault();
    navigateTo(destination);
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}

export function navigateTo(destination: HTMLElement): void {
  const smooth = document.documentElement.dataset.motion !== 'off';
  destination.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
  destination.focus({ preventScroll: true });
}
