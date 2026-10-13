import { useRef, type CSSProperties, type ReactNode } from 'react';
import { sectionMeta, sheetNumber, type SectionId } from '../content/sections';
import { useMotion } from '../lib/motion-context';
import { useScrollProgress } from '../lib/scroll';
import './section-head.css';

/**
 * Section heading: a quiet eyebrow, a large metallic title and an optional
 * lede. As the title passes through the viewport a soft specular sheen
 * travels across it — the type catching light, the way glass does.
 */
export function SectionHead({ id, lede, aside }: { id: SectionId; lede?: ReactNode; aside?: ReactNode }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { enabled } = useMotion();
  const meta = sectionMeta(id);

  useScrollProgress(
    titleRef,
    (progress) => {
      titleRef.current?.style.setProperty('--sheen', (progress * 1.5 - 0.25).toFixed(3));
    },
    enabled,
  );

  return (
    <header className="section-head">
      <p className="eyebrow" data-reveal>
        <span className="eyebrow__num">{sheetNumber(id)}</span>
        {meta.kicker}
      </p>
      <div className="section-head__body">
        <h2 ref={titleRef} id={`${id}-title`} className="section-head__title display" data-reveal="depth">
          {meta.title}
        </h2>
        {(lede || aside) && (
          <div className="section-head__meta" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
            {lede && <p className="lede">{lede}</p>}
            {aside}
          </div>
        )}
      </div>
    </header>
  );
}
