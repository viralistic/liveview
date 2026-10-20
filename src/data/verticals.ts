import type { BadgeDef, BadgeId, Kpi, MemberStats, Reward, Vertical } from './types';
import { daysAgo } from '../lib/format';

/**
 * A client onboards per vertical. Each vertical has a Head of AI, a small team,
 * the workflows that serve it and the KPIs partner and client agreed on.
 * Volkswagen is the enterprise example: three verticals live, Finance
 * onboarding, HRM planned.
 */
export const VERTICALS: Vertical[] = [
  /* Viralistic: our own agency, one vertical */
  { id: 'vi-agency', companyId: 'viralistic', name: 'Agency', label: 'Head of AI', description: 'Lead intake, invoicing, reporting and the shared services clients call.', status: 'live', managerId: 'u-marrallisa', memberIds: ['u-daan', 'u-eva', 'u-sara'], workflowIds: ['vir-lead-intake', 'vir-lead-enrich', 'vir-invoicing', 'vir-content-pipeline', 'vir-client-reporting', 'vir-report-render', 'vir-slack-alerts', 'vir-social-scheduler'], plannedProductIds: [], onboardedAt: daysAgo(400), color: '#e8558a' },

  /* Volkswagen */
  { id: 'vw-new-business', companyId: 'volkswagen', name: 'New business', label: 'Head of AI New Business', description: 'Dealer leads, scoring, test drives and the CRM sync with the dealer DMS.', status: 'live', managerId: 'u-lotte', memberIds: ['u-ruben', 'u-noor'], workflowIds: ['vw-dealer-lead-routing', 'vw-lead-scoring', 'vw-test-drive-booking', 'vw-crm-sync'], plannedProductIds: [], onboardedAt: daysAgo(95), color: '#2f6bff' },
  { id: 'vw-after-sales', companyId: 'volkswagen', name: 'After-sales', label: 'Head of AI After-sales', description: 'Service reminders and the post-visit NPS survey.', status: 'live', managerId: 'u-anouk', memberIds: ['u-bas'], workflowIds: ['vw-service-reminders', 'vw-nps-survey'], plannedProductIds: ['review-requests'], onboardedAt: daysAgo(70), color: '#31c4ab' },
  { id: 'vw-parts', companyId: 'volkswagen', name: 'Parts & operations', label: 'Head of AI Operations', description: 'Parts inventory alerts across the dealer network.', status: 'live', memberIds: ['u-sven'], workflowIds: ['vw-parts-inventory-alerts'], plannedProductIds: [], onboardedAt: daysAgo(50), color: '#f28c28' },
  { id: 'vw-finance', companyId: 'volkswagen', name: 'Finance', label: 'Head of AI Finance', description: 'Supplier invoices read, matched and booked. Onboarding now with the invoice checker product.', status: 'onboarding', managerId: 'u-pieter', memberIds: ['u-femke'], workflowIds: [], plannedProductIds: ['invoice-checker', 'invoice-dunning'], onboardedAt: daysAgo(12), color: '#7c5cff' },
  { id: 'vw-hrm', companyId: 'volkswagen', name: 'HRM', label: 'Head of AI HRM', description: 'Onboarding and leave requests. Planned for Q1.', status: 'planned', memberIds: [], workflowIds: [], plannedProductIds: ['employee-onboarding', 'leave-requests'], color: '#9d85ff' },

  /* Transmissies.nl */
  { id: 'tr-sales', companyId: 'transmissies', name: 'Sales', label: 'Head of AI Sales', description: 'Quote requests and the gearbox finder.', status: 'live', managerId: 'u-milan', memberIds: ['u-lars'], workflowIds: ['tr-quote-requests'], plannedProductIds: [], onboardedAt: daysAgo(60), color: '#f28c28' },
  { id: 'tr-operations', companyId: 'transmissies', name: 'Operations', label: 'Head of AI Operations', description: 'Order flow, stock sync with Exact and shipping updates.', status: 'live', managerId: 'u-milan', memberIds: [], workflowIds: ['tr-order-processing', 'tr-stock-sync', 'tr-shipping-notifications'], plannedProductIds: [], onboardedAt: daysAgo(80), color: '#2f6bff' },
  { id: 'tr-marketing', companyId: 'transmissies', name: 'Marketing', label: 'Head of AI Marketing', description: 'Review requests and abandoned carts.', status: 'live', memberIds: [], workflowIds: ['tr-review-requests', 'tr-abandoned-cart'], plannedProductIds: ['social-scheduler'], onboardedAt: daysAgo(45), color: '#31c4ab' },

  /* Hoasted */
  { id: 'ho-support', companyId: 'hoasted', name: 'Support', label: 'Head of AI Support', description: 'AI triage of incoming tickets.', status: 'live', managerId: 'u-tom', memberIds: [], workflowIds: ['ho-support-triage'], plannedProductIds: [], onboardedAt: daysAgo(30), color: '#2fb67c' },
  { id: 'ho-finance', companyId: 'hoasted', name: 'Finance', label: 'Head of AI Finance', description: 'Invoice dunning.', status: 'live', memberIds: [], workflowIds: ['ho-invoice-dunning'], plannedProductIds: ['invoice-generator'], onboardedAt: daysAgo(25), color: '#7c5cff' },
  { id: 'ho-infra', companyId: 'hoasted', name: 'Infrastructure', label: 'Head of AI Infrastructure', description: 'Incident routing and certificate watch.', status: 'live', managerId: 'u-tom', memberIds: [], workflowIds: ['ho-uptime-incidents', 'ho-ssl-expiry'], plannedProductIds: ['error-alerts'], onboardedAt: daysAgo(40), color: '#2f6bff' },
];

export const verticalById = (id: string): Vertical | undefined => VERTICALS.find((v) => v.id === id);
export const verticalsFor = (companyId: string): Vertical[] => VERTICALS.filter((v) => v.companyId === companyId);
export const verticalOfWorkflow = (workflowId: string): Vertical | undefined => VERTICALS.find((v) => v.workflowIds.includes(workflowId));
export const VERTICAL_STATUS_LABEL: Record<Vertical['status'], string> = { live: 'Live', onboarding: 'Onboarding', planned: 'Planned' };

/* ------------------------------------------------------------------ */
/* KPIs agreed between partner and client. They live as tiles on the  */
/* client's dashboard and on the vertical's team page.                 */
/* ------------------------------------------------------------------ */
const K = (id: string, companyId: string, verticalId: string | undefined, label: string, description: string, unit: Kpi['unit'], direction: Kpi['direction'], baseline: number, target: number, current: number, series: number[], agreedAt: string, agreedByIds: string[]): Kpi => ({ id, companyId, verticalId, label, description, unit, direction, baseline, target, current, series, agreedAt, agreedByIds });

export const KPIS: Kpi[] = [
  /* Volkswagen */
  K('kpi-vw-response', 'volkswagen', 'vw-new-business', 'Lead response time', 'Minutes between a dealer lead arriving and the first personal reply.', 'min', 'down', 240, 5, 4.2, [38, 22, 14, 9, 7, 6, 5.5, 5.1, 4.8, 4.6, 4.4, 4.2], daysAgo(170), ['u-marrallisa', 'u-sanne']),
  K('kpi-vw-testdrives', 'volkswagen', 'vw-new-business', 'Test drives booked online', 'Share of test drives booked without a phone call.', '%', 'up', 8, 60, 54, [12, 18, 24, 31, 36, 40, 44, 47, 49, 51, 53, 54], daysAgo(170), ['u-marrallisa', 'u-sanne']),
  K('kpi-vw-reminders', 'volkswagen', 'vw-after-sales', 'Service reminder reach', 'Customers reached with a service reminder before the due date.', '%', 'up', 55, 90, 93, [58, 64, 70, 76, 81, 85, 88, 90, 91, 92, 92, 93], daysAgo(70), ['u-marrallisa', 'u-anouk']),
  K('kpi-vw-stockouts', 'volkswagen', 'vw-parts', 'Stock-outs per month', 'Parts orders that could not be fulfilled from stock.', 'count', 'down', 31, 10, 14, [31, 29, 27, 26, 23, 22, 20, 18, 17, 16, 15, 14], daysAgo(50), ['u-marrallisa', 'u-sanne']),
  K('kpi-vw-hours', 'volkswagen', undefined, 'Hours saved per month', 'Manual work replaced across every live vertical.', 'h', 'up', 0, 400, 462, [60, 110, 160, 210, 260, 300, 340, 370, 400, 425, 445, 462], daysAgo(170), ['u-marrallisa', 'u-sanne']),
  K('kpi-vw-invoices', 'volkswagen', 'vw-finance', 'Invoice processing time', 'Days from a supplier invoice arriving to it being booked.', 'days', 'down', 9, 2, 9, [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9], daysAgo(12), ['u-marrallisa', 'u-pieter']),
  /* Transmissies.nl */
  K('kpi-tr-quote', 'transmissies', 'tr-sales', 'Quote turnaround', 'Hours from request to quote sent.', 'h', 'down', 24, 1, 0.8, [20, 16, 12, 8, 5, 3, 2, 1.6, 1.2, 1, 0.9, 0.8], daysAgo(90), ['u-marrallisa', 'u-milan']),
  K('kpi-tr-stock', 'transmissies', 'tr-operations', 'Stock accuracy', 'Webshop stock matching Exact Online.', '%', 'up', 91, 99, 98.4, [91, 93, 95, 96, 97, 97.5, 98, 98.1, 98.2, 98.3, 98.4, 98.4], daysAgo(90), ['u-marrallisa', 'u-milan']),
  K('kpi-tr-calls', 'transmissies', 'tr-operations', 'Shipping calls per week', 'Customers phoning about where their order is.', 'count', 'down', 80, 20, 26, [80, 72, 61, 55, 48, 41, 37, 33, 30, 28, 27, 26], daysAgo(90), ['u-marrallisa', 'u-milan']),
  K('kpi-tr-reviews', 'transmissies', 'tr-marketing', 'Review rate', 'Delivered orders that leave a review.', '%', 'up', 4, 15, 17, [4, 6, 8, 10, 12, 13, 14, 15, 16, 16, 17, 17], daysAgo(45), ['u-marrallisa', 'u-milan']),
  /* Hoasted */
  K('kpi-ho-status', 'hoasted', 'ho-infra', 'Incident to status page', 'Minutes from alert to a public status update.', 'min', 'down', 25, 1, 0.9, [25, 18, 9, 4, 2, 1.5, 1.2, 1, 1, 0.9, 0.9, 0.9], daysAgo(40), ['u-marrallisa', 'u-tom']),
  K('kpi-ho-tickets', 'hoasted', 'ho-support', 'Tickets touched by a person', 'Support tickets that needed a human before an answer went out.', '%', 'down', 100, 40, 61, [100, 96, 90, 84, 79, 74, 71, 68, 66, 64, 62, 61], daysAgo(30), ['u-marrallisa', 'u-tom']),
  K('kpi-ho-overdue', 'hoasted', 'ho-finance', 'Invoices overdue 30 days', 'Open invoices older than thirty days.', 'count', 'down', 48, 15, 22, [48, 45, 41, 38, 35, 32, 30, 28, 26, 24, 23, 22], daysAgo(25), ['u-marrallisa', 'u-tom']),
  /* Viralistic */
  K('kpi-vi-invoicing', 'viralistic', 'vi-agency', 'Manual invoicing hours', 'Hours spent on invoices per month.', 'h', 'down', 16, 0, 0.5, [16, 12, 8, 4, 2, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5], daysAgo(400), ['u-marrallisa', 'u-eva']),
  K('kpi-vi-leads', 'viralistic', 'vi-agency', 'Leads answered within a minute', 'Form submissions that get a personal reply within sixty seconds.', '%', 'up', 20, 95, 97, [20, 40, 70, 88, 92, 94, 95, 96, 96, 97, 97, 97], daysAgo(400), ['u-marrallisa', 'u-sara']),
];

export const kpisFor = (companyId: string, verticalId?: string): Kpi[] => KPIS.filter((k) => k.companyId === companyId && (verticalId === undefined || k.verticalId === verticalId));
export function kpiHit(k: Kpi): boolean {
  return k.direction === 'down' ? k.current <= k.target : k.current >= k.target;
}
/** 0..1 progress from baseline to target, clamped. */
export function kpiProgress(k: Kpi): number {
  const span = k.target - k.baseline;
  if (span === 0) return 1;
  return Math.max(0, Math.min(1, (k.current - k.baseline) / span));
}
export const KPI_UNIT_LABEL: Record<Kpi['unit'], string> = { min: 'min', h: 'h', '%': '%', count: '', eur: '€', days: 'days' };
export function fmtKpi(k: Kpi, v: number = k.current): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (k.unit === 'eur') return `€ ${n}`;
  if (k.unit === '%') return `${n}%`;
  if (k.unit === 'count') return n;
  return `${n} ${KPI_UNIT_LABEL[k.unit]}`;
}

/* ------------------------------------------------------------------ */
/* Gamification: people in a team earn points for using the           */
/* automations, time saved, KPI targets hit and bugs they spot.       */
/* ------------------------------------------------------------------ */
export const BADGES: BadgeDef[] = [
  { id: 'first-run', label: 'First run', description: 'Triggered an automation for the first time.', icon: 'Play' },
  { id: 'early-adopter', label: 'Early adopter', description: 'On the platform in the first week of the vertical.', icon: 'Rocket' },
  { id: 'streak-4', label: '4-week streak', description: 'Used the automations every week for a month.', icon: 'Flame' },
  { id: 'streak-12', label: '12-week streak', description: 'A whole quarter without missing a week.', icon: 'Flame' },
  { id: 'saver-50', label: '50 hours saved', description: 'Fifty hours of manual work replaced.', icon: 'Clock' },
  { id: 'saver-200', label: '200 hours saved', description: 'Two hundred hours of manual work replaced.', icon: 'Hourglass' },
  { id: 'kpi-crusher', label: 'KPI crusher', description: 'Hit every KPI target of the team in one month.', icon: 'Target' },
  { id: 'bug-spotter', label: 'Bug spotter', description: 'Reported an error before the monitoring did.', icon: 'Bug' },
  { id: 'mentor', label: 'Mentor', description: 'Onboarded a colleague to the automations.', icon: 'HeartHandshake' },
  { id: 'top-of-month', label: 'Top of the month', description: 'Number one on the leaderboard for a month.', icon: 'Trophy' },
];
export const badgeById = (id: BadgeId): BadgeDef => BADGES.find((b) => b.id === id)!;

export const REWARDS: Reward[] = [
  { id: 'coffee', label: 'Coffee on the house', description: 'A week of specialty coffee for the team.', points: 250, icon: 'Coffee' },
  { id: 'lunch', label: 'Team lunch', description: 'Lunch out with the vertical.', points: 600, icon: 'Utensils' },
  { id: 'halfday', label: 'Half day off', description: 'An afternoon off, no questions asked.', points: 1500, icon: 'Sun' },
  { id: 'conference', label: 'Conference ticket', description: 'A ticket to the next n8n community conference.', points: 3000, icon: 'Ticket' },
  { id: 'champion', label: 'Automation champion', description: 'The quarterly trophy and a mention in the company update.', points: 5000, icon: 'Trophy' },
];
export function nextReward(points: number): Reward | undefined {
  return REWARDS.find((r) => r.points > points);
}
export function earnedRewards(points: number): Reward[] {
  return REWARDS.filter((r) => r.points <= points);
}

const M = (userId: string, verticalId: string, runsTriggered30d: number, hoursSaved30d: number, euroSaved30d: number, kpiHits: number, kpiTotal: number, points: number, streakWeeks: number, badges: BadgeId[], series12w: number[]): MemberStats => ({ userId, verticalId, runsTriggered30d, hoursSaved30d, euroSaved30d, kpiHits, kpiTotal, points, streakWeeks, badges, series12w });

export const MEMBER_STATS: MemberStats[] = [
  /* Volkswagen · New business */
  M('u-ruben', 'vw-new-business', 612, 61, 4392, 2, 2, 1840, 13, ['first-run', 'early-adopter', 'streak-12', 'saver-50', 'kpi-crusher', 'top-of-month'], [90, 110, 120, 140, 150, 160, 165, 170, 180, 175, 185, 195]),
  M('u-noor', 'vw-new-business', 448, 44, 3168, 2, 2, 1420, 9, ['first-run', 'streak-4', 'saver-50', 'bug-spotter'], [40, 70, 90, 100, 120, 130, 135, 140, 150, 145, 150, 150]),
  M('u-lotte', 'vw-new-business', 131, 18, 1296, 2, 2, 980, 13, ['first-run', 'early-adopter', 'mentor'], [60, 70, 80, 80, 85, 90, 85, 90, 85, 85, 90, 80]),
  /* Volkswagen · After-sales */
  M('u-bas', 'vw-after-sales', 377, 29, 2088, 1, 1, 1210, 10, ['first-run', 'streak-4', 'saver-50', 'kpi-crusher'], [30, 60, 90, 100, 110, 120, 125, 130, 130, 135, 140, 140]),
  M('u-anouk', 'vw-after-sales', 92, 11, 792, 1, 1, 760, 10, ['first-run', 'mentor'], [40, 50, 60, 60, 70, 70, 75, 70, 80, 70, 75, 70]),
  /* Volkswagen · Parts */
  M('u-sven', 'vw-parts', 158, 31, 2232, 0, 1, 690, 7, ['first-run', 'streak-4', 'bug-spotter'], [0, 0, 40, 60, 80, 90, 100, 100, 110, 110, 120, 120]),
  /* Volkswagen · Finance (onboarding) */
  M('u-femke', 'vw-finance', 24, 4, 288, 0, 1, 310, 2, ['first-run', 'early-adopter'], [0, 0, 0, 0, 0, 0, 0, 0, 0, 60, 120, 130]),
  M('u-pieter', 'vw-finance', 6, 1, 72, 0, 1, 150, 2, ['first-run'], [0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 60, 50]),
  /* Transmissies.nl */
  M('u-milan', 'tr-operations', 290, 38, 1824, 2, 2, 1130, 11, ['first-run', 'early-adopter', 'streak-4', 'saver-50', 'bug-spotter', 'mentor'], [70, 80, 90, 100, 100, 110, 110, 120, 120, 125, 130, 135]),
  M('u-lars', 'tr-sales', 203, 47, 2256, 1, 1, 870, 8, ['first-run', 'streak-4', 'saver-50'], [30, 50, 70, 80, 90, 95, 100, 100, 110, 110, 115, 120]),
  /* Viralistic */
  M('u-daan', 'vi-agency', 420, 52, 4420, 2, 2, 1560, 13, ['first-run', 'early-adopter', 'streak-12', 'saver-200', 'mentor'], [120, 120, 130, 130, 140, 140, 150, 150, 160, 160, 170, 170]),
  M('u-eva', 'vi-agency', 88, 24, 2040, 1, 2, 640, 6, ['first-run', 'saver-50'], [40, 50, 50, 60, 60, 60, 70, 70, 70, 70, 80, 80]),
  M('u-sara', 'vi-agency', 142, 16, 1360, 2, 2, 720, 12, ['first-run', 'streak-12'], [50, 55, 60, 60, 65, 65, 70, 70, 70, 75, 75, 80]),
];

export const statsFor = (userId: string): MemberStats | undefined => MEMBER_STATS.find((m) => m.userId === userId);
/** Members of a vertical (manager included) ranked by points. */
export function leaderboard(verticalId: string): MemberStats[] {
  return MEMBER_STATS.filter((m) => m.verticalId === verticalId).sort((a, b) => b.points - a.points);
}
export function rankOf(userId: string): { rank: number; of: number } | undefined {
  const me = statsFor(userId);
  if (!me) return undefined;
  const board = leaderboard(me.verticalId);
  return { rank: board.findIndex((m) => m.userId === userId) + 1, of: board.length };
}
