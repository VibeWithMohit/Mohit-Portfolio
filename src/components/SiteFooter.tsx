import { profile } from '../content/profile';
import { buildDate } from '../lib/date';
import { Icon } from './Icon';
import './site-footer.css';

export function SiteFooter() {
  return (
    <footer className="site-footer theme-light">
      <div className="container site-footer__inner">
        <p className="site-footer__mark">
          <span className="site-footer__title">Systems in Motion</span>
          <span className="muted">
            © {buildDate().getFullYear()} {profile.name}
          </span>
        </p>
        <p className="site-footer__colophon muted">
          Built with React, TypeScript and three.js. Prerendered, so it reads without JavaScript. Set in Inter, under
          the SIL Open Font License.
        </p>
        <a className="link link--standalone site-footer__top" href="#top">
          Back to top
          <Icon name="arrow-up" className="icon" />
        </a>
      </div>
    </footer>
  );
}
