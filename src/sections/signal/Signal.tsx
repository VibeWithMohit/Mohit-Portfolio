import { Fragment, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { Ticker } from '../../components/Ticker';
import { headline, profile } from '../../content/profile';
import { projects, type ProjectId } from '../../content/projects';
import { coreStore } from '../../lib/coreStore';
import { CoreStage } from './CoreStage';
import './signal.css';

/**
 * 01 — The Signal. Name, role, statement and actions are prerendered HTML and
 * paint first; the liquid-glass sculpture sits behind them. The headline
 * arrives in stages — the name rising through a clipping mask, the role
 * tightening into place, the statement word by word — and the ticker beneath
 * keeps the hero in motion. Hovering, focusing or touching a project chip
 * morphs the sculpture into that project's form before the reader scrolls on.
 */
export function Signal() {
  const [focus, setFocus] = useState<ProjectId | null>(null);
  const preview = (id: ProjectId | null) => {
    setFocus(id);
    coreStore.setFocus(id);
  };

  return (
    <section id="top" className="hero theme-light" aria-labelledby="hero-title">
      <CoreStage />

      <div className="hero__inner container">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title">
            <span className="hero__name-mask">
              <span className="hero__name display">{profile.displayName}</span>
            </span>
            <span className="sr-only"> Kumar, </span>
            <span className="hero__role">{profile.role}</span>
          </h1>
          <p className="hero__statement">
            {headline.statement.split(' ').map((word, i) => (
              <Fragment key={word + i}>
                {i > 0 && ' '}
                <span className="hero__word" style={{ '--i': i } as CSSProperties}>
                  <span className="hero__word-inner">{word}</span>
                </span>
              </Fragment>
            ))}
          </p>
          <div className="hero__actions">
            <a className="button glass glass--prominent glass--interactive magnetic" href="#work">
              View projects
              <Icon name="arrow-down" className="icon icon--down" />
            </a>
            {profile.resumeUrl && (
              <a className="button glass glass--interactive magnetic" href={profile.resumeUrl}>
                Résumé
              </a>
            )}
            <a className="button glass glass--interactive magnetic" href="#contact">
              Contact
            </a>
          </div>
        </div>

        <nav className="hero__projects" aria-label="Flagship projects">
          <ul className="hero__chips" role="list">
            {projects.map((project, i) => (
              <li key={project.id} style={{ '--i': i } as CSSProperties}>
                <a
                  className="project-chip glass glass--interactive"
                  href={`#project-${project.id}`}
                  data-active={focus === project.id ? '' : undefined}
                  onPointerEnter={() => preview(project.id)}
                  onPointerLeave={() => preview(null)}
                  onFocus={() => preview(project.id)}
                  onBlur={() => preview(null)}
                >
                  <span className="project-chip__index tabular">{project.index}</span>
                  <span className="project-chip__text">
                    <span className="project-chip__name">{project.shortName}</span>
                    <span className="project-chip__desc">{project.descriptor}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Ticker />
    </section>
  );
}
