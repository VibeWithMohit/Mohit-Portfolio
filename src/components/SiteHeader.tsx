import { useEffect, useRef, useState } from 'react';
import { profile } from '../content/profile';
import { primaryNav, sections, sheetNumber, type SectionId } from '../content/sections';
import { Icon } from './Icon';
import { MotionToggle } from './MotionToggle';
import { RefractionFilter } from './RefractionFilter';
import './site-header.css';

/** Which section crosses the reading line (~42% down the viewport). */
function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    const intersecting = new Set<string>();
    const order = sections.map((s) => s.id as string);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id);
          else intersecting.delete(entry.target.id);
        }
        const current = order.filter((id) => intersecting.has(id)).pop();
        setActive((current as SectionId | undefined) ?? null);
      },
      { rootMargin: '-42% 0px -57% 0px' },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return active;
}

/** Compact while reading downwards; full size near the top or when scrolling up. */
function useScrollState(): { compact: boolean; scrolled: boolean } {
  const [state, setState] = useState({ compact: false, scrolled: false });
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      setState((prev) => {
        let compact = prev.compact;
        if (y < 160) compact = false;
        else if (delta > 8) compact = true;
        else if (delta < -8) compact = false;
        const scrolled = y > 8;
        return compact === prev.compact && scrolled === prev.scrolled ? prev : { compact, scrolled };
      });
      if (Math.abs(delta) > 8) last = y;
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return state;
}

export function SiteHeader() {
  const active = useActiveSection();
  const { compact, scrolled } = useScrollState();
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The selection lens glides (and briefly stretches) to the active link —
  // the web counterpart of glass morphing between positions.
  useEffect(() => {
    const list = listRef.current;
    const lens = lensRef.current;
    if (!list || !lens) return;
    const place = () => {
      const link = active ? list.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
      if (!link) {
        lens.removeAttribute('data-visible');
        return;
      }
      lens.style.setProperty('--lens-x', `${link.offsetLeft}px`);
      lens.style.setProperty('--lens-w', `${link.offsetWidth}px`);
      lens.setAttribute('data-visible', '');
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setMenuOpen(false);
      document.documentElement.classList.remove('menu-open');
    };
    dialog.addEventListener('close', onClose);
    const wide = window.matchMedia('(min-width: 62rem)');
    const onWide = () => {
      if (wide.matches && dialog.open) dialog.close();
    };
    wide.addEventListener('change', onWide);
    return () => {
      dialog.removeEventListener('close', onClose);
      wide.removeEventListener('change', onWide);
    };
  }, []);

  const openMenu = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setMenuOpen(true);
    document.documentElement.classList.add('menu-open');
  };
  const closeMenu = () => dialogRef.current?.close();

  return (
    <>
      <div className="scroll-edge" data-visible={scrolled ? '' : undefined} aria-hidden="true" />
      <header className="site-header">
        <div
          ref={barRef}
          className="site-header__bar glass glass--refract"
          data-compact={compact ? '' : undefined}
        >
          <a className="brand" href="#top">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="brand-glass" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <rect x="4" y="9" width="24" height="14" rx="7" fill="none" stroke="url(#brand-glass)" strokeWidth="2" />
              <rect x="9.5" y="13" width="13" height="6" rx="3" fill="currentColor" opacity="0.9" />
            </svg>
            <span className="brand__name">{profile.displayName}</span>
            <span className="sr-only"> Kumar, back to top</span>
          </a>

          <nav className="site-nav" aria-label="Primary">
            <span ref={lensRef} className="site-nav__lens" aria-hidden="true" />
            <ul ref={listRef} className="site-nav__list" role="list">
              {primaryNav.map((item) => (
                <li key={item.id}>
                  <a className="site-nav__link" href={`#${item.id}`} aria-current={active === item.id ? 'true' : undefined}>
                    {item.nav}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            <MotionToggle className="site-header__motion" />
            <a
              className="site-header__cta"
              href="#contact"
              aria-current={active === 'contact' ? 'true' : undefined}
            >
              Contact
            </a>
            <button
              type="button"
              className="site-header__menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={openMenu}
            >
              <Icon name="menu" className="icon" />
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </div>
        <RefractionFilter targetRef={barRef} />
      </header>

      <dialog ref={dialogRef} id="site-menu" className="site-menu glass glass--thick" aria-labelledby="site-menu-title">
        <div className="site-menu__top">
          <p id="site-menu-title" className="label">
            {profile.name}
          </p>
          <button type="button" className="site-menu__close" onClick={closeMenu}>
            <Icon name="close" className="icon" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <nav aria-label="Site menu">
          <ol className="site-menu__list" role="list">
            {sections.map((item) => (
              <li key={item.id}>
                <a className="site-menu__link" href={`#${item.id}`} onClick={closeMenu}>
                  <span className="site-menu__num tabular" aria-hidden="true">
                    {sheetNumber(item.id)}
                  </span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="site-menu__foot">
          <MotionToggle variant="labelled" />
          <a className="link" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
        </div>
      </dialog>
    </>
  );
}
