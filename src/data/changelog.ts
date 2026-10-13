import { WORKFLOWS } from './workflows';
import { daysAgo } from '../lib/format';

/**
 * n8n updates and what they mean for the workflows we run. The impact
 * analysis maps each update to the node types it touches, then to the
 * workflows that use those node types.
 */
export type UpdateKind = 'breaking' | 'node' | 'feature' | 'security' | 'fix';
export type Effort = 'auto' | 'review' | 'manual';

export interface N8nUpdate {
  id: string;
  version: string;
  date: string;
  kind: UpdateKind;
  title: string;
  summary: string;
  affectedNodeTypes: string[];
  /** how a migration would look for an affected workflow */
  effort: Effort;
  migration: string;
  aiNote: string;
}

export const UPDATES: N8nUpdate[] = [
  {
    id: 'u-2-8',
    version: '2.8.0',
    date: daysAgo(1),
    kind: 'node',
    title: 'HubSpot node v3: new deal pipelines API',
    summary: 'The HubSpot node moves to the v3 deals API. Pipeline and stage ids are now looked up by name; the old numeric ids keep working until 2.10.',
    affectedNodeTypes: ['hubspot'],
    effort: 'auto',
    migration: 'Re-map pipeline ids to names on every HubSpot deal node. No behaviour change.',
    aiNote: 'Simple, mechanical change. Safe to apply in staging and compare one execution per workflow.',
  },
  {
    id: 'u-2-7-2',
    version: '2.7.2',
    date: daysAgo(6),
    kind: 'security',
    title: 'Webhook node: signature verification on by default',
    summary: 'Incoming webhooks reject unsigned requests unless “Allow unsigned” is enabled. Existing workflows keep the old setting after upgrade, but new ones do not.',
    affectedNodeTypes: ['webhook'],
    effort: 'review',
    migration: 'Enable signatures with the sender (website, PostNL, monitoring) or keep “Allow unsigned” explicitly.',
    aiNote: 'Needs a person: the senders have to start signing requests. Keep “Allow unsigned” on for now and plan the switch per sender.',
  },
  {
    id: 'u-2-7',
    version: '2.7.0',
    date: daysAgo(12),
    kind: 'breaking',
    title: 'Wait node: resume URLs change format',
    summary: 'The resume webhook URL of the Wait node now contains the execution id. Anything that stored the old URL format (emails sent before the upgrade) will not resume.',
    affectedNodeTypes: ['wait'],
    effort: 'manual',
    migration: 'Executions waiting at the moment of the upgrade must be resumed by hand or restarted.',
    aiNote: 'Breaking for executions in flight. Review requests has 340 waiting executions; upgrade after a daily run, then re-send the pending invites.',
  },
  {
    id: 'u-2-6-1',
    version: '2.6.1',
    date: daysAgo(20),
    kind: 'node',
    title: 'OpenAI node: default model updated',
    summary: 'The OpenAI node defaults to the newest model. Workflows that did not pin a model will switch on the next execution.',
    affectedNodeTypes: ['openai', 'agent'],
    effort: 'auto',
    migration: 'Pin the current model explicitly so output stays identical, then test the new one per workflow.',
    aiNote: 'Mechanical: pin the model. Output quality should be re-checked for the quote classifier and lead scoring.',
  },
  {
    id: 'u-2-6',
    version: '2.6.0',
    date: daysAgo(27),
    kind: 'feature',
    title: 'HTTP Request node: batching settings moved to node settings',
    summary: 'Batch size and interval are now node settings instead of options. Old options are migrated automatically.',
    affectedNodeTypes: ['http'],
    effort: 'auto',
    migration: 'Nothing to change; n8n migrates the options. Good moment to turn batching on for sequential loops.',
    aiNote: 'No action needed. Certificate watch and lead enrichment would benefit from batching while we are there.',
  },
  {
    id: 'u-2-5-3',
    version: '2.5.3',
    date: daysAgo(40),
    kind: 'fix',
    title: 'Execute Workflow node: sub-workflow errors propagate correctly',
    summary: 'A failing sub-workflow now fails the calling execution instead of being swallowed when “Wait for sub-workflow” is off.',
    affectedNodeTypes: ['executeWorkflow'],
    effort: 'review',
    migration: 'Callers that relied on swallowed errors need an error branch.',
    aiNote: 'Three callers use Execute Workflow. Lead intake already has error handling; check Dealer lead routing and Weekly client reporting.',
  },
];

export function impactedWorkflows(update: N8nUpdate) {
  return WORKFLOWS.filter((w) => w.nodes.some((n) => update.affectedNodeTypes.includes(n.type)));
}

export const KIND_LABEL: Record<UpdateKind, string> = { breaking: 'Breaking', node: 'Node update', feature: 'Feature', security: 'Security', fix: 'Fix' };
export const EFFORT_LABEL: Record<Effort, string> = { auto: 'Auto-implement', review: 'Needs review', manual: 'Manual' };
