import type { Commit, Fork, ForkStatus, MergeRecord, NodeSwap, Product, WfConnection, WfNode } from './types';
import { PRODUCTS, productById } from './products';
import { nodeType } from './nodeTypes';
import { NOW, daysAgo, hoursAgo } from '../lib/format';

/**
 * Products are versioned like code: every product is a path in the
 * viralistic/products repository with a commit history, and people fork a
 * product to make a variant: the same flow with another tool in one node
 * (HubSpot swapped for SAP, Slack for Telegram, Gmail for SendGrid).
 * A fork can be forked again, opened as a pull request and merged upstream.
 * Demo data: nothing here talks to GitHub.
 */

/* ------------------------------------------------------------------ */
/* Swappable tools. A node can be swapped for any tool in a group it     */
/* belongs to; groups overlap on purpose (Sheets is storage and a CRM). */
/* ------------------------------------------------------------------ */
export interface SwapGroup {
  id: string;
  label: string;
  types: string[];
}
export const SWAP_GROUPS: SwapGroup[] = [
  { id: 'crm', label: 'CRM', types: ['hubspot', 'sap', 'exact', 'notion', 'airtable', 'sheets'] },
  { id: 'messaging', label: 'Messaging', types: ['slack', 'telegram', 'whatsapp', 'twilio'] },
  { id: 'mail', label: 'Mail', types: ['gmail', 'sendgrid'] },
  { id: 'bookkeeping', label: 'Bookkeeping', types: ['exact', 'moneybird', 'sap'] },
  { id: 'storage', label: 'Storage', types: ['sheets', 'airtable', 'notion', 'postgres', 'mysql'] },
  { id: 'ai', label: 'AI', types: ['openai', 'agent'] },
  { id: 'publishing', label: 'Publishing', types: ['linkedin', 'wordpress', 'telegram'] },
  { id: 'commerce', label: 'Commerce', types: ['shopify', 'woocommerce', 'exact'] },
];

/** Tools a node of this type can be swapped for (empty when the node is not swappable). */
export function swapAlternatives(type: string): string[] {
  const out: string[] = [];
  for (const g of SWAP_GROUPS) {
    if (!g.types.includes(type)) continue;
    for (const t of g.types) if (t !== type && !out.includes(t)) out.push(t);
  }
  return out;
}
/** The group a node type is shown under in the fork dialog. */
export function swapGroupOf(type: string): SwapGroup | undefined {
  return SWAP_GROUPS.find((g) => g.types.includes(type));
}
export const isSwappable = (type: string): boolean => swapAlternatives(type).length > 0;

/* ------------------------------------------------------------------ */
/* Seed forks                                                           */
/* ------------------------------------------------------------------ */
const swap = (nodeId: string, nodeName: string, from: string, to: string, rename?: string): NodeSwap => (rename ? { nodeId, nodeName, from, to, rename } : { nodeId, nodeName, from, to });

type ForkSpec = Omit<Fork, 'slug'> & { slug?: string };
const fork = (f: ForkSpec): Fork => ({ ...f, slug: f.slug ?? f.id.replace(/^f-/, '') });

export const FORKS: Fork[] = [
  /* ---- Lead intake: the most forked product ---- */
  fork({
    id: 'f-lead-sap',
    productId: 'lead-intake',
    name: 'Lead intake · SAP CRM variant',
    description: 'The dealer network keeps its customers in SAP CRM, not HubSpot. Same intake, but the contact is created in SAP and the dealer code is mapped from the postcode.',
    authorId: 'u-koen',
    companyId: 'volkswagen',
    createdAt: daysAgo(41),
    updatedAt: daysAgo(6),
    swaps: [swap('hs', 'Create contact', 'hubspot', 'sap', 'Create SAP contact')],
    commitsAhead: 3,
    commitsBehind: 2,
    status: 'diverged',
    stars: 5,
    usedByCompanyIds: ['volkswagen'],
  }),
  fork({
    id: 'f-lead-telegram',
    productId: 'lead-intake',
    name: 'Lead intake · Telegram alerts',
    description: 'Sales at Transmissies.nl lives in a Telegram group. Hot leads are posted there instead of Slack, with the quote amount in the message.',
    authorId: 'u-milan',
    companyId: 'transmissies',
    createdAt: daysAgo(27),
    updatedAt: daysAgo(9),
    swaps: [swap('slack', '#sales', 'slack', 'telegram', 'Sales group')],
    commitsAhead: 2,
    commitsBehind: 1,
    status: 'diverged',
    stars: 2,
    usedByCompanyIds: ['transmissies'],
  }),
  fork({
    id: 'f-lead-sendgrid',
    productId: 'lead-intake',
    name: 'Lead intake · SendGrid auto-reply',
    description: 'Sends the auto-reply through SendGrid templates instead of the Gmail account, so the reply is branded per project and bounces are tracked.',
    authorId: 'u-finn',
    companyId: 'viralistic',
    createdAt: daysAgo(8),
    updatedAt: hoursAgo(20),
    swaps: [swap('mail', 'Auto-reply', 'gmail', 'sendgrid')],
    commitsAhead: 1,
    commitsBehind: 0,
    status: 'pr-open',
    prNumber: 48,
    stars: 3,
    usedByCompanyIds: [],
  }),
  fork({
    id: 'f-lead-sap-wait',
    productId: 'lead-intake',
    parentForkId: 'f-lead-sap',
    name: 'SAP CRM variant · sync wait',
    description: 'SAP replicates new contacts to the dealer DMS with a short delay. Waiting 90 seconds before the budget check avoids the empty-record errors seen in staging.',
    authorId: 'u-jonas',
    companyId: 'n8n',
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(26),
    swaps: [],
    addedNodes: [{ id: 'wait', type: 'wait', name: 'Wait for SAP sync', col: 3, row: 0 }],
    addedConnections: [
      { from: 'hs', to: 'wait' },
      { from: 'wait', to: 'if' },
    ],
    removedConnections: [{ from: 'hs', to: 'if' }],
    commitsAhead: 2,
    commitsBehind: 0,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),

  /* ---- Invoice checker ---- */
  fork({
    id: 'f-checker-moneybird',
    productId: 'invoice-checker',
    name: 'Invoice checker · Moneybird variant',
    description: 'Matches and books in Moneybird for projects without Exact Online. Merged upstream as a bookkeeping setting, so both systems now ship in the product.',
    authorId: 'u-daan',
    companyId: 'viralistic',
    createdAt: daysAgo(26),
    updatedAt: daysAgo(5),
    swaps: [swap('exact', 'Match order', 'exact', 'moneybird'), swap('book', 'Book invoice', 'exact', 'moneybird')],
    commitsAhead: 2,
    commitsBehind: 0,
    status: 'merged',
    prNumber: 29,
    stars: 4,
    usedByCompanyIds: ['viralistic', 'hoasted'],
  }),
  fork({
    id: 'f-checker-whatsapp',
    productId: 'invoice-checker',
    name: 'Invoice checker · WhatsApp review',
    description: 'Finance at Hoasted reviews unmatched invoices in a WhatsApp group rather than Slack.',
    authorId: 'u-tom',
    companyId: 'hoasted',
    createdAt: daysAgo(11),
    updatedAt: daysAgo(3),
    swaps: [swap('slack', '#finance review', 'slack', 'whatsapp', 'Finance WhatsApp')],
    commitsAhead: 1,
    commitsBehind: 1,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: ['hoasted'],
  }),

  /* ---- Invoice dunning ---- */
  fork({
    id: 'f-dunning-whatsapp',
    productId: 'invoice-dunning',
    name: 'Invoice dunning · WhatsApp reminders',
    description: 'Finance prefers WhatsApp Business over SMS for the second reminder: cheaper per message, and read receipts.',
    authorId: 'u-koen',
    companyId: 'volkswagen',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
    swaps: [swap('sms', 'SMS reminder', 'twilio', 'whatsapp', 'WhatsApp reminder')],
    commitsAhead: 2,
    commitsBehind: 0,
    status: 'diverged',
    stars: 2,
    usedByCompanyIds: [],
  }),

  /* ---- Invoice generator ---- */
  fork({
    id: 'f-invgen-exact',
    productId: 'invoice-generator',
    name: 'Invoice generator · Exact Online',
    description: 'Creates the monthly invoices in Exact Online, which is where Transmissies.nl keeps its ledger.',
    authorId: 'u-milan',
    companyId: 'transmissies',
    createdAt: daysAgo(52),
    updatedAt: daysAgo(16),
    swaps: [swap('mb', 'Create invoice', 'moneybird', 'exact')],
    commitsAhead: 3,
    commitsBehind: 1,
    status: 'diverged',
    stars: 3,
    usedByCompanyIds: ['transmissies'],
  }),
  fork({
    id: 'f-invgen-postgres',
    productId: 'invoice-generator',
    name: 'Invoice generator · Postgres ledger',
    description: 'Writes the ledger line to the same Postgres the hours come from instead of a sheet. Merged in v7 as a setting.',
    authorId: 'u-mirza',
    companyId: 'viralistic',
    createdAt: daysAgo(70),
    updatedAt: daysAgo(44),
    swaps: [swap('sheet', 'Log to ledger', 'sheets', 'postgres')],
    commitsAhead: 1,
    commitsBehind: 0,
    status: 'merged',
    prNumber: 17,
    stars: 2,
    usedByCompanyIds: ['viralistic'],
  }),

  /* ---- Review requests ---- */
  fork({
    id: 'f-review-whatsapp',
    productId: 'review-requests',
    name: 'Review requests · WhatsApp invite',
    description: 'Asks for the review over WhatsApp Business instead of email. Open rates doubled in the first week.',
    authorId: 'u-milan',
    companyId: 'transmissies',
    createdAt: daysAgo(19),
    updatedAt: daysAgo(7),
    swaps: [swap('sg', 'Review invite', 'sendgrid', 'whatsapp')],
    commitsAhead: 2,
    commitsBehind: 0,
    status: 'diverged',
    stars: 2,
    usedByCompanyIds: ['transmissies'],
  }),
  fork({
    id: 'f-review-shopify',
    productId: 'review-requests',
    name: 'Review requests · Shopify orders',
    description: 'Reads delivered orders from Shopify. Built for a webshop pitch that did not go ahead; kept for reference.',
    authorId: 'u-finn',
    companyId: 'viralistic',
    createdAt: daysAgo(95),
    updatedAt: daysAgo(61),
    swaps: [swap('exact', 'Delivered orders', 'exact', 'shopify')],
    commitsAhead: 1,
    commitsBehind: 2,
    status: 'archived',
    stars: 0,
    usedByCompanyIds: [],
  }),

  /* ---- Social scheduler ---- */
  fork({
    id: 'f-social-wordpress',
    productId: 'social-scheduler',
    name: 'Social scheduler · WordPress blog',
    description: 'Publishes long-form posts from the same calendar to the WordPress blog. Telegram keeps announcing them.',
    authorId: 'u-marrallisa',
    companyId: 'viralistic',
    createdAt: daysAgo(33),
    updatedAt: daysAgo(12),
    swaps: [swap('li', 'Post to LinkedIn', 'linkedin', 'wordpress', 'Publish post')],
    commitsAhead: 2,
    commitsBehind: 1,
    status: 'diverged',
    stars: 3,
    usedByCompanyIds: ['viralistic'],
  }),

  /* ---- Employee onboarding ---- */
  fork({
    id: 'f-onboarding-airtable',
    productId: 'employee-onboarding',
    name: 'Employee onboarding · Airtable',
    description: 'For HR teams that keep their people directory in Airtable instead of Notion.',
    authorId: 'u-mirza',
    companyId: 'viralistic',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
    swaps: [swap('notion', 'Create profile', 'notion', 'airtable')],
    commitsAhead: 1,
    commitsBehind: 0,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),

  /* ---- Leave requests ---- */
  fork({
    id: 'f-leave-telegram',
    productId: 'leave-requests',
    name: 'Leave requests · Telegram approval',
    description: 'Managers approve from a Telegram bot with inline buttons. Same decision log.',
    authorId: 'u-daan',
    companyId: 'viralistic',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
    swaps: [swap('slack', 'Ask manager', 'slack', 'telegram')],
    commitsAhead: 1,
    commitsBehind: 0,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),

  /* ---- Error alerts ---- */
  fork({
    id: 'f-alerts-sms',
    productId: 'error-alerts',
    name: 'Error alerts · SMS on-call',
    description: 'The on-call engineer does not read Slack at 03:00. Breaking errors go out as SMS; the Slack post stays in the product as the default.',
    authorId: 'u-mirza',
    companyId: 'viralistic',
    createdAt: daysAgo(23),
    updatedAt: daysAgo(2),
    swaps: [swap('slack', '#n8n-alerts', 'slack', 'twilio', 'SMS on-call')],
    commitsAhead: 2,
    commitsBehind: 0,
    status: 'pr-open',
    prNumber: 51,
    stars: 6,
    usedByCompanyIds: ['hoasted'],
  }),

  /* ---- Certificate watch ---- */
  fork({
    id: 'f-ssl-mysql',
    productId: 'ssl-expiry',
    name: 'Certificate watch · MySQL inventory',
    description: 'A prospect keeps the domain inventory in MySQL. Same nightly check, different source.',
    authorId: 'u-jonas',
    companyId: 'n8n',
    createdAt: daysAgo(13),
    updatedAt: daysAgo(8),
    swaps: [swap('pg', 'Hosted domains', 'postgres', 'mysql')],
    commitsAhead: 1,
    commitsBehind: 0,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),

  /* ---- Support triage ---- */
  fork({
    id: 'f-triage-telegram',
    productId: 'support-triage',
    name: 'Support triage · Telegram escalation',
    description: 'P1 tickets are escalated to the after-sales Telegram group instead of a Slack channel.',
    authorId: 'u-koen',
    companyId: 'volkswagen',
    createdAt: daysAgo(16),
    updatedAt: daysAgo(3),
    swaps: [swap('slack', '#support-urgent', 'slack', 'telegram', 'Urgent group')],
    commitsAhead: 2,
    commitsBehind: 1,
    status: 'diverged',
    stars: 2,
    usedByCompanyIds: ['volkswagen'],
  }),
  fork({
    id: 'f-triage-openai',
    productId: 'support-triage',
    name: 'Support triage · plain classifier',
    description: 'Replaces the tool-using agent with a single OpenAI classification call: a tenth of the tokens and no runaway runs, at the cost of slightly less accurate priorities.',
    authorId: 'u-finn',
    companyId: 'viralistic',
    createdAt: daysAgo(21),
    updatedAt: daysAgo(13),
    swaps: [swap('agent', 'Triage agent', 'agent', 'openai', 'Classify email')],
    commitsAhead: 1,
    commitsBehind: 3,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),

  /* ---- Weekly client report ---- */
  fork({
    id: 'f-report-postgres',
    productId: 'client-report',
    name: 'Weekly client report · Postgres KPIs',
    description: 'Reads the KPIs from the reporting database instead of the client sheet.',
    authorId: 'u-daan',
    companyId: 'viralistic',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(2),
    swaps: [swap('sheet', 'Client KPIs', 'sheets', 'postgres')],
    commitsAhead: 1,
    commitsBehind: 1,
    status: 'diverged',
    stars: 1,
    usedByCompanyIds: [],
  }),
];

/* ------------------------------------------------------------------ */
/* Commit history per product. The last tagged commit is the current    */
/* version; untagged commits are work between releases.                 */
/* ------------------------------------------------------------------ */

/** Deterministic 7-character "sha" so server and client render the same history. */
export function shortSha(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h.toString(16) + 'a1b2c3d').slice(0, 7);
}

type CommitRow = [at: string, authorId: string, message: string, version?: number, forkId?: string];
const history = (productId: string, rows: CommitRow[]): Commit[] =>
  rows.map(([at, authorId, message, version, forkId], i) => ({
    sha: shortSha(`${productId}#${i}:${message}`),
    productId,
    message,
    authorId,
    at,
    ...(version ? { version } : {}),
    ...(forkId ? { forkId } : {}),
  }));

export const COMMITS: Commit[] = [
  ...history('lead-intake', [
    [daysAgo(420), 'u-marrallisa', 'Initial lead intake: webhook, normalize, HubSpot contact', 1],
    [daysAgo(400), 'u-marrallisa', 'Branch on budget and notify #sales', 2],
    [daysAgo(372), 'u-daan', 'Auto-reply to leads below the budget threshold', 3],
    [daysAgo(340), 'u-daan', 'Normalize phone numbers to E.164'],
    [daysAgo(330), 'u-daan', 'Map UTM parameters to HubSpot properties', 4],
    [daysAgo(290), 'u-mirza', 'Dedupe on email before creating the contact', 5],
    [daysAgo(250), 'u-daan', 'Call the enrichment service for hot leads', 6],
    [daysAgo(210), 'u-marrallisa', 'Budget threshold as a product setting', 7],
    [daysAgo(170), 'u-daan', 'Retry HubSpot on 429 with backoff', 8],
    [daysAgo(140), 'u-mirza', 'Trim and lowercase the email before dedupe'],
    [daysAgo(120), 'u-daan', 'Slack message: add company and budget fields', 9],
    [daysAgo(90), 'u-daan', 'Honour the consent checkbox of the form', 10],
    [daysAgo(62), 'u-mirza', 'Drop the legacy field mapping in Normalize fields', 11],
    [daysAgo(44), 'u-daan', 'Merge #37: postcode to region mapping, requested by Volkswagen', 12],
    [daysAgo(30), 'u-daan', 'Respond to the webhook within 2s, enrich asynchronously'],
    [daysAgo(16), 'u-mirza', 'Error output of Create contact routed to the alert product', 13],
    [daysAgo(2), 'u-daan', 'Auto-reply template in Dutch and English'],
    [hoursAgo(5), 'u-daan', 'Budget check reads the currency from the form', 14],
  ]),
  ...history('support-triage', [
    [daysAgo(200), 'u-daan', 'Initial support triage: Gmail trigger, classify, Notion ticket', 1],
    [daysAgo(188), 'u-daan', 'Acknowledge the sender', 2],
    [daysAgo(176), 'u-tom', 'Priority switch: P1 goes to #support-urgent', 3],
    [daysAgo(160), 'u-daan', 'Replace the OpenAI call with a tool-using agent', 4],
    [daysAgo(150), 'u-daan', 'Agent tool: look up the customer plan'],
    [daysAgo(141), 'u-mirza', 'Agent tool: recent incidents from the status page', 5],
    [daysAgo(120), 'u-daan', 'Ignore auto-replies and bounces', 6],
    [daysAgo(104), 'u-daan', 'Ticket template with the classified category', 7],
    [daysAgo(88), 'u-tom', 'P1 keyword overrides for outages', 8],
    [daysAgo(70), 'u-daan', 'Thread replies onto the existing ticket', 9],
    [daysAgo(52), 'u-mirza', 'Language detection, acknowledge in kind', 10],
    [daysAgo(36), 'u-daan', 'Attachments stored on the ticket', 11],
    [daysAgo(20), 'u-daan', 'Agent prompt: calmer tone for billing questions'],
    [daysAgo(9), 'u-daan', 'Priority switch: P3 for feature requests', 12],
    [hoursAgo(31), 'u-daan', 'Triage agent on gpt-4.1-mini', 13],
  ]),
  ...history('client-report', [
    [daysAgo(330), 'u-marrallisa', 'Initial weekly report: KPIs from Sheets, render, send', 1],
    [daysAgo(310), 'u-daan', 'Week-over-week deltas', 2],
    [daysAgo(280), 'u-daan', 'Loop per client, one PDF each', 3],
    [daysAgo(250), 'u-marrallisa', 'Summary in #account-mgmt', 4],
    [daysAgo(220), 'u-daan', 'Render through the shared PDF service', 5],
    [daysAgo(190), 'u-mirza', 'Skip clients without KPI targets', 6],
    [daysAgo(160), 'u-daan', 'Chart of the last 12 weeks'],
    [daysAgo(130), 'u-marrallisa', 'Report language per client', 7],
    [daysAgo(95), 'u-daan', 'Include token spend per workflow', 8],
    [daysAgo(60), 'u-daan', 'Retry the render on timeout', 9],
    [daysAgo(25), 'u-mirza', 'Executive summary paragraph from the model', 10],
    [daysAgo(4), 'u-marrallisa', 'ROI line: hours saved against monthly cost', 11],
  ]),
  ...history('invoice-generator', [
    [daysAgo(380), 'u-marrallisa', 'Initial invoice generator: approved hours to Moneybird invoices', 1],
    [daysAgo(360), 'u-marrallisa', 'Email the PDF to the client contact', 2],
    [daysAgo(330), 'u-daan', 'Aggregate per client before the loop', 3],
    [daysAgo(300), 'u-daan', 'Log every invoice to the ledger sheet', 4],
    [daysAgo(260), 'u-mirza', 'Skip clients with zero approved hours', 5],
    [daysAgo(220), 'u-daan', 'Invoice lines per project instead of one total', 6],
    [daysAgo(170), 'u-mirza', 'Rounding: minutes to quarter hours'],
    [daysAgo(44), 'u-mirza', 'Merge #17: ledger line to Postgres as a setting', 7, 'f-invgen-postgres'],
    [daysAgo(30), 'u-marrallisa', 'VAT reverse charge for EU clients', 8],
    [daysAgo(20), 'u-daan', 'Payment term from the client record'],
    [daysAgo(12), 'u-marrallisa', 'Send from the finance mailbox', 9],
  ]),
  ...history('social-scheduler', [
    [daysAgo(150), 'u-marrallisa', 'Initial social scheduler: Airtable calendar to LinkedIn', 1],
    [daysAgo(140), 'u-marrallisa', 'Post to the Telegram channel too', 2],
    [daysAgo(125), 'u-daan', 'Only run when posts are due', 3],
    [daysAgo(100), 'u-marrallisa', 'Image attachments from the calendar row', 4],
    [daysAgo(80), 'u-daan', 'Mark the row as posted', 5],
    [daysAgo(60), 'u-mirza', 'Schedule in Europe/Amsterdam', 6],
    [daysAgo(40), 'u-marrallisa', 'Hashtag set per campaign'],
    [daysAgo(21), 'u-marrallisa', 'Skip weekends unless the row says otherwise', 7],
  ]),
  ...history('ssl-expiry', [
    [daysAgo(120), 'u-tom', 'Initial certificate watch: nightly check, warn at 14 days', 1],
    [daysAgo(110), 'u-tom', 'Domains from the hosting database', 2],
    [daysAgo(90), 'u-daan', 'Loop per domain with error handling', 3],
    [daysAgo(60), 'u-tom', 'Second warning at 3 days', 4],
    [daysAgo(40), 'u-daan', 'Timeout per check: 10 seconds'],
    [daysAgo(18), 'u-tom', 'Warn the account owner, not the technical contact', 5],
  ]),
  ...history('review-requests', [
    [daysAgo(110), 'u-daan', 'Initial review requests: delivered orders, wait 3 days, invite', 1],
    [daysAgo(95), 'u-daan', 'Filter out orders already asked', 2],
    [daysAgo(70), 'u-milan', 'Invite template in Dutch', 3],
    [daysAgo(50), 'u-daan', 'SendGrid template per product category'],
    [daysAgo(30), 'u-daan', 'Skip B2B orders', 4],
  ]),
  ...history('invoice-checker', [
    [daysAgo(38), 'u-daan', 'Initial invoice checker: read PDF, extract fields, match in Exact', 1],
    [daysAgo(31), 'u-daan', 'Route non-matching invoices to #finance review'],
    [daysAgo(24), 'u-mirza', 'Order reference fallback when the PO is missing', 2],
    [daysAgo(5), 'u-daan', 'Merge #29: bookkeeping system as a setting (Moneybird variant)', undefined, 'f-checker-moneybird'],
    [daysAgo(4), 'u-mirza', 'Tighten the PO amount tolerance to 0.5%', 3],
  ]),
  ...history('invoice-dunning', [
    [daysAgo(25), 'u-daan', 'Initial dunning: reminder, wait a week, SMS', 1],
    [daysAgo(12), 'u-daan', 'Skip invoices under dispute', 2],
    [daysAgo(2), 'u-eva', 'Reminder wording approved by finance', 3],
  ]),
  ...history('employee-onboarding', [
    [daysAgo(24), 'u-mirza', 'Initial onboarding: Notion profile, welcome mail, Slack invite', 1],
    [daysAgo(15), 'u-daan', 'First-week meetings in Google Calendar'],
    [daysAgo(9), 'u-mirza', 'Welcome email with the name of the buddy', 2],
  ]),
  ...history('leave-requests', [
    [daysAgo(20), 'u-mirza', 'Initial leave requests: approve or decline from Slack, log, inform'],
    [daysAgo(15), 'u-mirza', 'Decline reason required', 1],
  ]),
  ...history('error-alerts', [
    [daysAgo(200), 'u-daan', 'Initial error alerts: format and post to Slack', 1],
    [daysAgo(150), 'u-daan', 'Include the failing node and the last input item', 2],
    [daysAgo(90), 'u-mirza', 'Group repeated errors within 10 minutes'],
    [daysAgo(40), 'u-daan', 'Link to the execution', 3],
  ]),
];

/* ------------------------------------------------------------------ */
/* Lookups                                                              */
/* ------------------------------------------------------------------ */
const byTimeDesc = <T extends { at: string }>(a: T, b: T) => b.at.localeCompare(a.at);

/** Seeded commits of a product, newest first. */
export const commitsOf = (productId: string): Commit[] => COMMITS.filter((c) => c.productId === productId).sort(byTimeDesc);

/** Commits plus the merges the person made in the demo, newest first. */
export function commitsWithMerges(product: Product, merges: MergeRecord[], forks: Fork[]): Commit[] {
  const extra: Commit[] = merges
    .filter((m) => m.productId === product.id)
    .map((m) => {
      const f = forks.find((x) => x.id === m.forkId);
      return { sha: m.sha, productId: product.id, message: `Merge #${m.prNumber}: ${f?.name ?? 'fork'}`, authorId: m.byId, at: m.at, version: m.version, forkId: m.forkId };
    });
  return [...commitsOf(product.id), ...extra].sort(byTimeDesc);
}

/** Current version: the product's version plus one per merge made in the demo. */
export const productVersion = (product: Product, merges: MergeRecord[]): number => product.version + merges.filter((m) => m.productId === product.id).length;

/** Seeded and user-created forks of a product, with any status changes applied, newest activity first. */
export function forksOf(productId: string, userForks: Fork[] = [], overrides: Record<string, Partial<Fork>> = {}): Fork[] {
  return [...FORKS, ...userForks]
    .filter((f) => f.productId === productId)
    .map((f) => (overrides[f.id] ? { ...f, ...overrides[f.id] } : f))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export const forkById = (id: string, all: Fork[] = FORKS): Fork | undefined => all.find((f) => f.id === id);

/** Parent forks from the top of the lineage down to the direct parent. */
export function forkAncestors(fork: Fork, all: Fork[]): Fork[] {
  const out: Fork[] = [];
  let cur = fork.parentForkId ? forkById(fork.parentForkId, all) : undefined;
  let guard = 0;
  while (cur && guard++ < 20) {
    out.unshift(cur);
    cur = cur.parentForkId ? forkById(cur.parentForkId, all) : undefined;
  }
  return out;
}
export const forkChildren = (forkId: string, all: Fork[]): Fork[] => all.filter((f) => f.parentForkId === forkId);

/** Next pull request number across every product (the repository is shared). */
export function nextPrNumber(all: Fork[], merges: MergeRecord[]): number {
  let max = 51;
  for (const f of all) if (f.prNumber && f.prNumber > max) max = f.prNumber;
  for (const m of merges) if (m.prNumber > max) max = m.prNumber;
  return max + 1;
}

/** Slug for a user-created fork. */
export function forkSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Human line for a swap: "HubSpot to SAP". */
export const swapLabel = (s: NodeSwap): string => `${nodeType(s.from).label} to ${nodeType(s.to).label}`;

export const FORK_STATUS_SHORT: Record<ForkStatus, string> = { diverged: 'Diverged', 'pr-open': 'PR open', merged: 'Merged', archived: 'Archived' };

/* ------------------------------------------------------------------ */
/* The flow of a fork: the parent flow with the swaps applied.          */
/* ------------------------------------------------------------------ */
export type ChangeKind = 'swapped' | 'added';
export interface ForkFlow {
  nodes: WfNode[];
  connections: WfConnection[];
  /** this fork's own changes, by node id */
  changed: Record<string, ChangeKind>;
  /** changes inherited from parent forks, by node id */
  inherited: Record<string, ChangeKind>;
  /** nodes this fork removed from its parent, for the diff list */
  removed: WfNode[];
  /** the flow this fork started from */
  base: { nodes: WfNode[]; connections: WfConnection[] };
}

const sameConn = (a: WfConnection, b: WfConnection) => a.from === b.from && a.to === b.to && (a.label ?? '') === (b.label ?? '');

export function forkFlow(fork: Fork, all: Fork[] = FORKS): ForkFlow {
  const parent = fork.parentForkId ? forkById(fork.parentForkId, all) : undefined;
  let baseNodes: WfNode[];
  let baseConns: WfConnection[];
  let inherited: Record<string, ChangeKind> = {};
  if (parent && parent.id !== fork.id) {
    const pf = forkFlow(parent, all);
    baseNodes = pf.nodes;
    baseConns = pf.connections;
    inherited = { ...pf.inherited, ...pf.changed };
  } else {
    const product = productById(fork.productId) ?? PRODUCTS[0]!;
    baseNodes = product.nodes;
    baseConns = product.connections;
  }

  const changed: Record<string, ChangeKind> = {};
  let nodes: WfNode[] = baseNodes.map((n) => {
    const s = fork.swaps.find((x) => x.nodeId === n.id);
    if (!s) return n;
    changed[n.id] = 'swapped';
    return { ...n, type: s.to, name: s.rename ?? n.name };
  });
  const removedIds = new Set(fork.removedNodeIds ?? []);
  const removed = nodes.filter((n) => removedIds.has(n.id));
  nodes = nodes.filter((n) => !removedIds.has(n.id));
  let connections = baseConns.filter((c) => !removedIds.has(c.from) && !removedIds.has(c.to));
  for (const rc of fork.removedConnections ?? []) connections = connections.filter((c) => !(c.from === rc.from && c.to === rc.to));

  for (const a of fork.addedNodes ?? []) {
    const occupied = nodes.some((n) => n.col === a.col && n.row === a.row);
    if (occupied) nodes = nodes.map((n) => (n.col >= a.col ? { ...n, col: n.col + 1 } : n));
    nodes.push(a);
    changed[a.id] = 'added';
  }
  for (const c of fork.addedConnections ?? []) if (!connections.some((x) => sameConn(x, c))) connections.push(c);

  return { nodes, connections, changed, inherited, removed, base: { nodes: baseNodes, connections: baseConns } };
}

/** Every change a fork carries, own and inherited, as swap rows for a "was / now" list. */
export interface DiffRow {
  kind: 'swapped' | 'added' | 'removed';
  nodeId: string;
  /** node name after the change */
  name: string;
  /** node name before the change (differs when the fork renamed it) */
  fromName?: string;
  from?: string;
  to?: string;
  inherited: boolean;
}
export function forkDiff(fork: Fork, all: Fork[] = FORKS): DiffRow[] {
  const rows: DiffRow[] = [];
  const chain = [...forkAncestors(fork, all), fork];
  chain.forEach((f, i) => {
    const inherited = i < chain.length - 1;
    for (const s of f.swaps) rows.push({ kind: 'swapped', nodeId: s.nodeId, name: s.rename ?? s.nodeName, fromName: s.nodeName, from: s.from, to: s.to, inherited });
    for (const n of f.addedNodes ?? []) rows.push({ kind: 'added', nodeId: n.id, name: n.name, to: n.type, inherited });
    if (f.removedNodeIds?.length) {
      const flow = forkFlow(f, all);
      for (const n of flow.removed) rows.push({ kind: 'removed', nodeId: n.id, name: n.name, fromName: n.name, from: n.type, inherited });
    }
  });
  return rows;
}

/** When a fork was created, in demo time. */
export const nowIso = (): string => NOW.toISOString();
