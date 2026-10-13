import { useRef } from 'react';
import { domains } from '../content/systems';
import { useInView } from '../lib/useInView';
import './ticker.css';

/**
 * A continuously moving line of expertise along the foot of the hero —
 * the same capabilities the Systems Map documents, so nothing here is
 * decoration only. The strip is duplicated for a seamless loop; the copy is
 * hidden from assistive technology. It pauses when off-screen, on hover
 * and whenever motion is off, where it becomes a plain scrollable list.
 */
export function Ticker() {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref);
  const strip = (hidden: boolean) => (
    <ul className={`ticker__strip${hidden ? ' ticker__strip--copy' : ''}`} role="list" aria-hidden={hidden || undefined}>
      {domains.map((domain) => (
        <li key={domain.id} className="ticker__group">
          <span className="ticker__domain">{domain.title}</span>
          {domain.skills.map((skill) => (
            <span key={skill.name} className="ticker__skill">
              {skill.name}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={ref} className="ticker" role="marquee" aria-label="Expertise" data-active={active ? '' : undefined}>
      <div className="ticker__track">
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  );
}
