import { SectionHead } from '../../components/SectionHead';
import { education, roles } from '../../content/experience';
import { profile } from '../../content/profile';
import './about.css';

/**
 * 06 — About. Biography from verified facts; the principles are framed as
 * working beliefs, each tied to project evidence rather than to claims of
 * achievement. (Copy for Mohit to review — see README.)
 */
const PRINCIPLES = [
  {
    title: 'Verify against something independent.',
    body: 'BeamTransfer’s documentation describes bit-level checks against a separately written TypeScript reference implementation.',
  },
  {
    title: 'Design for the dropped frame.',
    body: 'Real channels lose data. A fountain code treats loss as the normal case instead of an error to recover from.',
  },
  {
    title: 'Keep configuration in the environment.',
    body: 'SGGS ERP takes its settings from where it runs, not from its code — so the code can move without edits.',
  },
  {
    title: 'Use motion to explain.',
    body: 'In Ambiora’s cinematic chapters, and on this page, depth and movement are there to carry the story.',
  },
];

export function About() {
  const role = roles[0];
  const degree = education[0];

  return (
    <section id="about" className="sheet theme-white about" aria-labelledby="about-title">
      <div className="container">
        <SectionHead id="about" />

        <div className="about__grid">
          <p className="about__statement" data-reveal>
            I care about the moment software meets the real world — a camera, a place, an institution.
          </p>

          <div className="about__body">
            <div className="prose" data-reveal>
              <p>
                I’m {profile.name}, a software engineer based in {profile.location}. Since April 2024 I’ve been a{' '}
                {role?.title} at {role?.organisation}, and in {degree?.graduationYear} I completed a {degree?.credential}{' '}
                at {degree?.institution}, {degree?.campus}, under {degree?.university}.
              </p>
              <p>
                The projects on this page come from very different places: a native Android app that moves files
                through light, a cinematic website for a hotel and resorts brand, and institutional software built on
                Django. What connects them is the part I enjoy most — making an idea hold up once it leaves the editor.
              </p>
            </div>

            <dl className="about__facts surface" data-reveal="scale">
              <div>
                <dt className="label">Based in</dt>
                <dd>{profile.location}</dd>
              </div>
              <div>
                <dt className="label">Currently</dt>
                <dd>
                  {role?.title}, {role?.organisation}
                </dd>
              </div>
              <div>
                <dt className="label">Education</dt>
                <dd>
                  {degree?.short}, {degree?.university} ({degree?.graduationYear})
                </dd>
              </div>
            </dl>
          </div>

          <div className="principles" data-reveal>
            <h3 className="principles__title label">Working principles</h3>
            <ol className="principles__list" role="list">
              {PRINCIPLES.map((principle, i) => (
                <li key={principle.title} className="principle">
                  <span className="principle__n tabular" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p>
                    <strong className="principle__title">{principle.title}</strong> {principle.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
