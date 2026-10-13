/**
 * Identity and contact details. Everything on the site that names a person,
 * a place or a link reads from here — update it in one place.
 */
export const profile = {
  name: 'Mohit Kumar',
  displayName: 'Mohit',
  role: 'Software Engineer',
  location: 'Chandigarh, India',
  /** Chandigarh city centre, shown as a drafting-style coordinate. */
  coordinates: '30.7333° N, 76.7794° E',
  timeZone: 'Asia/Kolkata',
  timeZoneLabel: 'IST · UTC+05:30',
  email: '100mohit@gmail.com',
  links: {
    github: { label: 'GitHub', handle: 'VibeWithMohit', href: 'https://github.com/VibeWithMohit' },
    linkedin: { label: 'LinkedIn', handle: 'mohitkumar2822', href: 'https://www.linkedin.com/in/mohitkumar2822/' },
  },
  /**
   * Set to a URL (for example '/mohit-kumar-resume.pdf' placed in /public)
   * once a résumé is available. While null, no résumé link is rendered.
   */
  resumeUrl: null as string | null,
} as const;

export const headline = {
  statement: 'I build software that connects ideas to reality.',
  support: 'Real software. Thoughtful systems. Unexpected experiences.',
} as const;
