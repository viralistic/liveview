import type { Issue, Workflow } from './types';
import { WORKFLOWS } from './workflows';
import { projectFor } from './projects';

/**
 * Smart fix: the model turns a finding into a concrete change set. The
 * project's technical owner reviews it before anything touches n8n.
 */
export interface FixChange {
  nodeId?: string;
  nodeName: string;
  change: string; // "Retry on fail: off → on (3 tries, 2s)"
}
export interface FixProposal {
  id: string;
  issueId: string;
  workflowId: string;
  summary: string;
  changes: FixChange[];
  risk: 'low' | 'medium';
  testPlan: string;
  reviewerId: string;
  requestedById: string;
  createdAt: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'applied';
}

const node = (wf: Workflow, id?: string) => wf.nodes.find((n) => n.id === id)?.name ?? 'the trigger';

/** Deterministic "AI" proposal per finding. */
export function proposeFix(issue: Issue, requestedById: string): Omit<FixProposal, 'id' | 'createdAt' | 'status'> {
  const wf = WORKFLOWS.find((w) => w.id === issue.workflowId)!;
  const reviewerId = projectFor(wf.companyId)?.technicalOwnerId ?? 'u-mirza';
  const base = { issueId: issue.id, workflowId: wf.id, reviewerId, requestedById };
  const n = node(wf, issue.nodeId);
  switch (issue.id) {
    case 'vw-dealer-lead-routing-i1':
      return { ...base, summary: 'Re-authenticate the HubSpot credential and replay the 164 failed executions.', risk: 'low', testPlan: 'Run 3 failed executions in the staging container, confirm deals are created, then replay the rest.', changes: [{ nodeName: 'HubSpot · Volkswagen (credential)', change: 'OAuth token: expired → refreshed' }, { nodeId: 'hsN', nodeName: 'Deal · North', change: 'Retry on fail: off → on (3 tries, 2s)' }, { nodeId: 'hsS', nodeName: 'Deal · South', change: 'Retry on fail: off → on (3 tries, 2s)' }] };
    case 'tr-quote-requests-i1':
      return { ...base, summary: 'Answer the webhook right away and continue the chain afterwards.', risk: 'low', testPlan: 'Submit 5 test quotes; response under 300 ms; quotes still created once.', changes: [{ nodeName: 'Respond to Webhook (new)', change: 'Insert after “Clean input”: respond 202 with the request id' }, { nodeId: 't', nodeName: 'Quote form', change: 'Respond: “When last node finishes” → “Using Respond to Webhook node”' }] };
    case 'vw-crm-sync-i1':
      return { ...base, summary: 'Replace the 5-minute poll with a database trigger and a 30-minute safety schedule.', risk: 'medium', testPlan: 'Run both triggers side by side for a day in staging and compare upserts.', changes: [{ nodeId: 't', nodeName: 'Every 5 min', change: 'Interval: 5 min → 30 min' }, { nodeName: 'MySQL Trigger (new)', change: 'Fire on row change in customers, vehicles' }] };
    case 'tr-stock-sync-i1':
      return { ...base, summary: 'Send stock updates in batches of 100 instead of one call per SKU.', risk: 'medium', testPlan: 'Run with 300 SKUs in staging, compare stock levels before and after.', changes: [{ nodeId: 'loop', nodeName: 'Each SKU', change: 'Batch size: 1 → 100' }, { nodeId: 'woo', nodeName: 'Update product', change: 'Node: WooCommerce → HTTP Request (POST /products/batch)' }] };
    case 'vw-test-drive-booking-i1':
      return { ...base, summary: 'Look up the three dealer calendars in parallel.', risk: 'low', testPlan: 'Book 10 test slots in staging; p95 under 2.5s.', changes: [{ nodeId: 'cal', nodeName: 'Find free slots', change: 'Execute once per calendar → Split Out → 3 parallel lookups → Merge' }] };
    case 'vir-lead-enrich-i1':
      return { ...base, summary: 'Cache enrichment results per domain for 24 hours.', risk: 'low', testPlan: 'Enrich the same domain twice in staging; second call must hit the cache.', changes: [{ nodeName: 'Data Table lookup (new)', change: 'Before “Company lookup”: get by domain, TTL 24h' }, { nodeName: 'If cached (new)', change: 'Skip both HTTP lookups when a fresh row exists' }] };
    case 'ho-ssl-expiry-i1':
      return { ...base, summary: 'Check certificates in batches of 50 instead of one by one.', risk: 'low', testPlan: 'Run on 200 domains in staging; runtime under 5 minutes.', changes: [{ nodeId: 'http', nodeName: 'Check certificate', change: 'Batching: off → 50 items, 0 ms interval' }, { nodeId: 'loop', nodeName: 'Each domain', change: 'Remove (no longer needed)' }] };
    default:
      return { ...base, summary: issue.suggestion, risk: issue.severity === 'critical' ? 'medium' : 'low', testPlan: 'Run the workflow once in the staging container and compare the output with the last successful execution.', changes: [{ nodeId: issue.nodeId, nodeName: n, change: issue.suggestion }] };
  }
}
