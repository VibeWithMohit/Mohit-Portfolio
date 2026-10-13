import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { SectionHead } from '../../components/SectionHead';
import { profile } from '../../content/profile';
import './contact.css';

/** Mohit's local time, rendered only on the client (no hydration mismatch). */
function LocalTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return <span>{profile.timeZoneLabel}</span>;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: profile.timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return (
    <span>
      <time dateTime={now.toISOString()}>{time}</time> · {profile.timeZoneLabel}
    </span>
  );
}

type CopyState = 'idle' | 'copied' | 'selected';

/**
 * 07 — Contact. Every action here works without any service behind it:
 * a mailto link, a copy-to-clipboard button (with a selection fallback) and
 * the two public profiles. The résumé link appears once profile.resumeUrl is set.
 */
export function Contact() {
  const emailRef = useRef<HTMLAnchorElement>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copyAddress = async () => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopy('copied');
    } catch {
      // Clipboard unavailable (permissions, insecure context): select the
      // address instead so it can be copied by hand.
      const node = emailRef.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopy('selected');
    }
    timer.current = window.setTimeout(() => setCopy('idle'), 2800);
  };

  const { github, linkedin } = profile.links;

  return (
    <section id="contact" className="sheet theme-light contact" aria-labelledby="contact-title">
      <div className="container">
        <SectionHead id="contact" />

        <div className="contact__grid">
          <div className="contact__primary">
            <p className="contact__lede" data-reveal>
              Building something that has to work in the real world? I’d like to hear about it.
            </p>
            <a ref={emailRef} className="contact__email display" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <div className="contact__actions">
              <a className="button glass glass--prominent glass--interactive" href={`mailto:${profile.email}`}>
                <Icon name="mail" className="icon" />
                Write an email
              </a>
              <button type="button" className="button glass glass--interactive" onClick={copyAddress}>
                <Icon name={copy === 'copied' ? 'check' : 'copy'} className="icon" />
                {copy === 'copied' ? 'Copied' : 'Copy address'}
              </button>
              <span className="sr-only" aria-live="polite">
                {copy === 'copied'
                  ? 'Email address copied to the clipboard.'
                  : copy === 'selected'
                    ? 'Address selected. Press Control or Command and C to copy it.'
                    : ''}
              </span>
            </div>
          </div>

          <div className="contact__secondary">
            {/* A small control panel of outbound links, in glass over a lit backdrop. */}
            <ul className="contact__links glass glass--thick" role="list" data-reveal="scale">
              {[github, linkedin].map((link) => (
                <li key={link.href}>
                  <a className="contact__link" href={link.href} rel="me noopener">
                    <span className="contact__network label">{link.label}</span>
                    <span className="contact__handle">{link.handle}</span>
                    <Icon name="arrow-out" className="icon icon--out" />
                  </a>
                </li>
              ))}
              {profile.resumeUrl && (
                <li>
                  <a className="contact__link" href={profile.resumeUrl}>
                    <span className="contact__network label">Résumé</span>
                    <span className="contact__handle">Download (PDF)</span>
                    <Icon name="arrow-down" className="icon icon--down" />
                  </a>
                </li>
              )}
            </ul>

            <dl className="contact__meta">
              <div>
                <dt className="label">Based in</dt>
                <dd>{profile.location}</dd>
              </div>
              <div>
                <dt className="label">Local time</dt>
                <dd>
                  <LocalTime />
                </dd>
              </div>
              <div>
                <dt className="label">Coordinates</dt>
                <dd>{profile.coordinates}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
