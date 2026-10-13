/** Page sections in reading order, with the eyebrow shown above each title. */
export const sections = [
  { id: 'top', title: 'The Signal', kicker: 'Introduction', nav: null },
  { id: 'work', title: 'Selected work', kicker: 'Projects', nav: 'Work' },
  { id: 'systems', title: 'Systems map', kicker: 'Capabilities', nav: 'Systems' },
  { id: 'experience', title: 'Experience', kicker: 'Career', nav: 'Experience' },
  { id: 'lab', title: 'The Lab', kicker: 'Experiments', nav: 'Lab' },
  { id: 'about', title: 'About', kicker: 'Profile', nav: 'About' },
  { id: 'contact', title: 'Contact', kicker: 'Get in touch', nav: 'Contact' },
] as const;

export type SectionId = (typeof sections)[number]['id'];

export const SHEET_COUNT = sections.length;

export function sheetNumber(id: SectionId): string {
  return String(sections.findIndex((s) => s.id === id) + 1).padStart(2, '0');
}

export function sectionMeta(id: SectionId) {
  const section = sections.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown section: ${id}`);
  return section;
}

/** Primary navigation — Contact is rendered separately as the persistent call to action. */
export const primaryNav = sections.filter(
  (s): s is Extract<(typeof sections)[number], { nav: string }> => s.nav !== null && s.id !== 'contact',
);
