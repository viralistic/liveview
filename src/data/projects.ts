import type { NextStep, ScopeItem } from './types';
import { daysAgo, hoursAgo } from '../lib/format';

/**
 * The engagement around the automations: where the project is in the
 * Viralistic trajectory, who owns what, what the client wants, and the
 * communication so far. Phases follow the way Viralistic works with clients.
 */
export type PhaseId = 'introduction' | 'visit' | 'workshop' | 'business-case' | 'poc' | 'build' | 'test' | 'live';

export const PHASES: { id: PhaseId; label: string; description: string }[] = [
  { id: 'introduction', label: 'Introduction', description: 'First conversation. What runs by hand today, what keeps people up at night.' },
  { id: 'visit', label: 'Visit', description: 'A physical visit to see the work as it happens.' },
  { id: 'workshop', label: 'Inspiration workshop', description: 'Discover the possibilities together with the team.' },
  { id: 'business-case', label: 'Business case', description: 'Decide what pays off first, with numbers.' },
  { id: 'poc', label: 'Proof of concept', description: 'The first automation running on real data.' },
  { id: 'build', label: 'Build', description: 'Implement the agreed automations in n8n.' },
  { id: 'test', label: 'Test', description: 'The client tests, we fix, nothing is live yet by default.' },
  { id: 'live', label: 'Live', description: 'Running in production. Monitor, improve, extend.' },
];

export type CommType = 'email' | 'call' | 'meeting' | 'visit' | 'workshop' | 'note';
export interface Communication {
  id: string;
  companyId: string;
  type: CommType;
  title: string;
  summary: string;
  at: string;
  participantIds: string[];
  phase?: PhaseId;
}

export interface ProjectInfo {
  companyId: string;
  phase: PhaseId;
  phaseSince: string;
  phaseNote: string;
  processOwnerId: string;
  technicalOwnerId: string;
  clientContactIds: string[];
  wants: string[];
  needs: string[];
  nextStep: { title: string; at: string; ownerId: string };
  /** the next steps both sides agreed on, in order */
  nextSteps: NextStep[];
  /** scope agreed between partner and client; progress = delivered / all */
  scope: ScopeItem[];
  communications: Communication[];
}

export const PROJECTS: ProjectInfo[] = [
  {
    companyId: 'viralistic',
    phase: 'live',
    phaseSince: daysAgo(400),
    phaseNote: 'Our own automations. Live and continuously extended.',
    processOwnerId: 'u-marrallisa',
    technicalOwnerId: 'u-daan',
    clientContactIds: [],
    wants: ['Zero manual invoicing', 'Every lead answered within a minute'],
    needs: ['Keep the shared services (enrichment, reporting) stable for clients'],
    nextStep: { title: 'Cache enrichment lookups', at: daysAgo(-2), ownerId: 'u-daan' },
    nextSteps: [
      { title: 'Cache enrichment lookups', at: daysAgo(-2), ownerId: 'u-daan' },
      { title: 'Move client reporting to the report product', at: daysAgo(-14), ownerId: 'u-mirza' },
    ],
    scope: [
      { id: 's-vi-1', title: 'Lead intake and enrichment', status: 'delivered', verticalId: 'vi-agency', workflowIds: ['vir-lead-intake', 'vir-lead-enrich'], agreedAt: daysAgo(400), deliveredAt: daysAgo(380) },
      { id: 's-vi-2', title: 'Monthly invoicing', status: 'delivered', verticalId: 'vi-agency', workflowIds: ['vir-invoicing'], agreedAt: daysAgo(400), deliveredAt: daysAgo(350) },
      { id: 's-vi-3', title: 'Client reporting', status: 'delivered', verticalId: 'vi-agency', workflowIds: ['vir-client-reporting', 'vir-report-render'], agreedAt: daysAgo(300), deliveredAt: daysAgo(240) },
      { id: 's-vi-4', title: 'Content pipeline and social', status: 'in-progress', verticalId: 'vi-agency', workflowIds: ['vir-content-pipeline', 'vir-social-scheduler'], agreedAt: daysAgo(120) },
    ],
    communications: [
      { id: 'c-vi-1', companyId: 'viralistic', type: 'note', title: 'Shared services agreed', summary: 'Lead enrichment and PDF rendering are offered to clients as shared services.', at: daysAgo(120), participantIds: ['u-marrallisa', 'u-daan'] },
    ],
  },
  {
    companyId: 'volkswagen',
    phase: 'live',
    phaseSince: daysAgo(95),
    phaseNote: 'Dealer lead routing and bookings are live. Service reminders in test with two dealers.',
    processOwnerId: 'u-marrallisa',
    technicalOwnerId: 'u-mirza',
    clientContactIds: ['u-lotte', 'u-jan'],
    wants: ['Every dealer lead answered within 5 minutes', 'Test-drive bookings without phone calls', 'One view of marketing and after-sales automations'],
    needs: ['HubSpot as the single CRM across dealers', 'Dutch-language customer communication', 'Audit trail per lead for the dealer network'],
    nextStep: { title: 'Quarterly review with Lotte and Jan', at: daysAgo(-2), ownerId: 'u-marrallisa' },
    nextSteps: [
      { title: 'Reconnect HubSpot and replay the failed leads', at: daysAgo(0), ownerId: 'u-mirza' },
      { title: 'Quarterly review with Lotte and Jan', at: daysAgo(-2), ownerId: 'u-marrallisa' },
      { title: 'Go-live service reminders for all dealers', at: daysAgo(-9), ownerId: 'u-mirza' },
      { title: 'Finance: invoice checker on real supplier invoices', at: daysAgo(-16), ownerId: 'u-pieter' },
      { title: 'HRM kick-off workshop', at: daysAgo(-35), ownerId: 'u-marrallisa' },
    ],
    scope: [
      { id: 's-vw-1', title: 'Dealer lead routing', status: 'delivered', verticalId: 'vw-new-business', workflowIds: ['vw-dealer-lead-routing'], agreedAt: daysAgo(170), deliveredAt: daysAgo(95) },
      { id: 's-vw-2', title: 'Lead scoring with AI', status: 'delivered', verticalId: 'vw-new-business', workflowIds: ['vw-lead-scoring'], agreedAt: daysAgo(170), deliveredAt: daysAgo(95) },
      { id: 's-vw-3', title: 'Online test-drive bookings', status: 'delivered', verticalId: 'vw-new-business', workflowIds: ['vw-test-drive-booking'], agreedAt: daysAgo(170), deliveredAt: daysAgo(95) },
      { id: 's-vw-4', title: 'CRM to dealer DMS sync', status: 'delivered', verticalId: 'vw-new-business', workflowIds: ['vw-crm-sync'], agreedAt: daysAgo(170), deliveredAt: daysAgo(80) },
      { id: 's-vw-5', title: 'Service reminders', status: 'in-progress', verticalId: 'vw-after-sales', workflowIds: ['vw-service-reminders'], agreedAt: daysAgo(70) },
      { id: 's-vw-6', title: 'Post-visit NPS survey', status: 'delivered', verticalId: 'vw-after-sales', workflowIds: ['vw-nps-survey'], agreedAt: daysAgo(70), deliveredAt: daysAgo(40) },
      { id: 's-vw-7', title: 'Parts inventory alerts', status: 'delivered', verticalId: 'vw-parts', workflowIds: ['vw-parts-inventory-alerts'], agreedAt: daysAgo(50), deliveredAt: daysAgo(30) },
      { id: 's-vw-8', title: 'Supplier invoice checker', status: 'in-progress', verticalId: 'vw-finance', workflowIds: [], agreedAt: daysAgo(12) },
      { id: 's-vw-9', title: 'Invoice dunning', status: 'planned', verticalId: 'vw-finance', workflowIds: [], agreedAt: daysAgo(12) },
      { id: 's-vw-10', title: 'Employee onboarding', status: 'planned', verticalId: 'vw-hrm', workflowIds: [], agreedAt: daysAgo(12) },
      { id: 's-vw-11', title: 'Leave requests', status: 'planned', verticalId: 'vw-hrm', workflowIds: [], agreedAt: daysAgo(12) },
    ],
    communications: [
      { id: 'c-vw-1', companyId: 'volkswagen', type: 'email', title: 'Introduction via Pon', summary: 'Lotte asked whether dealer leads could be routed automatically.', at: daysAgo(224), participantIds: ['u-lotte', 'u-marrallisa'], phase: 'introduction' },
      { id: 'c-vw-2', companyId: 'volkswagen', type: 'visit', title: 'Visit Amersfoort', summary: 'Watched the dealer desk handle leads by hand. Average answer time: 4 hours.', at: daysAgo(210), participantIds: ['u-lotte', 'u-marrallisa', 'u-mirza'], phase: 'visit' },
      { id: 'c-vw-3', companyId: 'volkswagen', type: 'workshop', title: 'Inspiration workshop', summary: '14 ideas, 5 selected: routing, scoring, bookings, DMS sync, reminders.', at: daysAgo(196), participantIds: ['u-lotte', 'u-jan', 'u-marrallisa', 'u-mirza'], phase: 'workshop' },
      { id: 'c-vw-4', companyId: 'volkswagen', type: 'meeting', title: 'Business case approved', summary: 'Routing and bookings first. Budget approved by Jan.', at: daysAgo(170), participantIds: ['u-jan', 'u-marrallisa'], phase: 'business-case' },
      { id: 'c-vw-5', companyId: 'volkswagen', type: 'call', title: 'PoC review', summary: 'First 200 routed leads. Dealers happy, SMS wording changed.', at: daysAgo(140), participantIds: ['u-lotte', 'u-mirza'], phase: 'poc' },
      { id: 'c-vw-6', companyId: 'volkswagen', type: 'email', title: 'Go-live confirmation', summary: 'Routing, scoring and bookings live for all dealers.', at: daysAgo(95), participantIds: ['u-lotte', 'u-marrallisa'], phase: 'live' },
      { id: 'c-vw-7', companyId: 'volkswagen', type: 'email', title: 'Leads not arriving', summary: 'Lotte reports dealers receive no leads since this morning. Cause: expired HubSpot token.', at: hoursAgo(1), participantIds: ['u-lotte', 'u-marrallisa'] },
      { id: 'c-vw-8', companyId: 'volkswagen', type: 'call', title: 'Quarterly review', summary: 'Review of Q4 results and the after-sales roadmap.', at: daysAgo(-2), participantIds: ['u-lotte', 'u-jan', 'u-marrallisa', 'u-mirza'] },
    ],
  },
  {
    companyId: 'transmissies',
    phase: 'test',
    phaseSince: daysAgo(18),
    phaseNote: 'Order flow and stock sync are live. The gearbox finder is in test with the sales team.',
    processOwnerId: 'u-marrallisa',
    technicalOwnerId: 'u-mirza',
    clientContactIds: ['u-milan'],
    wants: ['Quotes within an hour instead of a day', 'Stock in the shop always matching Exact', 'Fewer phone calls about shipping'],
    needs: ['Exact Online stays the source of truth', 'Dutch and German customers', 'Sales must be able to override a quote'],
    nextStep: { title: 'Decide go-live of the gearbox finder', at: daysAgo(-3), ownerId: 'u-marrallisa' },
    nextSteps: [
      { title: 'Fix the quote webhook timeout', at: daysAgo(-1), ownerId: 'u-mirza' },
      { title: 'Decide go-live of the gearbox finder', at: daysAgo(-3), ownerId: 'u-marrallisa' },
      { title: 'Batch the stock updates', at: daysAgo(-6), ownerId: 'u-finn' },
    ],
    scope: [
      { id: 's-tr-1', title: 'Order processing', status: 'delivered', verticalId: 'tr-operations', workflowIds: ['tr-order-processing'], agreedAt: daysAgo(90), deliveredAt: daysAgo(75) },
      { id: 's-tr-2', title: 'Stock sync with Exact', status: 'delivered', verticalId: 'tr-operations', workflowIds: ['tr-stock-sync'], agreedAt: daysAgo(90), deliveredAt: daysAgo(70) },
      { id: 's-tr-3', title: 'Shipping notifications', status: 'delivered', verticalId: 'tr-operations', workflowIds: ['tr-shipping-notifications'], agreedAt: daysAgo(90), deliveredAt: daysAgo(60) },
      { id: 's-tr-4', title: 'Gearbox finder quotes', status: 'in-progress', verticalId: 'tr-sales', workflowIds: ['tr-quote-requests'], agreedAt: daysAgo(90) },
      { id: 's-tr-5', title: 'Review requests', status: 'delivered', verticalId: 'tr-marketing', workflowIds: ['tr-review-requests'], agreedAt: daysAgo(45), deliveredAt: daysAgo(30) },
      { id: 's-tr-6', title: 'Abandoned cart recovery', status: 'delivered', verticalId: 'tr-marketing', workflowIds: ['tr-abandoned-cart'], agreedAt: daysAgo(45), deliveredAt: daysAgo(20) },
    ],
    communications: [
      { id: 'c-tr-1', companyId: 'transmissies', type: 'email', title: 'Introduction', summary: 'Milan found us through the n8n community. Wants to automate quotes.', at: daysAgo(120), participantIds: ['u-milan', 'u-marrallisa'], phase: 'introduction' },
      { id: 'c-tr-2', companyId: 'transmissies', type: 'visit', title: 'Visit Rotterdam warehouse', summary: 'Saw the quote process: 40 minutes per quote, 6 systems.', at: daysAgo(112), participantIds: ['u-milan', 'u-marrallisa', 'u-mirza'], phase: 'visit' },
      { id: 'c-tr-3', companyId: 'transmissies', type: 'workshop', title: 'Inspiration workshop', summary: 'Order flow, stock sync, quotes, reviews, shipping updates.', at: daysAgo(100), participantIds: ['u-milan', 'u-marrallisa', 'u-mirza'], phase: 'workshop' },
      { id: 'c-tr-4', companyId: 'transmissies', type: 'meeting', title: 'Business case', summary: 'Stock sync pays for itself in 3 months. Approved.', at: daysAgo(90), participantIds: ['u-milan', 'u-marrallisa'], phase: 'business-case' },
      { id: 'c-tr-5', companyId: 'transmissies', type: 'call', title: 'PoC: first automated quote', summary: 'Gearbox finder matched 7 of 10 requests correctly.', at: daysAgo(60), participantIds: ['u-milan', 'u-mirza'], phase: 'poc' },
      { id: 'c-tr-6', companyId: 'transmissies', type: 'email', title: 'Test phase started', summary: 'Sales tests the gearbox finder for 3 weeks. Timeouts reported.', at: daysAgo(18), participantIds: ['u-milan', 'u-marrallisa'], phase: 'test' },
      { id: 'c-tr-7', companyId: 'transmissies', type: 'call', title: 'Go-live decision', summary: 'Decide whether the gearbox finder goes live for all customers.', at: daysAgo(-3), participantIds: ['u-milan', 'u-marrallisa', 'u-mirza'] },
    ],
  },
  {
    companyId: 'hoasted',
    phase: 'poc',
    phaseSince: daysAgo(40),
    phaseNote: 'Incident routing and certificate watch run as proof of concept. Support triage is the next candidate.',
    processOwnerId: 'u-marrallisa',
    technicalOwnerId: 'u-daan',
    clientContactIds: ['u-tom'],
    wants: ['Incidents on the status page within a minute', 'Fewer support tickets touched by a person'],
    needs: ['Nothing may send customer emails without a review step for now', 'Everything must be reversible during the PoC'],
    nextStep: { title: 'PoC review and business case', at: daysAgo(-9), ownerId: 'u-marrallisa' },
    nextSteps: [
      { title: 'Batch the certificate checks', at: daysAgo(-4), ownerId: 'u-daan' },
      { title: 'PoC review and business case', at: daysAgo(-9), ownerId: 'u-marrallisa' },
      { title: 'Decide on support triage without review step', at: daysAgo(-20), ownerId: 'u-tom' },
    ],
    scope: [
      { id: 's-ho-1', title: 'Incident routing to the status page', status: 'delivered', verticalId: 'ho-infra', workflowIds: ['ho-uptime-incidents'], agreedAt: daysAgo(40), deliveredAt: daysAgo(30) },
      { id: 's-ho-2', title: 'Certificate expiry watch', status: 'delivered', verticalId: 'ho-infra', workflowIds: ['ho-ssl-expiry'], agreedAt: daysAgo(40), deliveredAt: daysAgo(28) },
      { id: 's-ho-3', title: 'AI support triage', status: 'in-progress', verticalId: 'ho-support', workflowIds: ['ho-support-triage'], agreedAt: daysAgo(30) },
      { id: 's-ho-4', title: 'Invoice dunning', status: 'in-progress', verticalId: 'ho-finance', workflowIds: ['ho-invoice-dunning'], agreedAt: daysAgo(25) },
    ],
    communications: [
      { id: 'c-ho-1', companyId: 'hoasted', type: 'email', title: 'Introduction', summary: 'Tom wants to reduce on-call noise.', at: daysAgo(70), participantIds: ['u-tom', 'u-marrallisa'], phase: 'introduction' },
      { id: 'c-ho-2', companyId: 'hoasted', type: 'visit', title: 'Visit Utrecht', summary: 'Shadowed the on-call engineer for a morning.', at: daysAgo(62), participantIds: ['u-tom', 'u-marrallisa', 'u-daan'], phase: 'visit' },
      { id: 'c-ho-3', companyId: 'hoasted', type: 'workshop', title: 'Inspiration workshop', summary: 'Incidents, certificates, triage, dunning.', at: daysAgo(55), participantIds: ['u-tom', 'u-marrallisa', 'u-daan'], phase: 'workshop' },
      { id: 'c-ho-4', companyId: 'hoasted', type: 'note', title: 'PoC scope', summary: 'Incident routing and certificate watch, 6 weeks, reversible.', at: daysAgo(40), participantIds: ['u-marrallisa', 'u-daan'], phase: 'poc' },
      { id: 'c-ho-5', companyId: 'hoasted', type: 'call', title: 'PoC review', summary: 'Review results and decide on the business case.', at: daysAgo(-9), participantIds: ['u-tom', 'u-marrallisa', 'u-daan'] },
    ],
  },
];

export const projectFor = (companyId: string): ProjectInfo | undefined => PROJECTS.find((p) => p.companyId === companyId);
export const phaseIndex = (id: PhaseId): number => PHASES.findIndex((p) => p.id === id);
