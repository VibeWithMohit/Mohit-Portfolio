import type { ProjectId } from './projects';

/**
 * Skills grouped by engineering domain. Every skill must cite at least one
 * flagship project as evidence (enforced by content.test.ts) — nothing here
 * is listed on reputation alone.
 */
export interface Skill {
  name: string;
  evidence: ProjectId[];
}

export interface Domain {
  id: string;
  title: string;
  summary: string;
  skills: Skill[];
}

export const domains: Domain[] = [
  {
    id: 'android',
    title: 'Native Android',
    summary: 'Software that runs on the device in your hand.',
    skills: [
      { name: 'Java', evidence: ['beamtransfer'] },
      { name: 'XML layouts', evidence: ['beamtransfer'] },
      { name: 'Camera-based capture', evidence: ['beamtransfer'] },
      { name: 'Local history', evidence: ['beamtransfer'] },
    ],
  },
  {
    id: 'encoding',
    title: 'Encoding & integrity',
    summary: 'Getting the same bits out that went in.',
    skills: [
      { name: 'Fountain coding', evidence: ['beamtransfer'] },
      { name: 'QR frame streaming', evidence: ['beamtransfer'] },
      { name: 'File reconstruction', evidence: ['beamtransfer'] },
      { name: 'Verification against a reference', evidence: ['beamtransfer'] },
    ],
  },
  {
    id: 'imaging',
    title: 'Imaging',
    summary: 'Turning camera frames into clean documents.',
    skills: [
      { name: 'Document scanning', evidence: ['beamtransfer'] },
      { name: 'Perspective correction', evidence: ['beamtransfer'] },
      { name: 'Image filters', evidence: ['beamtransfer'] },
      { name: 'Batch processing', evidence: ['beamtransfer'] },
    ],
  },
  {
    id: 'web',
    title: 'Web experience',
    summary: 'Interfaces with pace, depth and narrative.',
    skills: [
      { name: 'Cinematic storytelling', evidence: ['ambiora'] },
      { name: 'CSS 3D', evidence: ['ambiora'] },
      { name: 'Motion & Lenis', evidence: ['ambiora'] },
      { name: 'JavaScript modules', evidence: ['ambiora'] },
      { name: 'Responsive imagery', evidence: ['ambiora'] },
    ],
  },
  {
    id: 'server',
    title: 'Server-side',
    summary: 'Routing, views, data and the APIs between them.',
    skills: [
      { name: 'Server-rendered web applications', evidence: ['ambiora', 'sggs-erp'] },
      { name: 'PHP — custom routing & views', evidence: ['ambiora'] },
      { name: 'Data-driven content', evidence: ['ambiora'] },
      { name: 'Python & Django', evidence: ['sggs-erp'] },
      { name: 'API integration', evidence: ['sggs-erp'] },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    summary: 'From a repository to a running service.',
    skills: [
      { name: 'Student-portal integration', evidence: ['sggs-erp'] },
      { name: 'Environment-driven configuration', evidence: ['sggs-erp'] },
      { name: 'Deployment workflows', evidence: ['sggs-erp'] },
    ],
  },
];

export const skillCount = domains.reduce((n, d) => n + d.skills.length, 0);
