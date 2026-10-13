import { useEffect, useRef, useState } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { projects, type ProjectId } from '../../content/projects';
import { domains, skillCount } from '../../content/systems';
import './systems.css';

/**
 * 03 — Systems Map. Capabilities by engineering domain as an evidence
 * matrix: every row is backed by at least one flagship project (enforced in
 * content.test.ts). It is a real <table>, so the structure is navigable by
 * screen readers; the "bus" styling is presentation only.
 *
 * The filter is a glass segmented control that stays within reach while the
 * matrix scrolls beneath it; its selection lens glides between segments.
 */
export function SystemsMap() {
  const [filter, setFilter] = useState<ProjectId | null>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);

  // Place the lens under the pressed segment (and keep it there on resize).
  useEffect(() => {
    const control = controlRef.current;
    const lens = lensRef.current;
    if (!control || !lens) return;
    const place = () => {
      const pressed = control.querySelector<HTMLElement>(`[data-segment="${filter ?? 'all'}"]`);
      if (!pressed) return;
      lens.style.setProperty('--lens-x', `${pressed.offsetLeft}px`);
      lens.style.setProperty('--lens-w', `${pressed.offsetWidth}px`);
    };
    place();
    // Enable the glide only after the first placement, so it never slides in from 0.
    const frame = requestAnimationFrame(() => {
      control.dataset.lens = 'ready';
    });
    const observer = new ResizeObserver(place);
    observer.observe(control);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [filter]);

  return (
    <section id="systems" className="sheet theme-light systems" aria-labelledby="systems-title">
      <div className="container">
        <SectionHead
          id="systems"
          lede="Capabilities grouped by engineering domain. Nothing is listed on reputation: every row points to the project that shows it."
          aside={
            <p className="label systems__count">
              {domains.length} domains · {skillCount} capabilities · {projects.length} projects
            </p>
          }
        />

        <div
          ref={controlRef}
          className="systems__controls glass"
         
          role="group"
          aria-label="Highlight evidence from one project"
        >
          <span ref={lensRef} className="systems__lens" aria-hidden="true" />
          <button
            type="button"
            className="systems__filter"
            data-segment="all"
            aria-pressed={filter === null}
            onClick={() => setFilter(null)}
          >
            All<span className="systems__filter-more"> projects</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className="systems__filter"
              data-segment={p.id}
              aria-pressed={filter === p.id}
              onClick={() => setFilter(filter === p.id ? null : p.id)}
            >
              <span className="systems__filter-index tabular">{p.index}</span> {p.shortName}
            </button>
          ))}
        </div>

        <div className="systems__scroll surface">
          <table className="matrix" data-filter={filter ?? undefined}>
            <caption className="sr-only">
              Capabilities by engineering domain, with the flagship projects that evidence each one.
            </caption>
            <colgroup>
              <col className="matrix__col-skill" />
              {projects.map((p) => (
                <col key={p.id} className={`matrix__col-project${filter === p.id ? ' is-active' : ''}`} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="matrix__corner label">
                  Capability
                </th>
                {projects.map((p) => (
                  <th key={p.id} scope="col" className={`matrix__project${filter === p.id ? ' is-active' : ''}`}>
                    <a href={`#project-${p.id}`}>
                      <span className="matrix__project-index tabular">{p.index}</span>
                      <span className="matrix__project-name">{p.shortName}</span>
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            {domains.map((domain) => (
              <tbody key={domain.id}>
                <tr className="matrix__domain">
                  <th scope="rowgroup" colSpan={projects.length + 1}>
                    <span className="matrix__domain-title">{domain.title}</span>
                    <span className="matrix__domain-summary">{domain.summary}</span>
                  </th>
                </tr>
                {domain.skills.map((skill) => {
                  const dim = filter !== null && !skill.evidence.includes(filter);
                  return (
                    <tr key={skill.name} className={`matrix__row${dim ? ' is-dim' : ''}`}>
                      <th scope="row" className="matrix__skill">
                        {skill.name}
                      </th>
                      {projects.map((p) => {
                        const has = skill.evidence.includes(p.id);
                        return (
                          <td
                            key={p.id}
                            className={`matrix__cell${has ? ' has-evidence' : ''}${filter === p.id ? ' is-active' : ''}`}
                          >
                            {has ? (
                              <span className="matrix__dot">
                                <span className="sr-only">Shown in {p.shortName}</span>
                              </span>
                            ) : (
                              <span className="sr-only">Not shown in {p.shortName}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
