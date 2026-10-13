import { daysAgo, hoursAgo, NOW } from '../lib/format';

/**
 * Planner: tasks created by tagging someone. Importance decides where it lands:
 * high is planned within a day, medium within three working days, low only
 * reaches the inbox. Client calls come from the project communication log.
 */
export type Importance = 'high' | 'medium' | 'low';
export type TaskStatus = 'inbox' | 'planned' | 'done';

export interface Task {
  id: string;
  title: string;
  body: string;
  assigneeId: string;
  createdById: string;
  createdAt: string;
  importance: Importance;
  status: TaskStatus;
  plannedAt?: string;
  durationMin: number;
  workflowId?: string;
  companyId?: string;
  /** why the importance was chosen (AI suggestion or a person) */
  reason: string;
}

export const WORK_START = 9;
export const WORK_END = 17;

const at = (dayOffset: number, hour: number, minute = 0): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const SEED_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Reconnect the HubSpot credential for Volkswagen',
    body: '@Mirza Iqbal the token expired at 06:12, dealers get no leads. Can you re-authenticate and replay the failed runs?',
    assigneeId: 'u-mirza',
    createdById: 'u-marrallisa',
    createdAt: hoursAgo(1),
    importance: 'high',
    status: 'planned',
    plannedAt: at(0, 15, 0),
    durationMin: 60,
    workflowId: 'vw-dealer-lead-routing',
    companyId: 'volkswagen',
    reason: 'Breaking: a credential expired and 164 leads failed',
  },
  {
    id: 't2',
    title: 'Respond to the quote webhook immediately',
    body: '@Mirza Iqbal the gearbox finder times out after 31s, sales sees errors while the quote is still created.',
    assigneeId: 'u-mirza',
    createdById: 'u-milan',
    createdAt: hoursAgo(14),
    importance: 'high',
    status: 'planned',
    plannedAt: at(1, 9, 30),
    durationMin: 90,
    workflowId: 'tr-quote-requests',
    companyId: 'transmissies',
    reason: 'Breaking: visitors see errors, duplicate quotes are created',
  },
  {
    id: 't3',
    title: 'Switch stock updates to the batch endpoint',
    body: '@Finn Mulder can we batch the WooCommerce updates? 41 minutes per run now.',
    assigneeId: 'u-finn',
    createdById: 'u-milan',
    createdAt: hoursAgo(9),
    importance: 'medium',
    status: 'planned',
    plannedAt: at(2, 10, 0),
    durationMin: 120,
    workflowId: 'tr-stock-sync',
    companyId: 'transmissies',
    reason: 'Wasteful but not broken: it still works, just slowly',
  },
  {
    id: 't4',
    title: 'Rename the two Edit Fields nodes',
    body: '@Daan Visser rename these before the content team gets the handover.',
    assigneeId: 'u-daan',
    createdById: 'u-marrallisa',
    createdAt: daysAgo(1),
    importance: 'low',
    status: 'inbox',
    durationMin: 15,
    workflowId: 'vir-content-pipeline',
    companyId: 'viralistic',
    reason: 'Readability only, nothing is affected',
  },
  {
    id: 't5',
    title: 'Call Lotte about the dealer leads',
    body: 'Explain what happened this morning and when the failed leads are replayed.',
    assigneeId: 'u-marrallisa',
    createdById: 'u-marrallisa',
    createdAt: hoursAgo(1),
    importance: 'high',
    status: 'planned',
    plannedAt: at(0, 16, 30),
    durationMin: 30,
    companyId: 'volkswagen',
    reason: 'A client is waiting for an answer',
  },
  {
    id: 't6',
    title: 'Prepare the Hoasted business case',
    body: 'Numbers from the PoC: incident time, certificate misses, triage minutes.',
    assigneeId: 'u-marrallisa',
    createdById: 'u-marrallisa',
    createdAt: daysAgo(2),
    importance: 'medium',
    status: 'planned',
    plannedAt: at(3, 15, 0),
    durationMin: 120,
    companyId: 'hoasted',
    reason: 'Needed before the PoC review',
  },
  {
    id: 't7',
    title: 'Idea: Trustpilot reply drafts',
    body: '@Marrallisa maybe an automation that drafts replies to reviews? No rush.',
    assigneeId: 'u-marrallisa',
    createdById: 'u-milan',
    createdAt: daysAgo(3),
    importance: 'low',
    status: 'inbox',
    durationMin: 30,
    companyId: 'transmissies',
    reason: 'An idea, not a request',
  },
  {
    id: 't8',
    title: 'Cap the triage agent at 6 iterations',
    body: '@Daan Visser one ticket looped 23 tool calls last week.',
    assigneeId: 'u-daan',
    createdById: 'u-tom',
    createdAt: daysAgo(3),
    importance: 'medium',
    status: 'planned',
    plannedAt: at(1, 14, 0),
    durationMin: 45,
    workflowId: 'ho-support-triage',
    companyId: 'hoasted',
    reason: 'Costs money occasionally, nothing is down',
  },
];

/** Keyword heuristics standing in for the model that judges importance. */
export function suggestImportance(text: string): { importance: Importance; reason: string } {
  const t = text.toLowerCase();
  const high = ['failing', 'fails', 'broken', 'down', 'urgent', 'asap', 'today', 'expired', 'error', '401', 'timeout', 'no leads', 'not working', 'client is waiting', 'production', 'breaking'];
  const low = ['idea', 'maybe', 'someday', 'nice to have', 'when you have time', 'no rush', 'low', 'later', 'could we', 'thought'];
  const hitHigh = high.find((k) => t.includes(k));
  if (hitHigh) return { importance: 'high', reason: `Sounds like something is broken (“${hitHigh}”)` };
  const hitLow = low.find((k) => t.includes(k));
  if (hitLow) return { importance: 'low', reason: `Reads like an idea (“${hitLow}”), inbox only` };
  return { importance: 'medium', reason: 'A normal request: planned within three working days' };
}

export const IMPORTANCE_LABEL: Record<Importance, string> = { high: 'High', medium: 'Medium', low: 'Low' };
export const IMPORTANCE_HINT: Record<Importance, string> = {
  high: 'Planned within a day, in the first free hour',
  medium: 'Planned within three working days',
  low: 'Inbox only, picked up when there is time',
};
