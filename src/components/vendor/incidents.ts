import { SEVERITY_RANK, type Company, type Issue, type N8nPlan, type Severity, type SupportTier, type Workflow } from '../../data/types';
import { COMPANIES, companyById } from '../../data/companies';
import { WORKFLOWS } from '../../data/workflows';
import { UPDATES, impactedWorkflows, type N8nUpdate } from '../../data/changelog';
import { PARTNER } from '../../data/orgs';
import type { Importance } from '../../data/planner';
import type { Signal } from '../../stores/signals';

/**
 * What n8n calls an incident: a breaking or wasteful finding on an instance
 * it is involved in. Minor tips stay with the partner.
 */
export interface Incident {
  issue: Issue;
  wf: Workflow;
  company: Company;
}
export type IncidentState = 'open' | 'signalled' | 'acknowledged';

export function incidentsFor(companies: Company[], wfs: Workflow[]): Incident[] {
  const ids = new Set(companies.map((c) => c.id));
  const out: Incident[] = [];
  for (const wf of wfs) {
    if (!ids.has(wf.companyId)) continue;
    const company = COMPANIES.find((c) => c.id === wf.companyId);
    if (!company) continue;
    for (const issue of wf.issues) if (issue.severity !== 'minor') out.push({ issue, wf, company });
  }
  // worst first, then newest
  return out.sort((a, b) => SEVERITY_RANK[b.issue.severity] - SEVERITY_RANK[a.issue.severity] || b.issue.detectedAt.localeCompare(a.issue.detectedAt));
}

export function incidentState(issueId: string, signals: Signal[]): IncidentState {
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i]!;
    if (s.issueId === issueId) return s.status === 'acknowledged' ? 'acknowledged' : 'signalled';
  }
  return 'open';
}

export const STATE_LABEL: Record<IncidentState, string> = { open: 'Open', signalled: 'Signalled', acknowledged: 'Acknowledged' };
export const PLAN_LABEL: Record<N8nPlan, string> = { community: 'Community', pro: 'Pro', enterprise: 'Enterprise', partner: 'Partner plan' };
export const TIER_LABEL: Record<SupportTier, string> = { standard: 'Standard', priority: 'Priority', enterprise: 'Enterprise' };

export function defaultImportance(severity: Severity): Importance {
  return severity === 'critical' ? 'high' : severity === 'inefficient' ? 'medium' : 'low';
}

/** The partner that runs or supports an instance (the partner's own instance counts as its own). */
export function partnerOf(company: Company): Company | undefined {
  const id = company.partnerId ?? (company.id === PARTNER.id ? company.id : null);
  return id ? companyById(id) : undefined;
}

/** Prefilled signal text, written the way n8n monitoring would phrase it. */
export function signalNote(inc: Incident): string {
  const NOTES: Record<string, string> = {
    'vw-dealer-lead-routing-i1': 'n8n monitoring saw 164 failed runs on Dealer lead routing since 06:12: HubSpot returned 401. Please reconnect the credential and replay the failed executions.',
    'tr-quote-requests-i1': 'n8n monitoring saw 38 webhook timeouts on Quote requests today: the response arrives after 31s and Cloudflare cuts at 30s, so 7 quotes were created twice. Please respond to the webhook right away and continue the chain afterwards.',
    'vw-crm-sync-i1': 'n8n monitoring saw 1,955 of 2,016 runs of the CRM to dealer DMS sync return zero rows last week. A database trigger or a 30-minute schedule would remove most of these executions.',
    'vw-test-drive-booking-i1': 'n8n monitoring saw the Test-drive booking webhook answer after 6.8s on average (p95 11.4s): three sequential calendar lookups. Querying the calendars in parallel brings this under 3s.',
    'tr-stock-sync-i1': 'n8n monitoring saw Stock sync runs take 41 minutes and overlap with the next schedule: one WooCommerce call per SKU. The batch endpoint takes 100 products per call.',
    'vir-lead-enrich-i1': 'n8n monitoring saw the same domain enriched up to 11 times a day on Lead enrichment: 61% of the paid lookups are repeats. A 24-hour cache per domain would remove them.',
    'ho-ssl-expiry-i1': 'n8n monitoring saw the nightly SSL expiry check run for 42 minutes and collide with the 04:00 backup window: 1,900 sequential HTTPS checks. Batching 50 at a time brings it under 5 minutes.',
  };
  return NOTES[inc.issue.id] ?? `n8n monitoring flagged ${inc.wf.name} at ${inc.company.shortName}: ${inc.issue.title.toLowerCase()}. ${inc.issue.impact}. ${inc.issue.suggestion}`;
}

/* ------------------------------------------------------------------ */
/* Versions: which release an instance runs versus the latest.          */
/* ------------------------------------------------------------------ */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
export const LATEST_VERSION: string = UPDATES.reduce((best, u) => (cmpVersion(u.version, best) > 0 ? u.version : best), '0.0.0');
/** Every release in the changelog, oldest first. */
export const RELEASE_VERSIONS: string[] = Array.from(new Set(UPDATES.map((u) => u.version))).sort(cmpVersion);

export function pendingUpdates(company: Company): N8nUpdate[] {
  return UPDATES.filter((u) => cmpVersion(u.version, company.n8nVersion) > 0);
}
export function isBehind(company: Company): boolean {
  return cmpVersion(company.n8nVersion, LATEST_VERSION) < 0;
}
/** Workflows of this instance that the pending releases touch. */
export function impactedForCompany(company: Company): Workflow[] {
  const ids = new Set<string>();
  for (const u of pendingUpdates(company)) for (const w of impactedWorkflows(u)) if (w.companyId === company.id) ids.add(w.id);
  return WORKFLOWS.filter((w) => ids.has(w.id));
}
