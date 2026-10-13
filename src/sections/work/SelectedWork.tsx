import { useRef, type CSSProperties, type ReactNode } from 'react';
import { CoreStill } from '../../components/CoreStill';
import { Figure } from '../../components/Figure';
import { Icon } from '../../components/Icon';
import { SectionHead } from '../../components/SectionHead';
import { profile } from '../../content/profile';
import { projects, type Project, type ProjectId } from '../../content/projects';
import { useMotion } from '../../lib/motion-context';
import { useScrollProgress } from '../../lib/scroll';
import { BeamStream } from './BeamStream';
import { DepthWalk } from './DepthWalk';
import { ErpDiagram } from './ErpDiagram';
import './work.css';

const FIGURES: Record<ProjectId, () => ReactNode> = {
  beamtransfer: () => <BeamStream />,
  ambiora: () => <DepthWalk />,
  'sggs-erp': () => <ErpDiagram />,
};

/**
 * Depth-aware entrance: each figure rises out of the page plane — from a
 * little behind it, tilted, to flat and present — as it scrolls into view.
 * Purely a CSS transform driven by one custom property; flat under reduced motion.
 */
function DepthStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { enabled } = useMotion();
  useScrollProgress(
    ref,
    (progress) => {
      const enter = Math.min(1, Math.max(0, (progress - 0.02) / 0.32));
      ref.current?.style.setProperty('--enter', enter.toFixed(3));
    },
    enabled,
  );
  return (
    <div ref={ref} className="depth-stage">
      {children}
    </div>
  );
}

/**
 * A chapter opens cinematically — the sculpture arrives in this project's
 * form beside the title — and then reads as a conventional case study:
 * a working figure, the summary, the technical insight, verified notes,
 * capabilities and stack.
 */
function ProjectChapter({ project, figureNumber }: { project: Project; figureNumber: string }) {
  const titleId = `project-${project.id}-title`;
  return (
    <article
      id={`project-${project.id}`}
      className={`project theme-${project.theme} project--${project.id}`}
      aria-labelledby={titleId}
    >
      <div className="container project__inner">
        <header className="project__head">
          <div className="project__head-text">
            <p className="eyebrow" data-reveal>
              <span className="eyebrow__num">{project.index}</span>
              {project.kind}
            </p>
            <h3 id={titleId} className="project__title display" data-reveal="depth">
              {project.name}
            </h3>
            <p className="project__headline" data-reveal style={{ '--reveal-delay': '120ms' } as CSSProperties}>
              {project.headline}
            </p>
          </div>
          <div
            className="project__stage core-anchor"
            data-anchor={project.id}
            data-base={project.theme === 'white' ? '#ffffff' : '#f5f4f0'}
            aria-hidden="true"
          >
            <CoreStill state={project.id} />
          </div>
        </header>

        <DepthStage>
          <Figure number={figureNumber} label={project.figure.label} caption={project.figure.caption}>
            {FIGURES[project.id]()}
          </Figure>
        </DepthStage>

        <div className="project__body">
          <div className="project__story">
            <p className="project__summary" data-reveal>
              {project.summary}
            </p>
            <section className="project__insight surface" aria-labelledby={`${titleId}-insight`} data-reveal="scale">
              <h4 id={`${titleId}-insight`} className="project__insight-title">
                {project.insight.title}
              </h4>
              <p>{project.insight.body}</p>
            </section>
            {project.notes.map((note) => (
              <p key={note} className="project__note" data-reveal>
                <span className="label">Verified note</span>
                {note}
              </p>
            ))}
            {project.disclosure && (
              <p className="project__note" data-reveal>
                <span className="label">Privacy</span>
                {project.disclosure}
              </p>
            )}
          </div>

          <div className="project__spec" data-reveal>
            <dl className="project__caps">
              {project.capabilities.map((group) => (
                <div key={group.label} className="project__cap">
                  <dt className="label">{group.label}</dt>
                  <dd>
                    <ul role="list">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="chips" aria-label={`${project.shortName} technologies`}>
              {project.stack.map((item) => (
                <li key={item} className="chip">
                  {item}
                </li>
              ))}
            </ul>
            <a
              className="link link--standalone project__ask"
              href={`mailto:${profile.email}?subject=${encodeURIComponent(`About ${project.name}`)}`}
            >
              Ask about {project.shortName}
              <Icon name="arrow-right" className="icon icon--right" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SelectedWork() {
  return (
    <section id="work" className="work" aria-labelledby="work-title">
      <div className="sheet theme-light work__intro">
        <div className="container">
          <SectionHead
            id="work"
            lede="Three systems for three kinds of reality: light passing between two devices, a place rendered in a browser, and the everyday workflows of an institution."
            aside={
              <ol className="work__toc" role="list">
                {projects.map((p, i) => (
                  <li key={p.id} data-reveal style={{ '--reveal-delay': `${120 + i * 80}ms` } as CSSProperties}>
                    <a href={`#project-${p.id}`} className="work__toc-link">
                      <span className="work__toc-index tabular">{p.index}</span>
                      <span>{p.shortName}</span>
                      <Icon name="arrow-down" className="icon icon--down" />
                    </a>
                  </li>
                ))}
              </ol>
            }
          />
        </div>
      </div>
      {projects.map((project, i) => (
        <ProjectChapter key={project.id} project={project} figureNumber={String(i + 2).padStart(2, '0')} />
      ))}
    </section>
  );
}
