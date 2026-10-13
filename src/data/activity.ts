import type { Activity } from './types';
import { daysAgo, hoursAgo, minutesAgo } from '../lib/format';

export const ACTIVITY: Activity[] = [
  { id: 'a1', type: 'error', workflowId: 'vw-dealer-lead-routing', companyId: 'volkswagen', message: 'HubSpot returned 401 · credential expired', at: minutesAgo(2) },
  { id: 'a2', type: 'comment', userId: 'u-marrallisa', workflowId: 'vw-dealer-lead-routing', companyId: 'volkswagen', message: 'replied to Lotte on Dealer lead routing', at: minutesAgo(31) },
  { id: 'a3', type: 'comment', userId: 'u-lotte', workflowId: 'vw-dealer-lead-routing', companyId: 'volkswagen', message: 'commented on Dealer lead routing', at: minutesAgo(48) },
  { id: 'a4', type: 'edit', userId: 'u-daan', workflowId: 'vir-lead-intake', companyId: 'viralistic', message: 'published v14 of Website lead intake', at: hoursAgo(5) },
  { id: 'a5', type: 'run', workflowId: 'vir-client-reporting', companyId: 'viralistic', message: 'Weekly client reporting finished · 11 reports sent', at: hoursAgo(31) },
  { id: 'a6', type: 'edit', userId: 'u-finn', workflowId: 'tr-stock-sync', companyId: 'transmissies', message: 'edited Stock sync (ERP → shop)', at: hoursAgo(9) },
  { id: 'a7', type: 'error', workflowId: 'tr-quote-requests', companyId: 'transmissies', message: 'Webhook response timed out (31.2s)', at: hoursAgo(14) },
  { id: 'a8', type: 'access', userId: 'u-sara', companyId: 'transmissies', message: 'gave Finn Mulder edit access to Stock sync', at: daysAgo(14) },
  { id: 'a9', type: 'credential', userId: 'u-milan', companyId: 'transmissies', message: 'rotated WooCommerce API key', at: daysAgo(1) },
  { id: 'a10', type: 'activate', userId: 'u-daan', workflowId: 'ho-support-triage', companyId: 'hoasted', message: 'activated Support ticket triage (AI) v13', at: hoursAgo(31) },
  { id: 'a11', type: 'edit', userId: 'u-eva', workflowId: 'ho-invoice-dunning', companyId: 'hoasted', message: 'left a note on Invoice dunning', at: daysAgo(2) },
  { id: 'a12', type: 'access', userId: 'u-marrallisa', companyId: 'volkswagen', message: 'invited Lotte Jansen as commenter on Volkswagen', at: daysAgo(190) },
];
