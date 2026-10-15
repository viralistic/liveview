import type { Company, CompanySize, HostingRoute, N8nPlan, Sensitivity, SupportTier } from './types';

/**
 * Project configuration. Every project (client) has settings the partner and
 * the client agree on: how sensitive the information is, what may go out
 * without a review, when alerts are allowed, who may see what. Hyper-sensitive
 * locks the strict values. Defaults derive from the company profile.
 */
export interface ProjectSettings {
  /* profile */
  name: string;
  industry: string;
  size: CompanySize;
  employees: number;
  country: string;
  language: string;
  route: HostingRoute;
  plan: N8nPlan;
  supportTier: SupportTier;
  /* sensitivity and data */
  sensitivity: Sensitivity;
  dataResidency: 'eu' | 'any';
  piiMasking: boolean;
  logRetentionDays: 7 | 30 | 90;
  euModelsOnly: boolean;
  tokenBudgetEur: number; // per month, 0 = no cap
  /* sharing */
  allowShareLinks: boolean;
  allowExternalDevelopers: boolean;
  allowN8nAccess: boolean;
  /* approvals */
  reviewBeforeOutbound: boolean;
  approvalForGoLive: boolean;
  autoApplySimpleUpdates: boolean;
  smartFixAutoAccept: 'never' | 'minor' | 'all';
  /* alerts */
  alertHours: 'office' | 'always';
  alertSlack: boolean;
  alertEmail: boolean;
  alertSms: boolean;
  weeklyReport: boolean;
  /* culture */
  leaderboards: boolean;
  crossVerticalLeaderboard: boolean;
  /* context */
  notes: string;
}

export type SettingKey = keyof ProjectSettings;

/** Values hyper-sensitive projects are locked to. */
export const HYPER_LOCKS: Partial<ProjectSettings> = {
  dataResidency: 'eu',
  piiMasking: true,
  logRetentionDays: 7,
  euModelsOnly: true,
  allowShareLinks: false,
  allowExternalDevelopers: false,
  reviewBeforeOutbound: true,
  approvalForGoLive: true,
  smartFixAutoAccept: 'never',
};
/** Values a high-sensitivity project gets by default (still editable). */
export const HIGH_DEFAULTS: Partial<ProjectSettings> = {
  dataResidency: 'eu',
  piiMasking: true,
  logRetentionDays: 30,
  reviewBeforeOutbound: true,
  approvalForGoLive: true,
};

export const SENSITIVITY_HINT: Record<Sensitivity, string> = {
  standard: 'Business data. 90-day logs, share links allowed.',
  high: 'Personal data. PII masked, EU residency, review before outbound.',
  hyper: 'Medical, financial or legal data. Strictest values, locked.',
};

export function defaultSettings(c: Company): ProjectSettings {
  const base: ProjectSettings = {
    name: c.name,
    industry: c.industry,
    size: c.size,
    employees: c.employees,
    country: c.country,
    language: c.language,
    route: c.route,
    plan: c.plan,
    supportTier: c.supportTier,
    sensitivity: c.sensitivity,
    dataResidency: 'eu',
    piiMasking: false,
    logRetentionDays: 90,
    euModelsOnly: false,
    tokenBudgetEur: c.size === 'enterprise' ? 2500 : c.size === 'mkb+' ? 600 : 250,
    allowShareLinks: true,
    allowExternalDevelopers: true,
    allowN8nAccess: true,
    reviewBeforeOutbound: false,
    approvalForGoLive: c.size === 'enterprise',
    autoApplySimpleUpdates: c.size !== 'enterprise',
    smartFixAutoAccept: 'minor',
    alertHours: c.supportTier === 'enterprise' ? 'always' : 'office',
    alertSlack: true,
    alertEmail: true,
    alertSms: c.supportTier === 'enterprise',
    weeklyReport: true,
    leaderboards: true,
    crossVerticalLeaderboard: c.size === 'enterprise',
    notes: '',
  };
  return applySensitivity(base, c.sensitivity);
}

/** Apply a sensitivity level: high sets defaults, hyper locks. */
export function applySensitivity(s: ProjectSettings, level: Sensitivity): ProjectSettings {
  if (level === 'hyper') return { ...s, ...HIGH_DEFAULTS, ...HYPER_LOCKS, sensitivity: 'hyper' };
  if (level === 'high') return { ...s, ...HIGH_DEFAULTS, sensitivity: 'high' };
  return { ...s, sensitivity: 'standard' };
}
export function isLocked(s: ProjectSettings, key: SettingKey): boolean {
  return s.sensitivity === 'hyper' && key in HYPER_LOCKS;
}

/** A blank project for the onboarding wizard. */
export function blankSettings(): ProjectSettings {
  return {
    name: '',
    industry: '',
    size: 'mkb',
    employees: 25,
    country: 'NL',
    language: 'Dutch',
    route: 'partner',
    plan: 'pro',
    supportTier: 'standard',
    sensitivity: 'standard',
    dataResidency: 'eu',
    piiMasking: false,
    logRetentionDays: 90,
    euModelsOnly: false,
    tokenBudgetEur: 250,
    allowShareLinks: true,
    allowExternalDevelopers: true,
    allowN8nAccess: true,
    reviewBeforeOutbound: false,
    approvalForGoLive: false,
    autoApplySimpleUpdates: true,
    smartFixAutoAccept: 'minor',
    alertHours: 'office',
    alertSlack: true,
    alertEmail: true,
    alertSms: false,
    weeklyReport: true,
    leaderboards: true,
    crossVerticalLeaderboard: false,
    notes: '',
  };
}

/* ------------------------------------------------------------------ */
/* Auto-configure from pasted context (call notes, emails). A keyword  */
/* reading that stands in for the model in the demo.                   */
/* ------------------------------------------------------------------ */
export interface Detection {
  key: SettingKey | 'systems' | 'wants';
  label: string;
  value: string;
  evidence: string;
}
export interface AutoConfig {
  patch: Partial<ProjectSettings>;
  detections: Detection[];
  systems: string[];
  wants: string[];
}

const sizeFromEmployees = (n: number): CompanySize => (n >= 1000 ? 'enterprise' : n >= 100 ? 'mkb+' : n >= 10 ? 'mkb' : 'startup');
const snippet = (text: string, idx: number, len: number) => {
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
  const end = text.indexOf('.', idx + len);
  return text.slice(start, end === -1 ? Math.min(text.length, idx + len + 60) : end + 1).trim();
};

export function autoConfigure(text: string): AutoConfig {
  const t = text;
  const lower = t.toLowerCase();
  const patch: Partial<ProjectSettings> = {};
  const detections: Detection[] = [];
  const systems: string[] = [];
  const wants: string[] = [];
  const find = (re: RegExp) => {
    const m = re.exec(lower);
    return m ? { m, evidence: snippet(t, m.index, m[0].length) } : null;
  };

  // company name: "with <Name>" / "for <Name>" / first capitalised words before "is a"
  const nameM = /(?:call with|meeting with|notes from|intro(?:duction)? with|for|at)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/.exec(t);
  if (nameM) {
    patch.name = nameM[1]!.replace(/[.,]$/, '');
    detections.push({ key: 'name', label: 'Project name', value: patch.name, evidence: snippet(t, nameM.index, nameM[0].length) });
  }

  const emp = find(/(\d[\d.,]*)\s*(?:people|employees|medewerkers|fte|staff|colleagues)/);
  if (emp) {
    const n = Number(emp.m[1]!.replace(/[.,]/g, ''));
    if (n > 0) {
      patch.employees = n;
      patch.size = sizeFromEmployees(n);
      detections.push({ key: 'employees', label: 'People', value: String(n), evidence: emp.evidence });
      detections.push({ key: 'size', label: 'Size', value: patch.size, evidence: emp.evidence });
    }
  }
  const sizeWord = find(/\b(enterprise|corporate|multinational|listed company|beursgenoteerd)\b/);
  if (sizeWord && !patch.size) {
    patch.size = 'enterprise';
    detections.push({ key: 'size', label: 'Size', value: 'enterprise', evidence: sizeWord.evidence });
  }
  const mkbWord = find(/\b(mkb|sme|family business|familiebedrijf)\b/);
  if (mkbWord && !patch.size) {
    patch.size = 'mkb';
    detections.push({ key: 'size', label: 'Size', value: 'mkb', evidence: mkbWord.evidence });
  }
  const startupWord = find(/\b(startup|start-up|scale-up|scaleup)\b/);
  if (startupWord && !patch.size) {
    patch.size = 'startup';
    detections.push({ key: 'size', label: 'Size', value: 'startup', evidence: startupWord.evidence });
  }

  const selfHost = find(/\b(self-?host(?:ed|ing)?|own servers?|on-?prem(?:ise)?|local host|eigen servers?|in our datacenter|in their datacenter)\b/);
  if (selfHost) {
    patch.route = 'self-hosted';
    detections.push({ key: 'route', label: 'Route', value: 'Local host', evidence: selfHost.evidence });
  } else {
    const cloud = find(/\b(hosted by you|you host|managed (?:by )?(?:viralistic|the partner)|partner route|your cloud|no own servers)\b/);
    if (cloud) {
      patch.route = 'partner';
      detections.push({ key: 'route', label: 'Route', value: 'Partner route', evidence: cloud.evidence });
    }
  }

  const hyper = find(/\b(medical|patient|health(?:care)? data|bsn|bank(?:ing)? data|insurance|legal (?:files|cases)|salary|payroll|credit card|biometric)\b/);
  const high = find(/\b(gdpr|avg|privacy|personal data|customer data|pii|phone numbers|email addresses|crm data)\b/);
  if (hyper) {
    patch.sensitivity = 'hyper';
    detections.push({ key: 'sensitivity', label: 'Sensitivity', value: 'Hyper-sensitive', evidence: hyper.evidence });
  } else if (high) {
    patch.sensitivity = 'high';
    detections.push({ key: 'sensitivity', label: 'Sensitivity', value: 'High', evidence: high.evidence });
  }

  const review = find(/\b(no(?:thing)? (?:emails?|messages?) (?:may go out |goes out |sent )?without (?:a )?review|review before|approve (?:every|all|each) (?:email|message)|niets versturen zonder|human in the loop)\b/);
  if (review) {
    patch.reviewBeforeOutbound = true;
    detections.push({ key: 'reviewBeforeOutbound', label: 'Review before outbound', value: 'On', evidence: review.evidence });
  }
  const golive = find(/\b(sign-?off before go-?live|approval before (?:go-?live|production)|change advisory|cab\b)/);
  if (golive) {
    patch.approvalForGoLive = true;
    detections.push({ key: 'approvalForGoLive', label: 'Approval for go-live', value: 'On', evidence: golive.evidence });
  }
  const always = find(/\b(24\/7|around the clock|at night|weekends?|always on|outside office hours)\b/);
  if (always) {
    patch.alertHours = 'always';
    detections.push({ key: 'alertHours', label: 'Alerts', value: 'Always', evidence: always.evidence });
  }
  const budget = find(/budget (?:of )?(?:€|eur)?\s*([\d.,]+)\s*(?:k|euro|eur|€)?/);
  if (budget) {
    let n = Number(budget.m[1]!.replace(/[.,]/g, ''));
    if (/k\b/.test(budget.m[0])) n *= 1000;
    if (n > 0 && n < 100000) {
      patch.tokenBudgetEur = n;
      detections.push({ key: 'tokenBudgetEur', label: 'Token budget', value: `€ ${n} / month`, evidence: budget.evidence });
    }
  }
  const noExternal = find(/\b(no (?:external|freelance|remote) (?:developers?|devs?|people)|only (?:internal|own) (?:developers?|staff))\b/);
  if (noExternal) {
    patch.allowExternalDevelopers = false;
    detections.push({ key: 'allowExternalDevelopers', label: 'External developers', value: 'Not allowed', evidence: noExternal.evidence });
  }
  const noN8n = find(/\b(no (?:vendor|n8n) access|n8n may not see)\b/);
  if (noN8n) {
    patch.allowN8nAccess = false;
    detections.push({ key: 'allowN8nAccess', label: 'n8n access', value: 'Off', evidence: noN8n.evidence });
  }

  const langs: string[] = [];
  if (/\b(dutch|nederlands|in het nederlands)\b/.test(lower)) langs.push('Dutch');
  if (/\b(german|deutsch|duits)\b/.test(lower)) langs.push('German');
  if (/\b(english|engels)\b/.test(lower)) langs.push('English');
  if (/\b(french|frans)\b/.test(lower)) langs.push('French');
  if (langs.length) {
    patch.language = langs.join(', ');
    const lm = find(/\b(dutch|nederlands|german|deutsch|duits|english|engels|french|frans)\b/)!;
    detections.push({ key: 'language', label: 'Language', value: patch.language, evidence: lm.evidence });
  }

  const industries: [RegExp, string][] = [
    [/\b(automotive|dealers?|car brand|lease)\b/, 'Automotive'],
    [/\b(hosting|datacenter|data center|cloud provider|isp)\b/, 'Web hosting'],
    [/\b(webshop|e-?commerce|online store|shopify|woocommerce)\b/, 'E-commerce'],
    [/\b(accountan(?:t|cy)|bookkeeping|financial services|bank)\b/, 'Financial services'],
    [/\b(clinic|hospital|healthcare|zorg|ggz|physio)\b/, 'Healthcare'],
    [/\b(logistics|transport|warehouse|shipping company)\b/, 'Logistics'],
    [/\b(recruit(?:ment|er)|staffing|uitzend)\b/, 'Staffing'],
    [/\b(law firm|lawyers?|advocaten|notary)\b/, 'Legal'],
    [/\b(manufactur(?:er|ing)|factory|fabriek)\b/, 'Manufacturing'],
    [/\b(real estate|makelaar|property)\b/, 'Real estate'],
    [/\b(retail|stores?|winkels?)\b/, 'Retail'],
    [/\b(saas|software company|tech company)\b/, 'Software'],
    [/\b(municipalit(?:y|ies)|gemeente|government|overheid)\b/, 'Government'],
    [/\b(education|school|universit)\b/, 'Education'],
  ];
  for (const [re, label] of industries) {
    const m = find(re);
    if (m) {
      patch.industry = label;
      detections.push({ key: 'industry', label: 'Industry', value: label, evidence: m.evidence });
      break;
    }
  }
  const countries: [RegExp, string][] = [
    [/\b(netherlands|nederland|holland|amsterdam|rotterdam|utrecht|eindhoven|den haag|the hague|groningen|amersfoort)\b/, 'NL'],
    [/\b(germany|deutschland|berlin|munich|münchen|hamburg|düsseldorf)\b/, 'DE'],
    [/\b(belgium|belgië|brussels|antwerp|gent)\b/, 'BE'],
    [/\b(united kingdom|london|manchester)\b/, 'UK'],
    [/\b(france|paris|lyon)\b/, 'FR'],
  ];
  for (const [re, code] of countries) {
    const m = find(re);
    if (m) {
      patch.country = code;
      detections.push({ key: 'country', label: 'Country', value: code, evidence: m.evidence });
      break;
    }
  }

  const sys: [RegExp, string][] = [
    [/hubspot/, 'HubSpot'],
    [/salesforce/, 'Salesforce'],
    [/pipedrive/, 'Pipedrive'],
    [/exact(?: online)?/, 'Exact Online'],
    [/moneybird/, 'Moneybird'],
    [/\bsap\b/, 'SAP'],
    [/afas/, 'AFAS'],
    [/microsoft 365|outlook|sharepoint|teams\b/, 'Microsoft 365'],
    [/google workspace|gmail|google sheets/, 'Google Workspace'],
    [/slack/, 'Slack'],
    [/whatsapp/, 'WhatsApp'],
    [/telegram/, 'Telegram'],
    [/notion/, 'Notion'],
    [/shopify/, 'Shopify'],
    [/woocommerce/, 'WooCommerce'],
    [/zendesk|freshdesk|intercom/, 'Helpdesk'],
    [/stripe|mollie/, 'Payments'],
  ];
  for (const [re, label] of sys) if (re.test(lower) && !systems.includes(label)) systems.push(label);
  if (systems.length) detections.push({ key: 'systems', label: 'Systems', value: systems.join(', '), evidence: 'Mentioned in the notes' });

  for (const sentence of t.split(/(?<=[.!?])\s+|\n+/)) {
    const sl = sentence.toLowerCase();
    if (/\b(want|wants|would like|need|needs|must|should|goal|hope)\b/.test(sl) && sentence.trim().length > 12 && sentence.trim().length < 180) wants.push(sentence.trim());
  }
  if (wants.length) detections.push({ key: 'wants', label: 'What they want', value: `${wants.length} ${wants.length === 1 ? 'line' : 'lines'}`, evidence: wants[0]! });

  return { patch, detections, systems, wants: wants.slice(0, 6) };
}

/** Sample notes for the demo "Paste example" button. */
export const SAMPLE_CONTEXT = `Intro call with Bakkerij Van Dam, 14 October. Family business in Utrecht, about 140 people across 6 shops and a central bakery. They run a webshop on Shopify and bookkeeping in Exact Online, CRM in HubSpot.

They want quotes for corporate orders out within the hour instead of a day, and fewer phone calls about deliveries. Marc (owner) must approve every email that goes to a customer during the pilot, nothing goes out without a review. Customer data includes phone numbers and email addresses, so GDPR matters to them.

No own servers, they would like Viralistic to host. Alerts only during office hours. Budget of 400 euro per month for AI usage. Communication in Dutch.`;
