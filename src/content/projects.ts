/**
 * Flagship case studies. Statements here are limited to what has been
 * verified about each project. Explanations of a technique (what a fountain
 * code or environment-driven configuration *is*) are phrased as general
 * engineering, never as measured results. Add links, dates or outcomes only
 * once they are confirmed.
 */
export type ProjectId = 'beamtransfer' | 'ambiora' | 'sggs-erp';

export interface CapabilityGroup {
  label: string;
  items: string[];
}

export interface Project {
  id: ProjectId;
  index: string;
  name: string;
  /** Short form for compact UI (index lists, matrix headers). */
  shortName: string;
  kind: string;
  /** One-line descriptor used in the hero index. */
  descriptor: string;
  headline: string;
  summary: string;
  /** Why the central technique matters, in general engineering terms. */
  insight: { title: string; body: string };
  capabilities: CapabilityGroup[];
  stack: string[];
  /** Documented engineering notes, quoted conservatively. */
  notes: string[];
  figure: { label: string; caption: string };
  disclosure?: string;
  /** Section surface: the chapters alternate pearl and white. */
  theme: 'light' | 'white';
}

export const projects: Project[] = [
  {
    id: 'beamtransfer',
    index: '01',
    name: 'BeamTransfer',
    shortName: 'BeamTransfer',
    kind: 'Native Android application',
    descriptor: 'Optical file transfer · Android',
    headline: 'Files, carried by light.',
    summary:
      'An Android app for optical file transfer. The sender streams fountain-coded QR frames; a receiving camera captures them and reconstructs the original file. Alongside transfer, it scans documents — with perspective correction, image filters, batch processing and a local history.',
    insight: {
      title: 'Enough frames, not every frame',
      body: 'A fountain code turns a file into an endless stream of interchangeable encoded frames. The receiver does not wait for any particular frame — once it has collected slightly more than the original amount of data, it can rebuild the file. A frame lost to blur or glare costs a moment, not a restart.',
    },
    capabilities: [
      {
        label: 'Transfer',
        items: ['Streaming fountain-coded QR frames', 'Camera-based reception', 'File reconstruction', 'Printable QR sheets'],
      },
      {
        label: 'Scanning',
        items: ['Document scanning', 'Perspective correction', 'Image filters', 'Batch processing'],
      },
      { label: 'On device', items: ['Local history'] },
    ],
    stack: ['Java', 'XML', 'Android', 'Fountain codes', 'QR', 'Imaging'],
    notes: [
      'The project documentation describes bit-level verification against an independently developed TypeScript reference implementation.',
    ],
    figure: {
      label: 'Frame stream',
      caption:
        'Live simulation in your browser: a fountain encoder streams frames across a lossy optical channel and a peeling decoder rebuilds the file. Frames are visualised, not scannable, and this is not BeamTransfer’s production codec.',
    },
    theme: 'white',
  },
  {
    id: 'ambiora',
    index: '02',
    name: 'Ambiora Hotel & Resorts',
    shortName: 'Ambiora',
    kind: 'Cinematic hospitality marketing website',
    descriptor: 'Cinematic hospitality web · PHP',
    headline: 'A place you can scroll into.',
    summary:
      'A cinematic hospitality marketing website built on Core PHP, with custom routing and views, data-driven content and responsive imagery. The homepage unfolds in cinematic chapters, with depth-based photography, a CSS 3D walk and interactive destination storytelling.',
    insight: {
      title: 'Depth from layers, not from tricks',
      body: 'A CSS 3D walk places each layer at its own distance inside one perspective space. Moving the camera through that space produces true parallax — near layers sweep past, far layers barely move — using nothing but the browser’s compositor.',
    },
    capabilities: [
      { label: 'Server', items: ['Core PHP', 'Custom routing and views', 'Data-driven content'] },
      {
        label: 'Experience',
        items: ['Cinematic chapters', 'Depth-based photography', 'CSS 3D walk', 'Interactive destination storytelling'],
      },
      { label: 'Front end', items: ['JavaScript modules', 'Motion', 'Lenis', 'Responsive imagery'] },
    ],
    stack: ['Core PHP', 'JavaScript', 'Motion', 'Lenis', 'CSS 3D'],
    notes: [],
    figure: {
      label: 'Depth walk',
      caption:
        'Interactive reconstruction of the depth technique, drawn with abstract shapes. The production site and its photography are not reproduced here.',
    },
    theme: 'light',
  },
  {
    id: 'sggs-erp',
    index: '03',
    name: 'SGGS ERP',
    shortName: 'SGGS ERP',
    kind: 'Institutional ERP & student-portal integration',
    descriptor: 'Institutional ERP · Django',
    headline: 'Institutions run on connected systems.',
    summary:
      'Django-based institutional ERP work and student-portal integration — including API integration, environment-driven configuration and deployment workflows.',
    insight: {
      title: 'Configuration belongs to the environment',
      body: 'With environment-driven configuration, the same code runs on a laptop and on a server; what changes is what the environment provides. Secrets and per-environment values stay out of the repository, and a deployment is a repeatable workflow rather than a set of manual edits.',
    },
    capabilities: [
      { label: 'Application', items: ['Django-based institutional ERP', 'Student-portal integration'] },
      { label: 'Integration', items: ['API integration'] },
      { label: 'Operations', items: ['Environment-driven configuration', 'Deployment workflows'] },
    ],
    stack: ['Python', 'Django', 'API integration', 'Environment config', 'Deployment'],
    notes: [],
    figure: {
      label: 'System diagram',
      caption: 'Architecture at the level of its public description. Select a component to read its role.',
    },
    disclosure:
      'Simplified public view. No credentials, tokens, hostnames, internal configuration or student data are shown.',
    theme: 'white',
  },
];

export function getProject(id: ProjectId): Project {
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}
