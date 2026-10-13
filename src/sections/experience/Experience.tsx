import { useRef, type CSSProperties } from 'react';
import { SectionHead } from '../../components/SectionHead';
import { education, roles } from '../../content/experience';
import { formatDayMonthYear, formatDuration, monthsBetween, parseDate, toFractionalYear } from '../../lib/date';
import { useInView } from '../../lib/useInView';
import { useToday } from '../../lib/useToday';
import './experience.css';

/**
 * 04 — Experience. Only verified facts: employer, title, start date and
 * education. Role highlights render once they are added to
 * src/content/experience.ts — there is no placeholder copy.
 */
export function Experience() {
  const today = useToday();
  const firstYear = 2023;
  const lastYear = today.getFullYear() + 1;
  const span = lastYear - firstYear;
  const at = (fractionalYear: number) => `${((fractionalYear - firstYear) / span) * 100}%`;
  const years = Array.from({ length: span + 1 }, (_, i) => firstYear + i);
  const nowPos = toFractionalYear(today);
  const timelineRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(timelineRef);

  return (
    <section id="experience" className="sheet theme-white experience" aria-labelledby="experience-title">
      <div className="container">
        <SectionHead id="experience" lede="Where the work happens now, and where it started." />

        <div ref={timelineRef} className="timeline" data-active={onScreen ? '' : undefined} aria-hidden="true">
          <div className="timeline__axis">
            {years.map((year) => (
              <span key={year} className="timeline__tick tabular" style={{ left: at(year) } as CSSProperties}>
                {year < lastYear ? year : ''}
              </span>
            ))}
          </div>
          {roles.map((role) => {
            const start = toFractionalYear(parseDate(role.start));
            const end = role.end ? toFractionalYear(parseDate(role.end)) : nowPos;
            return (
              <div key={role.id} className="timeline__track">
                <span className="timeline__bar" style={{ left: at(start), width: `calc(${at(end)} - ${at(start)})` }}>
                  <span className="timeline__bar-label">{role.title}</span>
                </span>
                {!role.end && <span className="timeline__now" style={{ left: at(nowPos) }} />}
              </div>
            );
          })}
          {education.map((item) => (
            <div key={item.id} className="timeline__track timeline__track--edu">
              <span
                className="timeline__span"
                style={{ left: at(item.graduationYear), width: `calc(${at(item.graduationYear + 1)} - ${at(item.graduationYear)})` }}
              >
                <span className="timeline__bar-label">{item.short}</span>
              </span>
            </div>
          ))}
          <span className="timeline__now-label" style={{ left: at(nowPos) }}>
            Now
          </span>
        </div>

        <div className="experience__grid">
          <ol className="experience__roles" role="list">
            {roles.map((role) => {
              const start = parseDate(role.start);
              const months = monthsBetween(start, role.end ? parseDate(role.end) : today);
              return (
                <li key={role.id} className="role" data-reveal>
                  <p className="role__dates">
                    <time dateTime={role.start}>{formatDayMonthYear(start)}</time>
                    <span className="role__dash" aria-hidden="true" />
                    {role.end ? <time dateTime={role.end}>{formatDayMonthYear(parseDate(role.end))}</time> : <span>Present</span>}
                  </p>
                  <h3 className="role__title display">{role.title}</h3>
                  <p className="role__org">{role.organisation}</p>
                  <p className="role__duration chip">
                    {formatDuration(months)}
                    {role.end ? '' : ' so far'}
                  </p>
                  {role.highlights.length > 0 && (
                    <ul className="role__highlights">
                      {role.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="experience__education" data-reveal>
            <h3 className="label experience__label">Education</h3>
            {education.map((item) => (
              <div key={item.id} className="degree surface">
                <p className="degree__year display">{item.graduationYear}</p>
                <p className="degree__name">
                  {item.credential} <span className="muted">({item.short})</span>
                </p>
                <p className="degree__school">
                  {item.institution}, {item.campus}
                </p>
                <p className="degree__university muted">{item.university}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
