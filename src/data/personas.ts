import type { OrgKind, PersonaId } from './types';

/**
 * Personas: what someone is here to do. Grants (users.ts) decide which
 * workflows a person may touch; the persona decides which parts of LiveView
 * exist for them and what the home screen is.
 */
export type Capability =
  | 'view-canvas'
  | 'edit-workflows'
  | 'manage-credentials'
  | 'see-business-value'
  | 'see-tokens'
  | 'respond-incidents'
  | 'signal-partner'
  | 'accept-fixes'
  | 'apply-updates'
  | 'fork-products'
  | 'publish-products'
  | 'manage-access'
  | 'see-leaderboards'
  | 'ai-scan'
  | 'plan';

export const CAPABILITY_LABEL: Record<Capability, string> = {
  'view-canvas': 'Open canvas and graph',
  'edit-workflows': 'Edit workflows',
  'manage-credentials': 'Credentials',
  'see-business-value': 'Time, money and ROI',
  'see-tokens': 'Token usage',
  'respond-incidents': 'Respond to errors',
  'signal-partner': 'Signal the partner',
  'accept-fixes': 'Accept smart fixes',
  'apply-updates': 'Apply n8n updates',
  'fork-products': 'Fork products',
  'publish-products': 'Publish to catalog',
  'manage-access': 'Manage access',
  'see-leaderboards': 'Leaderboards',
  'ai-scan': 'AI opportunity scan',
  plan: 'Planner',
};

/** What the home screen ("Overview") shows for a persona. */
export type HomeKind = 'partner' | 'vendor' | 'executive' | 'vertical' | 'worker';

/** Which top-level navigation items exist for a persona. */
export type NavId = 'overview' | 'planner' | 'incidents' | 'instances' | 'roadmap' | 'teams' | 'workflows' | 'improvements' | 'products' | 'changelog' | 'users' | 'credentials';

/** What the sidebar's project section lists. */
export type SideListKind = 'projects' | 'instances' | 'teams' | 'assigned';

export interface Persona {
  id: PersonaId;
  org: OrgKind;
  label: string;
  short: string;
  description: string;
  /** where the person's reach ends */
  reach: string;
  home: HomeKind;
  nav: NavId[];
  sideList: SideListKind;
  capabilities: Capability[];
}

export const PERSONAS: Persona[] = [
  {
    id: 'n8n-success',
    org: 'vendor',
    label: 'n8n Partner Success',
    short: 'n8n',
    description: 'Watches every instance n8n is involved in, responds to errors and faults before the client notices, and signals the allocated partner.',
    reach: 'Every involved instance. No business numbers.',
    home: 'vendor',
    nav: ['overview', 'incidents', 'instances', 'changelog', 'products', 'users'],
    sideList: 'instances',
    capabilities: ['respond-incidents', 'signal-partner', 'see-tokens', 'view-canvas'],
  },
  {
    id: 'n8n-dev',
    org: 'vendor',
    label: 'n8n Developer',
    short: 'n8n dev',
    description: 'Internal developer at n8n. Sees the technical side of every involved instance, ships platform updates and fixes in staging.',
    reach: 'Workflows and versions. No credentials.',
    home: 'vendor',
    nav: ['overview', 'instances', 'incidents', 'workflows', 'changelog', 'products', 'users'],
    sideList: 'instances',
    capabilities: ['view-canvas', 'respond-incidents', 'signal-partner', 'apply-updates', 'fork-products', 'publish-products', 'see-tokens'],
  },
  {
    id: 'partner-owner',
    org: 'partner',
    label: 'Partner · Owner',
    short: 'Owner',
    description: 'Runs the partner. Oversees every project, every person and every number.',
    reach: 'Everything.',
    home: 'partner',
    nav: ['overview', 'planner', 'workflows', 'improvements', 'products', 'changelog', 'users', 'credentials'],
    sideList: 'projects',
    capabilities: ['view-canvas', 'edit-workflows', 'manage-credentials', 'see-business-value', 'see-tokens', 'respond-incidents', 'accept-fixes', 'apply-updates', 'fork-products', 'publish-products', 'manage-access', 'see-leaderboards', 'ai-scan', 'plan'],
  },
  {
    id: 'partner-dev',
    org: 'partner',
    label: 'Partner · Developer',
    short: 'Developer',
    description: 'Internal developer at the partner. Builds, fixes and updates the automations of the projects they are on.',
    reach: 'All projects, technical side.',
    home: 'partner',
    nav: ['overview', 'planner', 'workflows', 'improvements', 'products', 'changelog', 'users', 'credentials'],
    sideList: 'projects',
    capabilities: ['view-canvas', 'edit-workflows', 'manage-credentials', 'see-tokens', 'respond-incidents', 'accept-fixes', 'apply-updates', 'fork-products', 'publish-products', 'plan'],
  },
  {
    id: 'partner-account',
    org: 'partner',
    label: 'Partner · Account',
    short: 'Account',
    description: 'Account and finance side of the partner. Follows value, planning and the client relationship, never the credentials.',
    reach: 'Own projects. No editing.',
    home: 'partner',
    nav: ['overview', 'planner', 'workflows', 'improvements', 'products', 'users'],
    sideList: 'projects',
    capabilities: ['view-canvas', 'see-business-value', 'see-tokens', 'see-leaderboards', 'plan'],
  },
  {
    id: 'client-head-ai',
    org: 'client',
    label: 'Head of AI Ecosystem',
    short: 'Head of AI',
    description: 'The client’s executive owner of automation. One view of time saved, money saved, ROI, tokens, the roadmap, the agreed scope and every vertical.',
    reach: 'Own company, every number. No editing.',
    home: 'executive',
    nav: ['overview', 'roadmap', 'teams', 'workflows', 'improvements', 'users'],
    sideList: 'teams',
    capabilities: ['view-canvas', 'see-business-value', 'see-tokens', 'see-leaderboards', 'ai-scan', 'signal-partner', 'manage-access'],
  },
  {
    id: 'client-ai-manager',
    org: 'client',
    label: 'Head of AI · vertical',
    short: 'Head of AI',
    description: 'Leads automation for one vertical (Finance, New business, HRM). Runs the team, its KPIs and its leaderboard.',
    reach: 'Own vertical in full.',
    home: 'vertical',
    nav: ['overview', 'teams', 'workflows', 'improvements'],
    sideList: 'teams',
    capabilities: ['view-canvas', 'see-business-value', 'see-tokens', 'see-leaderboards', 'ai-scan'],
  },
  {
    id: 'client-worker',
    org: 'client',
    label: 'Team member',
    short: 'Member',
    description: 'Works with the automations every day. Sees their own impact, the team leaderboard and the rewards.',
    reach: 'Own vertical, read only.',
    home: 'worker',
    nav: ['overview', 'teams', 'workflows'],
    sideList: 'teams',
    capabilities: ['see-leaderboards', 'view-canvas'],
  },
  {
    id: 'client-dev',
    org: 'client',
    label: 'Internal developer',
    short: 'Developer',
    description: 'Developer employed by the client. Edits their own company’s workflows, forks products and keeps their instance up to date.',
    reach: 'Own company, technical side.',
    home: 'partner',
    nav: ['overview', 'workflows', 'improvements', 'products', 'changelog', 'credentials', 'users'],
    sideList: 'projects',
    capabilities: ['view-canvas', 'edit-workflows', 'manage-credentials', 'respond-incidents', 'accept-fixes', 'apply-updates', 'fork-products', 'see-tokens'],
  },
  {
    id: 'external-dev',
    org: 'partner',
    label: 'External developer',
    short: 'External',
    description: 'Remote freelancer. Works only on the workflows assigned to them, never sees credentials or business numbers.',
    reach: 'Assigned workflows only.',
    home: 'partner',
    nav: ['overview', 'workflows', 'products'],
    sideList: 'assigned',
    capabilities: ['view-canvas', 'edit-workflows', 'fork-products'],
  },
];

export const personaById = (id: PersonaId): Persona => PERSONAS.find((p) => p.id === id)!;
export const CAPABILITIES: Capability[] = Object.keys(CAPABILITY_LABEL) as Capability[];
