/**
 * Professional history and education. `highlights` stays empty until the
 * responsibilities are confirmed — the UI renders nothing for an empty list
 * rather than a placeholder.
 */
export interface Role {
  id: string;
  title: string;
  organisation: string;
  /** ISO date (YYYY-MM-DD). */
  start: string;
  /** ISO date, or null while the role is current. */
  end: string | null;
  highlights: string[];
}

export interface Education {
  id: string;
  credential: string;
  short: string;
  institution: string;
  campus: string;
  university: string;
  graduationYear: number;
}

export const roles: Role[] = [
  {
    id: 'rankfirst',
    title: 'Software Engineer',
    organisation: 'Rankfirst Technology Pvt. Ltd.',
    start: '2024-04-22',
    end: null,
    highlights: [],
  },
];

export const education: Education[] = [
  {
    id: 'bca',
    credential: 'Bachelor of Computer Applications',
    short: 'BCA',
    institution: 'Sri Guru Gobind Singh College',
    campus: 'Sector 26, Chandigarh',
    university: 'Panjab University',
    graduationYear: 2025,
  },
];
