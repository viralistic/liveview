/** Core domain model for LiveView (dummy data, shaped like an n8n instance). */

export type Role = 'admin' | 'editor' | 'commenter' | 'viewer';
export const ROLE_RANK: Record<Role, number> = { admin: 4, editor: 3, commenter: 2, viewer: 1 };
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Can edit',
  commenter: 'Can comment',
  viewer: 'Can view',
};

/* ------------------------------------------------------------------ */
/* Organizations and personas.                                          */
/* Three kinds of organization meet in LiveView: n8n (the vendor), the  */
/* partner that builds and runs automations (Viralistic) and the        */
/* enterprise clients. A persona says what someone is here to do; the   */
/* grants below say which workflows they may touch.                     */
/* ------------------------------------------------------------------ */
export type OrgKind = 'vendor' | 'partner' | 'client';
export interface Org {
  id: string;
  kind: OrgKind;
  name: string;
  shortName: string;
  initials: string;
  city: string;
}

/** How a client runs n8n: on the partner's managed cloud, or on their own servers. */
export type HostingRoute = 'partner' | 'self-hosted';
export const ROUTE_LABEL: Record<HostingRoute, string> = { partner: 'Partner route', 'self-hosted': 'Local host' };
export const ROUTE_HINT: Record<HostingRoute, string> = {
  partner: 'Hosted and operated by the partner. n8n is involved through the partner program.',
  'self-hosted': 'Runs on the client\'s own servers. n8n supports the instance directly under an enterprise agreement.',
};
export type N8nPlan = 'community' | 'pro' | 'enterprise' | 'partner';

export type PersonaId =
  | 'n8n-ceo'
  | 'n8n-success'
  | 'n8n-dev'
  | 'partner-owner'
  | 'partner-dev'
  | 'partner-account'
  | 'client-head-ai'
  | 'client-ai-manager'
  | 'client-worker'
  | 'client-dev'
  | 'external-dev';

export type Scope = { kind: 'org' } | { kind: 'company'; companyId: string } | { kind: 'workflow'; workflowId: string };

export interface Grant {
  id: string;
  userId: string;
  scope: Scope;
  role: Role;
  grantedById?: string;
  grantedAt: string;
}

export type CompanySize = 'enterprise' | 'mkb+' | 'mkb' | 'startup';
export const SIZE_LABEL: Record<CompanySize, string> = { enterprise: 'Enterprise', 'mkb+': 'MKB+', mkb: 'MKB', startup: 'Startup' };
export const SIZE_HINT: Record<CompanySize, string> = { enterprise: '1,000 or more people, multiple verticals, procurement and security reviews.', 'mkb+': '100 to 1,000 people, several departments, a named IT contact.', mkb: 'Under 100 people, the owner decides.', startup: 'Small and fast, changes every month.' };
export type SupportTier = 'standard' | 'priority' | 'enterprise';
export type Sensitivity = 'standard' | 'high' | 'hyper';
export const SENSITIVITY_LABEL: Record<Sensitivity, string> = { standard: 'Standard', high: 'High', hyper: 'Hyper-sensitive' };

export interface Company {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  initials: string;
  domain: string;
  industry: string;
  color: string; // accent used in graph view + chips
  description: string;
  onboardedAt: string;
  city: string;
  defaultPinned?: boolean;
  /** partner route (managed by Viralistic) or local host (the client's own servers) */
  route: HostingRoute;
  plan: N8nPlan;
  /** n8n version the instance runs; compared with the changelog */
  n8nVersion: string;
  /** the allocated n8n partner (null for the partner's own instance) */
  partnerId: string | null;
  /** business verticals that chose to onboard, see verticals.ts */
  verticalIds: string[];
  /** company profile, what n8n and the partner need to know about the client */
  size: CompanySize;
  employees: number;
  country: string; // ISO-ish short, 'NL'
  language: string; // 'Dutch'
  supportTier: SupportTier;
  /** default information sensitivity; project settings may raise it */
  sensitivity: Sensitivity;
  contractSince: string;
  /** indicative hourly cost of the people whose work is automated */
  hourlyRate: number;
  /** what the client pays per month: partner fee + hosting or license */
  monthlyCost: { partner: number; platform: number };
}

export type Severity = 'critical' | 'inefficient' | 'minor';
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Breaking',
  inefficient: 'Inefficient',
  minor: 'Minor tip',
};
export const SEVERITY_RANK: Record<Severity, number> = { critical: 3, inefficient: 2, minor: 1 };

export interface Issue {
  id: string;
  workflowId: string;
  nodeId?: string;
  severity: Severity;
  /** short imperative: what to do right now, e.g. "Reconnect the HubSpot credential" */
  action: string;
  title: string;
  detail: string;
  suggestion: string;
  impact: string; // human line, e.g. "38 failed runs today"
  detectedAt: string;
  estSavings?: { runsPerWeek?: number; minutesPerWeek?: number; euroPerMonth?: number };
}

export type TriggerKind = 'webhook' | 'schedule' | 'app' | 'called' | 'error' | 'manual' | 'chat';

export interface Trigger {
  kind: TriggerKind;
  label: string; // "POST /lead", "Every 5 min", "Gmail: support@"
  nodeTypeId: string; // the trigger node type
}

export interface WfNode {
  id: string;
  type: string; // NodeTypeId
  name: string;
  col: number; // layout column (0 = trigger)
  row: number; // layout lane
  note?: string;
  disabled?: boolean;
}

export interface WfConnection {
  from: string;
  to: string;
  label?: string; // e.g. "true" / "false" / "Region: North"
}

export type RunStatus = 'success' | 'error' | 'running' | 'waiting';

export interface WorkflowStats {
  runs7d: number;
  runs24h: number;
  failed7d: number;
  failed24h: number;
  successRate: number; // 0..1
  avgDurationMs: number;
  p95DurationMs: number;
  lastRunAt: string;
  lastStatus: RunStatus;
  series7d: number[]; // 28 buckets (6h each) of run counts
  failures7d: number[]; // same buckets, failures
}

export interface Workflow {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  description: string;
  trigger: Trigger;
  active: boolean;
  nodes: WfNode[];
  connections: WfConnection[];
  calls: string[]; // workflow ids this workflow triggers via Execute Workflow
  tags: string[];
  ownerId: string;
  updatedAt: string;
  updatedById: string;
  version: number;
  credentialIds: string[];
  stats: WorkflowStats;
  issues: Issue[];
  shared?: boolean; // shared service used by several companies
  /** this workflow is an instance of a reusable product (purple everywhere) */
  productId?: string;
}

/* ------------------------------------------------------------------ */
/* Products: reusable automations, like symbols in Webflow.             */
/* One source of truth; every instance can be updated from it.         */
/* ------------------------------------------------------------------ */
export type ProductCategoryId = 'financial' | 'marketing' | 'hrm' | 'common';
export interface ProductCategory {
  id: ProductCategoryId;
  label: string;
  description: string;
}
export interface ProductInstance {
  workflowId: string;
  companyId: string;
  version: number; // version of the product this instance runs
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategoryId;
  tagline: string;
  description: string;
  version: number;
  updatedAt: string;
  updatedById: string;
  trigger: Trigger;
  nodes: WfNode[];
  connections: WfConnection[];
  instances: ProductInstance[];
  tags: string[];
  /** products are versioned like code: a repository per product (demo, not connected to GitHub) */
  repo: ProductRepo;
}
export interface ProductRepo {
  owner: string; // e.g. 'viralistic'
  name: string; // e.g. 'products'
  path: string; // e.g. 'marketing/lead-intake'
  branch: string; // 'main'
  stars: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  companyId: string; // employer (a company id, or 'n8n' for the vendor)
  persona: PersonaId;
  /** the vertical this person works in (client personas) */
  verticalId?: string;
  color: string; // a pink, used for cursor + presence
  avatarColors: string[];
  /** illustrated portrait, see scripts/gen-avatars.mjs */
  photo?: string;
  /** easter egg: clicking the avatar opens this video */
  video?: string;
  online: boolean;
  lastActiveAt: string;
  isYou?: boolean;
  /** scripted presence for the demo */
  presence?: {
    viewing: string; // workflowId or companyId they are looking at
    device: 'mac' | 'windows' | 'ipad';
  };
}

export type CredentialStatus = 'valid' | 'expiring' | 'expired';

export interface Credential {
  id: string;
  name: string;
  type: string; // NodeTypeId used for icon
  typeLabel: string;
  ownerId: string;
  companyId: string | null; // null = shared across org
  usedBy: string[]; // workflow ids
  lastUsedAt: string;
  createdAt: string;
  status: CredentialStatus;
  expiresAt?: string;
}

export interface Comment {
  id: string;
  workflowId: string;
  nodeId?: string;
  authorId: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: { authorId: string; body: string; createdAt: string }[];
}

export type ActivityType = 'edit' | 'run' | 'error' | 'access' | 'comment' | 'activate' | 'credential';

export interface Activity {
  id: string;
  type: ActivityType;
  userId?: string;
  workflowId?: string;
  companyId?: string;
  message: string;
  at: string;
}

/* ------------------------------------------------------------------ */
/* Verticals, KPIs and gamification.                                    */
/* A client onboards per vertical (Finance, New business, HRM ...).     */
/* Each vertical has a Head of AI, a small team and agreed KPIs.        */
/* ------------------------------------------------------------------ */
export type VerticalStatus = 'live' | 'onboarding' | 'planned';
export interface Vertical {
  id: string;
  companyId: string;
  name: string; // "New business"
  label: string; // "Head of AI New Business"
  description: string;
  status: VerticalStatus;
  managerId?: string;
  memberIds: string[];
  workflowIds: string[];
  /** products this vertical plans to adopt next (planned/onboarding verticals) */
  plannedProductIds: string[];
  onboardedAt?: string;
  color: string; // used only for charts comparing verticals
}

export type KpiUnit = 'min' | 'h' | '%' | 'count' | 'eur' | 'days';
export interface Kpi {
  id: string;
  companyId: string;
  verticalId?: string;
  label: string;
  description: string;
  unit: KpiUnit;
  target: number;
  current: number;
  /** 'down' = lower is better */
  direction: 'up' | 'down';
  /** the value before the automations, for context */
  baseline: number;
  series: number[]; // last 12 weeks
  agreedAt: string;
  agreedByIds: string[]; // partner + client
}

export type BadgeId = 'first-run' | 'streak-4' | 'streak-12' | 'saver-50' | 'saver-200' | 'kpi-crusher' | 'bug-spotter' | 'mentor' | 'early-adopter' | 'top-of-month';
export interface BadgeDef {
  id: BadgeId;
  label: string;
  description: string;
  icon: string; // lucide export name
}
export interface MemberStats {
  userId: string;
  verticalId: string;
  runsTriggered30d: number;
  hoursSaved30d: number;
  euroSaved30d: number;
  /** targets hit of the vertical's KPIs the person contributes to */
  kpiHits: number;
  kpiTotal: number;
  points: number;
  streakWeeks: number;
  badges: BadgeId[];
  series12w: number[]; // weekly points
}
export interface Reward {
  id: string;
  label: string;
  description: string;
  points: number;
  icon: string; // lucide export name
}

/** Scope agreed between partner and client, shown on the executive dashboard. */
export type ScopeStatus = 'delivered' | 'in-progress' | 'planned';
export interface ScopeItem {
  id: string;
  title: string;
  status: ScopeStatus;
  verticalId?: string;
  workflowIds: string[];
  agreedAt: string;
  deliveredAt?: string;
}
export interface NextStep {
  title: string;
  at: string;
  ownerId: string;
  done?: boolean;
}

/* ------------------------------------------------------------------ */
/* Usage: tokens, time and money per workflow.                          */
/* ------------------------------------------------------------------ */
export type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'claude-sonnet-4-5' | 'claude-haiku-4-5' | 'gemini-2.5-flash';
export interface ModelDef {
  id: ModelId;
  label: string;
  vendor: 'OpenAI' | 'Anthropic' | 'Google';
  /** indicative blended price per million tokens, in euro */
  pricePerM: number;
  /** relative quality score for the demo, 0..100 */
  quality: number;
  releasedAt: string;
}
export interface WorkflowUsageProfile {
  workflowId: string;
  model?: ModelId;
  /** average tokens per run (0 when the workflow has no model step) */
  tokensPerRun: number;
  /** minutes of manual work replaced per run */
  minutesSavedPerRun: number;
  /** which vertical the savings belong to */
  verticalId?: string;
}

/* ------------------------------------------------------------------ */
/* Forks and versions.                                                  */
/* Products are versioned like code: a repository per product with a   */
/* commit history, and forks that swap a node for another tool (HubSpot */
/* for SAP, Slack for Telegram). Demo: not connected to GitHub.         */
/* ------------------------------------------------------------------ */
export type ForkStatus = 'diverged' | 'pr-open' | 'merged' | 'archived';
export const FORK_STATUS_LABEL: Record<ForkStatus, string> = {
  diverged: 'Diverged',
  'pr-open': 'Pull request open',
  merged: 'Merged',
  archived: 'Archived',
};

/** One node replaced by another tool, e.g. hubspot -> sap on "Create contact". */
export interface NodeSwap {
  /** id of the node in the parent flow that is replaced */
  nodeId: string;
  /** name of that node, for display */
  nodeName: string;
  /** NodeTypeId before */
  from: string;
  /** NodeTypeId after */
  to: string;
  /** optional new node name (defaults to the parent's name) */
  rename?: string;
}

/** A fork is a variant of a product, or of another fork. */
export interface Fork {
  id: string;
  slug: string;
  productId: string;
  /** when set, this fork branches from another fork (fork of a fork) */
  parentForkId?: string;
  name: string;
  description: string;
  authorId: string;
  /** the author's organization ('n8n' for the vendor) */
  companyId: string;
  createdAt: string;
  updatedAt: string;
  swaps: NodeSwap[];
  /** nodes this fork adds; an added node on an occupied cell is inserted there and later columns shift right */
  addedNodes?: WfNode[];
  addedConnections?: WfConnection[];
  /** node ids this fork removes (their connections go too) */
  removedNodeIds?: string[];
  /** connections this fork removes, e.g. the one it inserts a node into */
  removedConnections?: WfConnection[];
  commitsAhead: number;
  commitsBehind: number;
  status: ForkStatus;
  stars: number;
  usedByCompanyIds: string[];
  prNumber?: number;
}

/** One commit in a product's repository. A version tag marks a release. */
export interface Commit {
  sha: string;
  productId: string;
  message: string;
  authorId: string;
  at: string;
  /** version tag, e.g. 14 for "v14" */
  version?: number;
  /** the fork this commit merged, when it is a merge commit */
  forkId?: string;
}

/** A merge the person made in the demo (persisted): becomes a commit and bumps the product version. */
export interface MergeRecord {
  forkId: string;
  productId: string;
  prNumber: number;
  byId: string;
  at: string;
  version: number;
  sha: string;
}
