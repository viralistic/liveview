/** Core domain model for LiveView (dummy data, shaped like an n8n instance). */

export type Role = 'admin' | 'editor' | 'commenter' | 'viewer';
export const ROLE_RANK: Record<Role, number> = { admin: 4, editor: 3, commenter: 2, viewer: 1 };
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Can edit',
  commenter: 'Can comment',
  viewer: 'Can view',
};

export type Scope = { kind: 'org' } | { kind: 'company'; companyId: string } | { kind: 'workflow'; workflowId: string };

export interface Grant {
  id: string;
  userId: string;
  scope: Scope;
  role: Role;
  grantedById?: string;
  grantedAt: string;
}

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
}

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  companyId: string; // employer
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
