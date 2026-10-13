import type { Issue, Severity, Trigger, WfConnection, WfNode, Workflow, WorkflowStats } from './types';
import { seeded } from '../lib/rng';
import { daysAgo, hoursAgo, minutesAgo, NOW } from '../lib/format';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type NodeSpec = [id: string, type: string, name: string, col: number, row?: number];
const N = (specs: NodeSpec[]): WfNode[] => specs.map(([id, type, name, col, row = 0]) => ({ id, type, name, col, row }));
const C = (pairs: (readonly [string, string] | readonly [string, string, string])[]): WfConnection[] =>
  pairs.map(([from, to, label]) => (label ? { from, to, label } : { from, to }));

interface StatSpec {
  /** expected runs per day */
  perDay: number;
  /** failure ratio 0..1 */
  failRate: number;
  avgMs: number;
  /** failures concentrated in the last N buckets (6h) e.g. an outage */
  outageBuckets?: number;
  lastStatus?: WorkflowStats['lastStatus'];
  lastRunMinAgo?: number;
}

function makeStats(id: string, s: StatSpec, active: boolean): WorkflowStats {
  const rand = seeded(id);
  const buckets = 28; // 7 days × 4 buckets of 6h
  const series: number[] = [];
  const failures: number[] = [];
  // low-frequency flows (daily, weekly, monthly) run in the morning bucket of their day
  let carry = 0;
  const lowFreq = s.perDay < 4;
  for (let i = 0; i < buckets; i++) {
    // business-hours shape: buckets 2 (12-18h) and 1 (06-12h) are busier
    const hour = (i % 4) * 6;
    const dayWeight = hour === 6 ? 1.2 : hour === 12 ? 1.35 : hour === 18 ? 0.8 : 0.45;
    const base = (s.perDay / 4) * dayWeight;
    let n = active ? Math.max(0, Math.round(base * (0.7 + rand() * 0.6))) : 0;
    if (lowFreq && active) {
      if (hour === 6) {
        carry += s.perDay;
        n = Math.floor(carry);
        carry -= n;
      } else n = 0;
    }
    let f = 0;
    if (active && n > 0) {
      const inOutage = s.outageBuckets ? i >= buckets - s.outageBuckets : false;
      const rate = inOutage ? Math.min(1, s.failRate * 6 + 0.6) : Math.max(0, s.failRate - (s.outageBuckets ? s.failRate * 0.8 : 0));
      f = Math.round(n * rate * (0.7 + rand() * 0.6));
      f = Math.min(n, f);
    }
    series.push(n);
    failures.push(f);
  }
  const runs7d = series.reduce((a, b) => a + b, 0);
  const failed7d = failures.reduce((a, b) => a + b, 0);
  const runs24h = series.slice(-4).reduce((a, b) => a + b, 0);
  const failed24h = failures.slice(-4).reduce((a, b) => a + b, 0);
  return {
    runs7d,
    runs24h,
    failed7d,
    failed24h,
    successRate: runs7d ? 1 - failed7d / runs7d : 1,
    avgDurationMs: s.avgMs,
    p95DurationMs: Math.round(s.avgMs * (1.9 + rand() * 1.2)),
    lastRunAt: active ? minutesAgo(s.lastRunMinAgo ?? Math.round(2 + rand() * 180)) : daysAgo(12 + Math.round(rand() * 20)),
    lastStatus: active ? (s.lastStatus ?? 'success') : 'success',
    series7d: series,
    failures7d: failures,
  };
}

interface WfSpec {
  id: string;
  name: string;
  companyId: string;
  description: string;
  trigger: Trigger;
  active?: boolean;
  nodes: WfNode[];
  connections: WfConnection[];
  calls?: string[];
  tags?: string[];
  ownerId: string;
  updatedAt: string;
  updatedById: string;
  version: number;
  credentialIds?: string[];
  stats: StatSpec;
  issues?: Omit<Issue, 'id' | 'workflowId'>[];
  shared?: boolean;
}

function wf(spec: WfSpec): Workflow {
  const active = spec.active ?? true;
  return {
    id: spec.id,
    slug: spec.id,
    name: spec.name,
    companyId: spec.companyId,
    description: spec.description,
    trigger: spec.trigger,
    active,
    nodes: spec.nodes,
    connections: spec.connections,
    calls: spec.calls ?? [],
    tags: spec.tags ?? [],
    ownerId: spec.ownerId,
    updatedAt: spec.updatedAt,
    updatedById: spec.updatedById,
    version: spec.version,
    credentialIds: spec.credentialIds ?? [],
    stats: makeStats(spec.id, spec.stats, active),
    issues: (spec.issues ?? []).map((i, idx) => ({ ...i, id: `${spec.id}-i${idx + 1}`, workflowId: spec.id })),
    shared: spec.shared,
  };
}

const issue = (
  severity: Severity,
  title: string,
  detail: string,
  suggestion: string,
  impact: string,
  nodeId?: string,
  detectedAt = hoursAgo(8),
  estSavings?: Issue['estSavings'],
): Omit<Issue, 'id' | 'workflowId'> => ({ severity, title, detail, suggestion, impact, nodeId, detectedAt, estSavings });

/* ------------------------------------------------------------------ */
/* Viralistic Digital Agency Amsterdam                                 */
/* ------------------------------------------------------------------ */

const viralistic: Workflow[] = [
  wf({
    id: 'vir-lead-intake',
    name: 'Website lead intake',
    companyId: 'viralistic',
    description: 'Takes form submissions from viralistic.nl, creates the HubSpot contact, notifies sales and sends an auto-reply.',
    trigger: { kind: 'webhook', label: 'POST /lead', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Lead form', 0],
      ['set', 'set', 'Normalize fields', 1],
      ['hs', 'hubspot', 'Create contact', 2],
      ['if', 'if', 'Budget > €5k?', 3],
      ['slack', 'slack', '#sales', 4, 0],
      ['mail', 'gmail', 'Auto-reply', 4, 1],
      ['exec', 'executeWorkflow', 'Enrich lead', 5, 0],
    ]),
    connections: C([
      ['t', 'set'],
      ['set', 'hs'],
      ['hs', 'if'],
      ['if', 'slack', 'true'],
      ['if', 'mail', 'false'],
      ['slack', 'exec'],
    ]),
    calls: ['vir-lead-enrich'],
    tags: ['sales', 'inbound'],
    ownerId: 'u-noor',
    updatedAt: hoursAgo(5),
    updatedById: 'u-daan',
    version: 14,
    credentialIds: ['cred-hubspot-vir', 'cred-slack-vir', 'cred-gmail-sales'],
    stats: { perDay: 38, failRate: 0.01, avgMs: 1850 },
    issues: [
      issue(
        'minor',
        'HubSpot node has no error branch',
        'If HubSpot rate-limits (HTTP 429) the execution fails and the lead is lost silently.',
        'Enable “Continue (using error output)” on Create contact and route errors to the Slack alert workflow.',
        '2 lost leads in the last 30 days',
        'hs',
        daysAgo(2),
      ),
    ],
  }),
  wf({
    id: 'vir-lead-enrich',
    name: 'Lead enrichment (AI)',
    companyId: 'viralistic',
    description: 'Shared service. Enriches a lead with company data and an AI summary, then updates the CRM. Called by three client workflows.',
    trigger: { kind: 'called', label: 'Called by 3 workflows', nodeTypeId: 'executeWorkflowTrigger' },
    nodes: N([
      ['t', 'executeWorkflowTrigger', 'When called', 0],
      ['http', 'http', 'Company lookup', 1],
      ['http2', 'http', 'Tech stack lookup', 2],
      ['ai', 'openai', 'Summarize lead', 3],
      ['set', 'set', 'Map to CRM', 4],
      ['hs', 'hubspot', 'Update contact', 5],
    ]),
    connections: C([
      ['t', 'http'],
      ['http', 'http2'],
      ['http2', 'ai'],
      ['ai', 'set'],
      ['set', 'hs'],
    ]),
    tags: ['shared-service', 'ai'],
    shared: true,
    ownerId: 'u-daan',
    updatedAt: daysAgo(1),
    updatedById: 'u-daan',
    version: 31,
    credentialIds: ['cred-openai', 'cred-hubspot-vir'],
    stats: { perDay: 96, failRate: 0.02, avgMs: 6400 },
    issues: [
      issue(
        'inefficient',
        'Same domain enriched up to 11× per day',
        '61% of calls look up a domain that was already enriched in the last 24 hours. Both lookups are paid API calls.',
        'Cache lookups in a Data Table keyed by domain with a 24h TTL and short-circuit with an If node.',
        '≈ 410 redundant API calls per week',
        'http',
        daysAgo(3),
        { runsPerWeek: 410, minutesPerWeek: 44, euroPerMonth: 86 },
      ),
    ],
  }),
  wf({
    id: 'vir-invoicing',
    name: 'Monthly invoicing → Moneybird',
    companyId: 'viralistic',
    description: 'On the 1st of the month: aggregate approved timesheets per client, create Moneybird invoices and email them.',
    trigger: { kind: 'schedule', label: 'Monthly · 1st 06:00', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', '1st of month', 0],
      ['pg', 'postgres', 'Approved hours', 1],
      ['agg', 'aggregate', 'Per client', 2],
      ['loop', 'loop', 'Each client', 3],
      ['mb', 'moneybird', 'Create invoice', 4],
      ['mail', 'gmail', 'Send invoice', 5],
      ['sheet', 'sheets', 'Log to ledger', 6],
    ]),
    connections: C([
      ['t', 'pg'],
      ['pg', 'agg'],
      ['agg', 'loop'],
      ['loop', 'mb'],
      ['mb', 'mail'],
      ['mail', 'sheet'],
    ]),
    tags: ['finance'],
    ownerId: 'u-noor',
    updatedAt: daysAgo(12),
    updatedById: 'u-noor',
    version: 9,
    credentialIds: ['cred-postgres-vir', 'cred-moneybird', 'cred-gmail-sales', 'cred-sheets'],
    stats: { perDay: 0.3, failRate: 0, avgMs: 48_000, lastRunMinAgo: 60 * 24 * 12 },
  }),
  wf({
    id: 'vir-content-pipeline',
    name: 'Content pipeline: brief → draft → Notion',
    companyId: 'viralistic',
    description: 'A content brief submitted via form is drafted by an AI agent, saved to Notion and announced in Slack.',
    trigger: { kind: 'webhook', label: 'Form: content brief', nodeTypeId: 'formTrigger' },
    nodes: N([
      ['t', 'formTrigger', 'Content brief', 0],
      ['set1', 'set', 'Edit Fields', 1],
      ['agent', 'agent', 'Draft writer', 2],
      ['set2', 'set', 'Edit Fields1', 3],
      ['notion', 'notion', 'Create draft page', 4],
      ['slack', 'slack', '#content', 5],
    ]),
    connections: C([
      ['t', 'set1'],
      ['set1', 'agent'],
      ['agent', 'set2'],
      ['set2', 'notion'],
      ['notion', 'slack'],
    ]),
    tags: ['content', 'ai'],
    ownerId: 'u-daan',
    updatedAt: hoursAgo(26),
    updatedById: 'u-daan',
    version: 6,
    credentialIds: ['cred-openai', 'cred-notion', 'cred-slack-vir'],
    stats: { perDay: 6, failRate: 0.03, avgMs: 21_000 },
    issues: [
      issue(
        'minor',
        'Two nodes still have default names',
        '“Edit Fields” and “Edit Fields1” make executions hard to read for the client.',
        'Rename to what they do: “Build prompt” and “Shape Notion properties”.',
        'Readability',
        'set2',
        daysAgo(1),
      ),
    ],
  }),
  wf({
    id: 'vir-client-reporting',
    name: 'Weekly client reporting',
    companyId: 'viralistic',
    description: 'Every Monday: pull KPIs per client, loop over clients and render + send a PDF report via the render service.',
    trigger: { kind: 'schedule', label: 'Weekly · Mon 07:00', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Monday 07:00', 0],
      ['sheet', 'sheets', 'Client KPIs', 1],
      ['code', 'code', 'Compute deltas', 2],
      ['loop', 'loop', 'Each client', 3],
      ['exec', 'executeWorkflow', 'Render report', 4],
      ['slack', 'slack', '#account-mgmt', 5],
    ]),
    connections: C([
      ['t', 'sheet'],
      ['sheet', 'code'],
      ['code', 'loop'],
      ['loop', 'exec'],
      ['exec', 'slack'],
    ]),
    calls: ['vir-report-render'],
    tags: ['reporting'],
    ownerId: 'u-sara',
    updatedAt: daysAgo(4),
    updatedById: 'u-noor',
    version: 11,
    credentialIds: ['cred-sheets', 'cred-slack-vir'],
    stats: { perDay: 0.15, failRate: 0, avgMs: 94_000, lastRunMinAgo: 60 * 31 },
  }),
  wf({
    id: 'vir-report-render',
    name: 'Render PDF report',
    companyId: 'viralistic',
    description: 'Shared service: renders an HTML template to PDF, stores it in Drive and emails the client contact.',
    trigger: { kind: 'called', label: 'Called by reporting', nodeTypeId: 'executeWorkflowTrigger' },
    nodes: N([
      ['t', 'executeWorkflowTrigger', 'When called', 0],
      ['set', 'set', 'Fill template', 1],
      ['pdf', 'pdf', 'HTML → PDF', 2],
      ['drive', 'googleDrive', 'Store in Drive', 3],
      ['mail', 'gmail', 'Email client', 4],
    ]),
    connections: C([
      ['t', 'set'],
      ['set', 'pdf'],
      ['pdf', 'drive'],
      ['drive', 'mail'],
    ]),
    tags: ['shared-service', 'reporting'],
    shared: true,
    ownerId: 'u-daan',
    updatedAt: daysAgo(9),
    updatedById: 'u-daan',
    version: 4,
    credentialIds: ['cred-gdrive', 'cred-gmail-sales'],
    stats: { perDay: 0.6, failRate: 0, avgMs: 8_200, lastRunMinAgo: 60 * 31 },
  }),
  wf({
    id: 'vir-slack-alerts',
    name: 'Error alerts → Slack',
    companyId: 'viralistic',
    description: 'Global error handler. Any failing execution in the instance posts a formatted alert to #n8n-alerts.',
    trigger: { kind: 'error', label: 'Any workflow error', nodeTypeId: 'errorTrigger' },
    nodes: N([
      ['t', 'errorTrigger', 'On error', 0],
      ['set', 'set', 'Format alert', 1],
      ['slack', 'slack', '#n8n-alerts', 2],
    ]),
    connections: C([
      ['t', 'set'],
      ['set', 'slack'],
    ]),
    tags: ['ops'],
    ownerId: 'u-daan',
    updatedAt: daysAgo(40),
    updatedById: 'u-daan',
    version: 3,
    credentialIds: ['cred-slack-vir'],
    stats: { perDay: 22, failRate: 0, avgMs: 640, lastRunMinAgo: 4 },
  }),
  wf({
    id: 'vir-social-scheduler',
    name: 'Social post scheduler',
    companyId: 'viralistic',
    description: 'Reads the Airtable content calendar and posts to LinkedIn and Telegram at the planned time.',
    trigger: { kind: 'schedule', label: 'Every 30 min', nodeTypeId: 'schedule' },
    active: false,
    nodes: N([
      ['t', 'schedule', 'Every 30 min', 0],
      ['air', 'airtable', 'Due posts', 1],
      ['if', 'if', 'Any due?', 2],
      ['li', 'linkedin', 'Post to LinkedIn', 3, 0],
      ['tg', 'telegram', 'Post to channel', 3, 1],
    ]),
    connections: C([
      ['t', 'air'],
      ['air', 'if'],
      ['if', 'li', 'true'],
      ['if', 'tg', 'true'],
    ]),
    tags: ['marketing'],
    ownerId: 'u-noor',
    updatedAt: daysAgo(21),
    updatedById: 'u-noor',
    version: 7,
    credentialIds: ['cred-airtable', 'cred-telegram'],
    stats: { perDay: 48, failRate: 0, avgMs: 2_100 },
    issues: [
      issue(
        'minor',
        'Paused for 3 weeks with 14 posts due',
        'The content calendar has 14 posts past their planned time while the scheduler is inactive.',
        'Re-activate, or archive the workflow and clear the calendar so the team stops relying on it.',
        '14 overdue posts',
        't',
        daysAgo(1),
      ),
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Volkswagen                                                          */
/* ------------------------------------------------------------------ */

const volkswagen: Workflow[] = [
  wf({
    id: 'vw-dealer-lead-routing',
    name: 'Dealer lead routing',
    companyId: 'volkswagen',
    description: 'Leads from volkswagen.nl are normalized, routed to the right regional dealer in HubSpot and confirmed to the customer by SMS.',
    trigger: { kind: 'webhook', label: 'POST /vw/lead', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Lead form', 0],
      ['set', 'set', 'Normalize', 1],
      ['sw', 'switch', 'Region', 2],
      ['hsN', 'hubspot', 'Deal · North', 3, 0],
      ['hsS', 'hubspot', 'Deal · South', 3, 1],
      ['mail', 'gmail', 'Notify dealer', 4, 0],
      ['sms', 'twilio', 'SMS customer', 4, 1],
      ['exec', 'executeWorkflow', 'Score & enrich', 5, 0],
    ]),
    connections: C([
      ['t', 'set'],
      ['set', 'sw'],
      ['sw', 'hsN', 'North'],
      ['sw', 'hsS', 'South'],
      ['hsN', 'mail'],
      ['hsS', 'sms'],
      ['mail', 'exec'],
    ]),
    calls: ['vw-lead-scoring', 'vir-lead-enrich'],
    tags: ['sales', 'inbound'],
    ownerId: 'u-sara',
    updatedAt: hoursAgo(3),
    updatedById: 'u-noor',
    version: 27,
    credentialIds: ['cred-hubspot-vw', 'cred-gmail-vw', 'cred-twilio-vw'],
    stats: { perDay: 210, failRate: 0.01, avgMs: 2_900, outageBuckets: 2, lastStatus: 'error', lastRunMinAgo: 2 },
    issues: [
      issue(
        'critical',
        'HubSpot credential expired, every lead is failing',
        'The OAuth token for “HubSpot · Volkswagen” expired at 06:12. Both deal nodes return 401 and 100% of executions fail at the Switch step.',
        'Re-authenticate the credential in Credentials, then retry the 164 failed executions from the executions list.',
        '164 failed leads since 06:12',
        'hsN',
        hoursAgo(8),
      ),
    ],
  }),
  wf({
    id: 'vw-lead-scoring',
    name: 'Lead scoring (AI)',
    companyId: 'volkswagen',
    description: 'Scores a routed lead with the model, writes the score to the deal and pings the dealer channel for hot leads.',
    trigger: { kind: 'called', label: 'Called by lead routing', nodeTypeId: 'executeWorkflowTrigger' },
    nodes: N([
      ['t', 'executeWorkflowTrigger', 'When called', 0],
      ['ai', 'openai', 'Score lead', 1],
      ['if', 'if', 'Score ≥ 80?', 2],
      ['hs', 'hubspot', 'Write score', 3, 0],
      ['slack', 'slack', '#hot-leads', 3, 1],
    ]),
    connections: C([
      ['t', 'ai'],
      ['ai', 'if'],
      ['if', 'hs', 'true'],
      ['if', 'slack', 'true'],
    ]),
    tags: ['sales', 'ai'],
    ownerId: 'u-daan',
    updatedAt: daysAgo(6),
    updatedById: 'u-daan',
    version: 12,
    credentialIds: ['cred-openai', 'cred-hubspot-vw', 'cred-slack-vw'],
    stats: { perDay: 180, failRate: 0.02, avgMs: 4_100, outageBuckets: 2, lastStatus: 'error', lastRunMinAgo: 2 },
  }),
  wf({
    id: 'vw-test-drive-booking',
    name: 'Test-drive booking',
    companyId: 'volkswagen',
    description: 'Finds free dealer slots in Google Calendar, responds to the website widget, books and confirms the test drive.',
    trigger: { kind: 'webhook', label: 'POST /vw/test-drive', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Booking widget', 0],
      ['cal', 'googleCalendar', 'Find free slots', 1],
      ['resp', 'respondWebhook', 'Return slots', 2],
      ['cal2', 'googleCalendar', 'Create booking', 3],
      ['mail', 'gmail', 'Confirmation', 4],
      ['exec', 'executeWorkflow', 'Sync to CRM', 5],
    ]),
    connections: C([
      ['t', 'cal'],
      ['cal', 'resp'],
      ['resp', 'cal2'],
      ['cal2', 'mail'],
      ['mail', 'exec'],
    ]),
    calls: ['vw-crm-sync'],
    tags: ['sales'],
    ownerId: 'u-sara',
    updatedAt: daysAgo(2),
    updatedById: 'u-finn',
    version: 19,
    credentialIds: ['cred-gcal-vw', 'cred-gmail-vw'],
    stats: { perDay: 64, failRate: 0.04, avgMs: 6_800 },
    issues: [
      issue(
        'inefficient',
        'Webhook answers after 6.8s on average',
        'The response waits for three sequential Google Calendar calls (one per dealer calendar). The widget shows a spinner and 4% of visitors drop off.',
        'Query the calendars in parallel with a Split Out → Merge pattern, or cache availability for 60s.',
        'p95 response 11.4s · 4% abandon',
        'cal',
        daysAgo(3),
        { minutesPerWeek: 38 },
      ),
    ],
  }),
  wf({
    id: 'vw-crm-sync',
    name: 'CRM ↔ dealer DMS sync',
    companyId: 'volkswagen',
    description: 'Polls the dealer management system every 5 minutes and upserts changed customers and vehicles into HubSpot.',
    trigger: { kind: 'schedule', label: 'Every 5 min', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Every 5 min', 0],
      ['db', 'mysql', 'Changed rows', 1],
      ['cmp', 'compare', 'Diff with CRM', 2],
      ['hs', 'hubspot', 'Upsert', 3],
      ['if', 'if', 'Anything changed?', 4],
      ['slack', 'slack', '#dealer-ops', 5],
    ]),
    connections: C([
      ['t', 'db'],
      ['db', 'cmp'],
      ['cmp', 'hs'],
      ['hs', 'if'],
      ['if', 'slack', 'true'],
    ]),
    tags: ['sync'],
    ownerId: 'u-sara',
    updatedAt: hoursAgo(20),
    updatedById: 'u-finn',
    version: 44,
    credentialIds: ['cred-mysql-vw', 'cred-hubspot-vw', 'cred-slack-vw'],
    stats: { perDay: 288, failRate: 0.0, avgMs: 3_300, outageBuckets: 2, lastStatus: 'error', lastRunMinAgo: 3 },
    issues: [
      issue(
        'inefficient',
        '97% of runs find nothing to sync',
        'Of 2,016 runs last week, 1,955 returned zero changed rows. Each still queries the DMS and HubSpot.',
        'Replace the 5-minute poll with a DMS database trigger (or a 30-minute schedule plus a webhook for urgent changes).',
        '≈ 1,950 empty runs / week',
        't',
        daysAgo(5),
        { runsPerWeek: 1950, minutesPerWeek: 107, euroPerMonth: 31 },
      ),
    ],
  }),
  wf({
    id: 'vw-service-reminders',
    name: 'Service reminders',
    companyId: 'volkswagen',
    description: 'Daily: finds vehicles due for service in 14 days and sends the owner an email and SMS reminder.',
    trigger: { kind: 'schedule', label: 'Daily · 08:00', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Daily 08:00', 0],
      ['pg', 'postgres', 'Vehicles', 1],
      ['flt', 'filter', 'Due in 14 days', 2],
      ['loop', 'loop', 'Each owner', 3],
      ['mail', 'gmail', 'Email reminder', 4, 0],
      ['sms', 'twilio', 'SMS reminder', 4, 1],
    ]),
    connections: C([
      ['t', 'pg'],
      ['pg', 'flt'],
      ['flt', 'loop'],
      ['loop', 'mail'],
      ['loop', 'sms'],
    ]),
    tags: ['after-sales'],
    ownerId: 'u-sara',
    updatedAt: daysAgo(15),
    updatedById: 'u-daan',
    version: 8,
    credentialIds: ['cred-postgres-vw', 'cred-gmail-vw', 'cred-twilio-vw'],
    stats: { perDay: 1, failRate: 0.0, avgMs: 71_000, lastRunMinAgo: 60 * 6.5 },
    issues: [
      issue(
        'minor',
        'Twilio node has no retry',
        'Occasional 429s from Twilio drop a reminder for that owner. 3 reminders were skipped last week.',
        'Turn on “Retry on fail” (3 tries, 2s wait) in the SMS node settings.',
        '3 missed reminders / week',
        'sms',
        daysAgo(1),
      ),
    ],
  }),
  wf({
    id: 'vw-parts-inventory-alerts',
    name: 'Parts inventory alerts',
    companyId: 'volkswagen',
    description: 'Hourly: reads stock levels from SAP, finds parts below threshold and alerts the parts desk.',
    trigger: { kind: 'schedule', label: 'Hourly', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Hourly', 0],
      ['sap', 'sap', 'Stock levels', 1],
      ['flt', 'filter', 'Below threshold', 2],
      ['agg', 'aggregate', 'Group by dealer', 3],
      ['slack', 'slack', '#parts-desk', 4, 0],
      ['sheet', 'sheets', 'Alert log', 4, 1],
    ]),
    connections: C([
      ['t', 'sap'],
      ['sap', 'flt'],
      ['flt', 'agg'],
      ['agg', 'slack'],
      ['agg', 'sheet'],
    ]),
    tags: ['after-sales', 'inventory'],
    ownerId: 'u-sara',
    updatedAt: daysAgo(8),
    updatedById: 'u-daan',
    version: 5,
    credentialIds: ['cred-slack-vw', 'cred-sheets'],
    stats: { perDay: 24, failRate: 0.0, avgMs: 9_400, lastRunMinAgo: 32 },
  }),
  wf({
    id: 'vw-nps-survey',
    name: 'Post-visit NPS survey',
    companyId: 'volkswagen',
    description: 'Draft: sends an NPS survey two days after a workshop visit and logs responses.',
    trigger: { kind: 'schedule', label: 'Daily · 10:00', nodeTypeId: 'schedule' },
    active: false,
    nodes: N([
      ['t', 'schedule', 'Daily 10:00', 0],
      ['pg', 'postgres', 'Visits', 1],
      ['flt', 'filter', '2 days ago', 2],
      ['sg', 'sendgrid', 'Survey email', 3],
      ['wait', 'wait', 'Await response', 4],
      ['sheet', 'sheets', 'Log score', 5],
    ]),
    connections: C([
      ['t', 'pg'],
      ['pg', 'flt'],
      ['flt', 'sg'],
      ['sg', 'wait'],
      ['wait', 'sheet'],
    ]),
    tags: ['after-sales', 'draft'],
    ownerId: 'u-lotte',
    updatedAt: daysAgo(3),
    updatedById: 'u-daan',
    version: 2,
    credentialIds: ['cred-postgres-vw', 'cred-sendgrid-tr', 'cred-sheets'],
    stats: { perDay: 1, failRate: 0, avgMs: 2_000 },
  }),
];

/* ------------------------------------------------------------------ */
/* Transmissies.nl                                                     */
/* ------------------------------------------------------------------ */

const transmissies: Workflow[] = [
  wf({
    id: 'tr-order-processing',
    name: 'Webshop order processing',
    companyId: 'transmissies',
    description: 'A paid WooCommerce order becomes a sales order in Exact Online, triggers the stock sync and confirms to the customer.',
    trigger: { kind: 'webhook', label: 'WooCommerce: order.created', nodeTypeId: 'woocommerceTrigger' },
    nodes: N([
      ['t', 'woocommerceTrigger', 'Order created', 0],
      ['if', 'if', 'Paid?', 1],
      ['exact', 'exact', 'Sales order', 2],
      ['exec', 'executeWorkflow', 'Sync stock', 3],
      ['mail', 'gmail', 'Order confirmation', 4, 0],
      ['slack', 'slack', '#orders', 4, 1],
    ]),
    connections: C([
      ['t', 'if'],
      ['if', 'exact', 'true'],
      ['exact', 'exec'],
      ['exec', 'mail'],
      ['exec', 'slack'],
    ]),
    calls: ['tr-stock-sync'],
    tags: ['orders'],
    ownerId: 'u-milan',
    updatedAt: daysAgo(1),
    updatedById: 'u-milan',
    version: 23,
    credentialIds: ['cred-woo', 'cred-exact', 'cred-gmail-tr', 'cred-slack-vir'],
    stats: { perDay: 142, failRate: 0.005, avgMs: 3_600 },
  }),
  wf({
    id: 'tr-stock-sync',
    name: 'Stock sync (ERP → shop)',
    companyId: 'transmissies',
    description: 'Pulls stock levels from Exact Online, diffs against the shop and updates WooCommerce products.',
    trigger: { kind: 'schedule', label: 'Every 15 min · and on order', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Every 15 min', 0, 0],
      ['t2', 'executeWorkflowTrigger', 'When called', 0, 1],
      ['exact', 'exact', 'Stock levels', 1],
      ['code', 'code', 'Diff SKUs', 2],
      ['loop', 'loop', 'Each SKU', 3],
      ['woo', 'woocommerce', 'Update product', 4],
      ['sheet', 'sheets', 'Sync log', 5],
    ]),
    connections: C([
      ['t', 'exact'],
      ['t2', 'exact'],
      ['exact', 'code'],
      ['code', 'loop'],
      ['loop', 'woo'],
      ['woo', 'sheet'],
    ]),
    tags: ['sync', 'inventory'],
    ownerId: 'u-milan',
    updatedAt: hoursAgo(9),
    updatedById: 'u-finn',
    version: 37,
    credentialIds: ['cred-exact', 'cred-woo', 'cred-sheets'],
    stats: { perDay: 110, failRate: 0.01, avgMs: 2_460_000, lastStatus: 'running', lastRunMinAgo: 1 },
    issues: [
      issue(
        'inefficient',
        '2,400 SKUs updated one request at a time',
        'The loop issues one WooCommerce API call per SKU. A full run takes 41 minutes and overlaps with the next scheduled run.',
        'Use the WooCommerce batch endpoint (100 products per call) via HTTP Request, and only send SKUs whose stock actually changed.',
        '41 min per run · overlaps schedule',
        'loop',
        daysAgo(4),
        { minutesPerWeek: 2_630, euroPerMonth: 54 },
      ),
    ],
  }),
  wf({
    id: 'tr-quote-requests',
    name: 'Quote requests (gearbox finder)',
    companyId: 'transmissies',
    description: 'A visitor describes their car and problem; the model classifies it, Airtable finds matching gearboxes and sales gets a quote draft.',
    trigger: { kind: 'webhook', label: 'POST /quote', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Quote form', 0],
      ['set', 'set', 'Clean input', 1],
      ['ai', 'openai', 'Classify vehicle', 2],
      ['air', 'airtable', 'Match parts', 3],
      ['exec', 'executeWorkflow', 'Enrich company', 4],
      ['if', 'if', 'Match found?', 5],
      ['mail', 'gmail', 'Send quote', 6, 0],
      ['tg', 'telegram', 'Sales: manual quote', 6, 1],
    ]),
    connections: C([
      ['t', 'set'],
      ['set', 'ai'],
      ['ai', 'air'],
      ['air', 'exec'],
      ['exec', 'if'],
      ['if', 'mail', 'true'],
      ['if', 'tg', 'false'],
    ]),
    calls: ['vir-lead-enrich'],
    tags: ['sales', 'ai', 'inbound'],
    ownerId: 'u-milan',
    updatedAt: hoursAgo(14),
    updatedById: 'u-milan',
    version: 16,
    credentialIds: ['cred-openai', 'cred-airtable', 'cred-gmail-tr', 'cred-telegram'],
    stats: { perDay: 55, failRate: 0.08, avgMs: 31_000, outageBuckets: 3, lastStatus: 'error', lastRunMinAgo: 6 },
    issues: [
      issue(
        'critical',
        'Webhook times out: response after 31s',
        'The form waits for the full chain (OpenAI + Airtable + enrichment) before responding. Cloudflare cuts the request at 30s, so the visitor sees an error although the quote is created.',
        'Add a Respond to Webhook node right after “Clean input” (immediate 202), then continue the chain asynchronously.',
        '38 failed requests today · 7 duplicate quotes',
        't',
        hoursAgo(14),
      ),
      issue(
        'minor',
        'OpenAI prompt has no language instruction',
        'Dutch inputs occasionally get English classifications, which breaks the Airtable match.',
        'Add “Answer in the language of the input” to the system prompt and pin the output schema.',
        '≈ 2% mismatches',
        'ai',
        daysAgo(6),
      ),
    ],
  }),
  wf({
    id: 'tr-review-requests',
    name: 'Review requests after delivery',
    companyId: 'transmissies',
    description: 'Three days after delivery, asks the customer for a Trustpilot review.',
    trigger: { kind: 'schedule', label: 'Daily · 09:00', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Daily 09:00', 0],
      ['exact', 'exact', 'Delivered orders', 1],
      ['flt', 'filter', 'Not yet asked', 2],
      ['wait', 'wait', 'Wait 3 days', 3],
      ['sg', 'sendgrid', 'Review invite', 4],
    ]),
    connections: C([
      ['t', 'exact'],
      ['exact', 'flt'],
      ['flt', 'wait'],
      ['wait', 'sg'],
    ]),
    tags: ['marketing'],
    ownerId: 'u-sara',
    updatedAt: daysAgo(30),
    updatedById: 'u-daan',
    version: 4,
    credentialIds: ['cred-exact', 'cred-sendgrid-tr'],
    stats: { perDay: 1, failRate: 0, avgMs: 5_000, lastRunMinAgo: 60 * 5.5 },
    issues: [
      issue(
        'minor',
        '340 executions parked in a Wait node',
        'Each daily run keeps executions waiting for 3 days. That is fine functionally, but it inflates the execution list and memory use.',
        'Store “ask on” dates in a Data Table and let the daily run pick up whatever is due instead of waiting inside the execution.',
        '340 waiting executions',
        'wait',
        daysAgo(2),
      ),
    ],
  }),
  wf({
    id: 'tr-shipping-notifications',
    name: 'Shipping notifications',
    companyId: 'transmissies',
    description: 'PostNL tracking events are turned into WhatsApp and email updates and reflected in the shop order status.',
    trigger: { kind: 'webhook', label: 'PostNL: tracking event', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Tracking event', 0],
      ['sw', 'switch', 'Event type', 1],
      ['wa', 'whatsapp', 'WhatsApp update', 2, 0],
      ['mail', 'gmail', 'Email update', 2, 1],
      ['woo', 'woocommerce', 'Set order status', 3],
    ]),
    connections: C([
      ['t', 'sw'],
      ['sw', 'wa', 'shipped'],
      ['sw', 'mail', 'delivered'],
      ['wa', 'woo'],
      ['mail', 'woo'],
    ]),
    tags: ['orders', 'notifications'],
    ownerId: 'u-milan',
    updatedAt: daysAgo(7),
    updatedById: 'u-milan',
    version: 10,
    credentialIds: ['cred-postnl', 'cred-whatsapp', 'cred-gmail-tr', 'cred-woo'],
    stats: { perDay: 260, failRate: 0.003, avgMs: 1_400 },
  }),
  wf({
    id: 'tr-abandoned-cart',
    name: 'Abandoned cart recovery',
    companyId: 'transmissies',
    description: 'Hourly: finds carts abandoned for 2+ hours, writes a personalized nudge and sends it.',
    trigger: { kind: 'schedule', label: 'Hourly', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Hourly', 0],
      ['woo', 'woocommerce', 'Abandoned carts', 1],
      ['flt', 'filter', '> 2h, has email', 2],
      ['ai', 'openai', 'Personalize', 3],
      ['sg', 'sendgrid', 'Nudge email', 4],
    ]),
    connections: C([
      ['t', 'woo'],
      ['woo', 'flt'],
      ['flt', 'ai'],
      ['ai', 'sg'],
    ]),
    tags: ['marketing', 'ai'],
    ownerId: 'u-milan',
    updatedAt: daysAgo(11),
    updatedById: 'u-milan',
    version: 6,
    credentialIds: ['cred-woo', 'cred-openai', 'cred-sendgrid-tr'],
    stats: { perDay: 24, failRate: 0.01, avgMs: 12_000 },
  }),
];

/* ------------------------------------------------------------------ */
/* Hoasted                                                             */
/* ------------------------------------------------------------------ */

const hoasted: Workflow[] = [
  wf({
    id: 'ho-uptime-incidents',
    name: 'Uptime incidents → status page',
    companyId: 'hoasted',
    description: 'Monitor alerts open or resolve incidents on the status page and notify the on-call channel.',
    trigger: { kind: 'webhook', label: 'POST /monitor/alert', nodeTypeId: 'webhook' },
    nodes: N([
      ['t', 'webhook', 'Monitor alert', 0],
      ['sw', 'switch', 'Alert state', 1],
      ['sp', 'statuspage', 'Open incident', 2, 0],
      ['sp2', 'statuspage', 'Resolve incident', 2, 1],
      ['slack', 'slack', '#on-call', 3],
      ['tg', 'telegram', 'On-call phone', 4],
    ]),
    connections: C([
      ['t', 'sw'],
      ['sw', 'sp', 'down'],
      ['sw', 'sp2', 'up'],
      ['sp', 'slack'],
      ['sp2', 'slack'],
      ['slack', 'tg'],
    ]),
    tags: ['ops'],
    ownerId: 'u-tom',
    updatedAt: daysAgo(5),
    updatedById: 'u-daan',
    version: 9,
    credentialIds: ['cred-statuspage', 'cred-slack-ho', 'cred-telegram'],
    stats: { perDay: 9, failRate: 0, avgMs: 1_100 },
  }),
  wf({
    id: 'ho-ssl-expiry',
    name: 'SSL expiry checker',
    companyId: 'hoasted',
    description: 'Daily: checks the certificate of every hosted domain and warns customers 14 days before expiry.',
    trigger: { kind: 'schedule', label: 'Daily · 03:00', nodeTypeId: 'schedule' },
    nodes: N([
      ['t', 'schedule', 'Daily 03:00', 0],
      ['pg', 'postgres', 'Hosted domains', 1],
      ['loop', 'loop', 'Each domain', 2],
      ['http', 'http', 'Check certificate', 3],
      ['if', 'if', '< 14 days?', 4],
      ['mail', 'gmail', 'Warn customer', 5],
    ]),
    connections: C([
      ['t', 'pg'],
      ['pg', 'loop'],
      ['loop', 'http'],
      ['http', 'if'],
      ['if', 'mail', 'true'],
    ]),
    tags: ['ops', 'security'],
    ownerId: 'u-tom',
    updatedAt: daysAgo(18),
    updatedById: 'u-tom',
    version: 5,
    credentialIds: ['cred-postgres-ho', 'cred-gmail-ho'],
    stats: { perDay: 1, failRate: 0.0, avgMs: 2_520_000, lastRunMinAgo: 60 * 11.5 },
    issues: [
      issue(
        'inefficient',
        '1,900 sequential HTTPS checks take 42 minutes',
        'Domains are checked one by one inside the loop. The run regularly collides with the 04:00 backup window.',
        'Set the HTTP Request node to batch mode (50 items, 0ms interval) and drop the Loop node, or split the domain list over 4 parallel sub-workflows.',
        '42 min nightly · backup contention',
        'loop',
        daysAgo(2),
        { minutesPerWeek: 266 },
      ),
    ],
  }),
  wf({
    id: 'ho-support-triage',
    name: 'Support ticket triage (AI)',
    companyId: 'hoasted',
    description: 'New support emails are classified by an agent, turned into Notion tickets and routed by priority.',
    trigger: { kind: 'app', label: 'Gmail: support@hoasted.com', nodeTypeId: 'gmailTrigger' },
    nodes: N([
      ['t', 'gmailTrigger', 'New support email', 0],
      ['agent', 'agent', 'Triage agent', 1],
      ['sw', 'switch', 'Priority', 2],
      ['notion', 'notion', 'Create ticket', 3],
      ['slack', 'slack', '#support-urgent', 4, 0],
      ['mail', 'gmail', 'Acknowledge', 4, 1],
    ]),
    connections: C([
      ['t', 'agent'],
      ['agent', 'sw'],
      ['sw', 'notion'],
      ['notion', 'slack', 'P1'],
      ['notion', 'mail'],
    ]),
    tags: ['support', 'ai'],
    ownerId: 'u-tom',
    updatedAt: hoursAgo(31),
    updatedById: 'u-daan',
    version: 13,
    credentialIds: ['cred-gmail-ho', 'cred-openai', 'cred-notion', 'cred-slack-ho'],
    stats: { perDay: 70, failRate: 0.02, avgMs: 14_000 },
    issues: [
      issue(
        'minor',
        'Agent has no max iterations',
        'One ticket last week looped 23 tool calls before finishing, costing 11× a normal run.',
        'Set “Max iterations” to 6 on the Triage agent and add a fallback to “P2 · manual review”.',
        '1 runaway run / week',
        'agent',
        daysAgo(3),
      ),
    ],
  }),
  wf({
    id: 'ho-invoice-dunning',
    name: 'Invoice dunning',
    companyId: 'hoasted',
    description: 'Overdue invoices get a friendly reminder, then a firmer one by SMS after a week.',
    trigger: { kind: 'schedule', label: 'Daily · 09:30', nodeTypeId: 'schedule' },
    active: false,
    nodes: N([
      ['t', 'schedule', 'Daily 09:30', 0],
      ['mb', 'moneybird', 'Overdue invoices', 1],
      ['loop', 'loop', 'Each invoice', 2],
      ['mail', 'gmail', 'Reminder', 3],
      ['wait', 'wait', 'Wait 7 days', 4],
      ['if', 'if', 'Still unpaid?', 5],
      ['sms', 'twilio', 'SMS reminder', 6],
    ]),
    connections: C([
      ['t', 'mb'],
      ['mb', 'loop'],
      ['loop', 'mail'],
      ['mail', 'wait'],
      ['wait', 'if'],
      ['if', 'sms', 'true'],
    ]),
    tags: ['finance', 'draft'],
    ownerId: 'u-tom',
    updatedAt: daysAgo(2),
    updatedById: 'u-eva',
    version: 3,
    credentialIds: ['cred-moneybird-ho', 'cred-gmail-ho'],
    stats: { perDay: 1, failRate: 0, avgMs: 4_000 },
  }),
];

export const WORKFLOWS: Workflow[] = [...viralistic, ...volkswagen, ...transmissies, ...hoasted];

export const workflowById = (id: string): Workflow | undefined => WORKFLOWS.find((w) => w.id === id);
export const workflowsForCompany = (companyId: string): Workflow[] => WORKFLOWS.filter((w) => w.companyId === companyId);
export const ALL_ISSUES: Issue[] = WORKFLOWS.flatMap((w) => w.issues);

/** Workflows that call the given one. */
export const callersOf = (workflowId: string): Workflow[] => WORKFLOWS.filter((w) => w.calls.includes(workflowId));

export { NOW };
