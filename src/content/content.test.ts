import { describe, expect, it } from 'vitest';
import { education, roles } from './experience';
import { profile } from './profile';
import { projects } from './projects';
import { sections } from './sections';
import { domains } from './systems';

/**
 * Content integrity. These guard the "no invented claims" rule mechanically:
 * every skill must point at real project evidence, and links must be real.
 */
describe('content integrity', () => {
  const projectIds = new Set(projects.map((p) => p.id));

  it('every skill cites at least one existing project as evidence', () => {
    const skills = domains.flatMap((d) => d.skills);
    expect(skills.filter((s) => s.evidence.length === 0).map((s) => s.name)).toEqual([]);
    const unknown = skills.flatMap((s) => s.evidence.filter((id) => !projectIds.has(id)).map((id) => `${s.name} → ${id}`));
    expect(unknown).toEqual([]);
  });

  it('every project is evidenced by at least one skill', () => {
    const cited = new Set(domains.flatMap((d) => d.skills.flatMap((s) => s.evidence)));
    expect(projects.filter((p) => !cited.has(p.id)).map((p) => p.id)).toEqual([]);
  });

  it('project ids, indexes and section ids are unique', () => {
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(projects.map((p) => p.index)).size).toBe(projects.length);
    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
  });

  it('contact links are absolute https URLs and the email is well formed', () => {
    for (const link of Object.values(profile.links)) expect(link.href).toMatch(/^https:\/\//);
    expect(profile.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it('roles and education use valid dates', () => {
    for (const role of roles) expect(role.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const endsBeforeStart = roles.filter((r) => r.end !== null && r.end < r.start).map((r) => r.id);
    expect(endsBeforeStart).toEqual([]);
    for (const item of education) expect(item.graduationYear).toBeGreaterThan(2000);
  });
});
