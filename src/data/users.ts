import type { Grant, User } from './types';
import { hoursAgo, minutesAgo, daysAgo } from '../lib/format';

/**
 * Fake people. Every cursor is a different pink, on purpose:
 * hot pink, rose, magenta, raspberry, salmon, bubblegum, orchid, cerise.
 */
export const USERS: User[] = [
  {
    id: 'u-noor',
    name: 'Noor Bakker',
    email: 'noor@viralistic.nl',
    title: 'Founder & Automation Lead',
    companyId: 'viralistic',
    color: '#ff2d75',
    avatarColors: ['#ff2d75', '#0a0a0a', '#ffd6e4', '#ff8fb3', '#ffffff'],
    online: true,
    lastActiveAt: minutesAgo(0),
    isYou: true,
    presence: { viewing: 'volkswagen', device: 'mac' },
  },
  {
    id: 'u-daan',
    name: 'Daan Visser',
    email: 'daan@viralistic.nl',
    title: 'Automation Engineer',
    companyId: 'viralistic',
    color: '#f472b6',
    avatarColors: ['#f472b6', '#1f1f1f', '#fbcfe8', '#ffffff', '#be185d'],
    online: true,
    lastActiveAt: minutesAgo(1),
    presence: { viewing: 'vir-lead-enrich', device: 'mac' },
  },
  {
    id: 'u-lotte',
    name: 'Lotte Jansen',
    email: 'lotte.jansen@volkswagen.nl',
    title: 'Digital Marketing Manager',
    companyId: 'volkswagen',
    color: '#e11d74',
    avatarColors: ['#e11d74', '#ffe4ef', '#0a0a0a', '#ff9ccd', '#ffffff'],
    online: true,
    lastActiveAt: minutesAgo(3),
    presence: { viewing: 'vw-dealer-lead-routing', device: 'windows' },
  },
  {
    id: 'u-milan',
    name: 'Milan de Groot',
    email: 'milan@transmissies.nl',
    title: 'E-commerce Developer',
    companyId: 'transmissies',
    color: '#db2777',
    avatarColors: ['#db2777', '#111111', '#fce7f3', '#ffffff', '#f9a8d4'],
    online: true,
    lastActiveAt: minutesAgo(0),
    presence: { viewing: 'tr-stock-sync', device: 'mac' },
  },
  {
    id: 'u-sara',
    name: 'Sara Ahmed',
    email: 'sara@viralistic.nl',
    title: 'Account Director',
    companyId: 'viralistic',
    color: '#fb7185',
    avatarColors: ['#fb7185', '#0a0a0a', '#ffe4e6', '#ffffff', '#e11d48'],
    online: false,
    lastActiveAt: hoursAgo(2),
  },
  {
    id: 'u-finn',
    name: 'Finn Mulder',
    email: 'finn@mulder.dev',
    title: 'Freelance n8n developer',
    companyId: 'viralistic',
    color: '#f9a8d4',
    avatarColors: ['#f9a8d4', '#1a1a1a', '#ffffff', '#ec4899', '#fdf2f8'],
    online: false,
    lastActiveAt: daysAgo(1),
  },
  {
    id: 'u-eva',
    name: 'Eva Smit',
    email: 'eva@viralistic.nl',
    title: 'Finance & Operations',
    companyId: 'viralistic',
    color: '#e879f9',
    avatarColors: ['#e879f9', '#0a0a0a', '#fae8ff', '#ffffff', '#a21caf'],
    online: false,
    lastActiveAt: hoursAgo(26),
  },
  {
    id: 'u-tom',
    name: 'Tom Peeters',
    email: 'tom@hoasted.com',
    title: 'CTO',
    companyId: 'hoasted',
    color: '#be185d',
    avatarColors: ['#be185d', '#fdf2f8', '#0a0a0a', '#ffffff', '#f472b6'],
    online: false,
    lastActiveAt: hoursAgo(5),
  },
];

const g = (id: string, userId: string, scope: Grant['scope'], role: Grant['role'], grantedAt: string, grantedById = 'u-noor'): Grant => ({
  id,
  userId,
  scope,
  role,
  grantedAt,
  grantedById,
});

/** Access is hierarchical: org → company → workflow. The highest matching grant wins. */
export const INITIAL_GRANTS: Grant[] = [
  g('g1', 'u-noor', { kind: 'org' }, 'admin', daysAgo(600), 'u-noor'),
  g('g2', 'u-daan', { kind: 'org' }, 'editor', daysAgo(400)),
  g('g3', 'u-daan', { kind: 'company', companyId: 'hoasted' }, 'admin', daysAgo(60)),
  g('g4', 'u-lotte', { kind: 'company', companyId: 'volkswagen' }, 'commenter', daysAgo(190)),
  g('g5', 'u-milan', { kind: 'company', companyId: 'transmissies' }, 'editor', daysAgo(110)),
  g('g6', 'u-sara', { kind: 'company', companyId: 'volkswagen' }, 'admin', daysAgo(220)),
  g('g7', 'u-sara', { kind: 'company', companyId: 'transmissies' }, 'admin', daysAgo(115)),
  g('g8', 'u-sara', { kind: 'company', companyId: 'viralistic' }, 'viewer', daysAgo(400)),
  g('g9', 'u-finn', { kind: 'workflow', workflowId: 'vw-crm-sync' }, 'editor', daysAgo(30), 'u-sara'),
  g('g10', 'u-finn', { kind: 'workflow', workflowId: 'tr-stock-sync' }, 'editor', daysAgo(14), 'u-sara'),
  g('g11', 'u-eva', { kind: 'company', companyId: 'viralistic' }, 'viewer', daysAgo(300)),
  g('g12', 'u-eva', { kind: 'workflow', workflowId: 'ho-invoice-dunning' }, 'commenter', daysAgo(20), 'u-daan'),
  g('g13', 'u-tom', { kind: 'company', companyId: 'hoasted' }, 'editor', daysAgo(58), 'u-daan'),
];

export const userById = (id: string): User => USERS.find((u) => u.id === id)!;
