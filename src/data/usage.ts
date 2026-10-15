import type { ModelDef, ModelId, WorkflowUsageProfile } from './types';
import { VERTICALS } from './verticals';

/**
 * Tokens, time and money. Every workflow has a usage profile: the model it
 * calls (if any), tokens per run and the minutes of manual work one run
 * replaces (per item, so a 2-minute saving on 5,000 leads is 167 hours). lib/value.ts turns these into time saved, money saved, ROI and
 * the token counter on the client's dashboard.
 */
export const MODELS: ModelDef[] = [
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', pricePerM: 4.5, quality: 86, releasedAt: '2024-05-13' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', vendor: 'OpenAI', pricePerM: 0.35, quality: 74, releasedAt: '2024-07-18' },
  { id: 'gpt-4.1', label: 'GPT-4.1', vendor: 'OpenAI', pricePerM: 3.6, quality: 90, releasedAt: '2025-04-14' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', vendor: 'OpenAI', pricePerM: 0.7, quality: 82, releasedAt: '2025-04-14' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', vendor: 'Anthropic', pricePerM: 5.4, quality: 92, releasedAt: '2025-09-29' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', vendor: 'Anthropic', pricePerM: 1.8, quality: 84, releasedAt: '2025-10-15' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'Google', pricePerM: 0.55, quality: 80, releasedAt: '2025-06-17' },
];
export const modelById = (id: ModelId): ModelDef => MODELS.find((m) => m.id === id)!;

const P = (workflowId: string, minutesSavedPerRun: number, model?: ModelId, tokensPerRun = 0): WorkflowUsageProfile => ({ workflowId, minutesSavedPerRun, model, tokensPerRun, verticalId: VERTICALS.find((v) => v.workflowIds.includes(workflowId))?.id });

export const USAGE_PROFILES: WorkflowUsageProfile[] = [
  /* Viralistic */
  P('vir-lead-intake', 3, 'gpt-4o-mini', 1800),
  P('vir-lead-enrich', 1, 'gpt-4o', 2600),
  P('vir-invoicing', 20),
  P('vir-content-pipeline', 20, 'gpt-4o', 7800),
  P('vir-client-reporting', 45, 'claude-sonnet-4-5', 5200),
  P('vir-report-render', 5),
  P('vir-slack-alerts', 0.5),
  P('vir-social-scheduler', 12),
  /* Volkswagen */
  P('vw-dealer-lead-routing', 2, 'gpt-4o-mini', 1400),
  P('vw-lead-scoring', 0.5, 'gpt-4o', 2200),
  P('vw-test-drive-booking', 6),
  P('vw-crm-sync', 0.25),
  P('vw-service-reminders', 4),
  P('vw-parts-inventory-alerts', 7),
  P('vw-nps-survey', 3, 'gpt-4o-mini', 900),
  /* Transmissies.nl */
  P('tr-order-processing', 1.5),
  P('tr-stock-sync', 0.25),
  P('tr-quote-requests', 4, 'claude-sonnet-4-5', 6400),
  P('tr-review-requests', 2),
  P('tr-shipping-notifications', 0.4),
  P('tr-abandoned-cart', 1, 'gpt-4o-mini', 1100),
  /* Hoasted */
  P('ho-uptime-incidents', 12),
  P('ho-ssl-expiry', 10),
  P('ho-support-triage', 2.5, 'claude-haiku-4-5', 2300),
  P('ho-invoice-dunning', 6),
];
export const usageProfile = (workflowId: string): WorkflowUsageProfile => USAGE_PROFILES.find((p) => p.workflowId === workflowId) ?? { workflowId, minutesSavedPerRun: 2, tokensPerRun: 0 };
