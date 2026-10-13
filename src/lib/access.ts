import { ROLE_RANK, type Grant, type Role, type Scope, type User, type Workflow, type Company } from '../data/types';
import { WORKFLOWS } from '../data/workflows';
import { COMPANIES } from '../data/companies';
import { USERS } from '../data/users';

/* ------------------------------------------------------------------
   Hierarchical access: org → company → workflow.
   A user's effective role on a workflow is the highest role among
   grants that cover it. Visibility = having any role at all.
------------------------------------------------------------------- */

const higher = (a: Role | null, b: Role | null): Role | null => {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
};

export function scopeKey(s: Scope): string {
  if (s.kind === 'org') return 'org';
  if (s.kind === 'company') return `company:${s.companyId}`;
  return `workflow:${s.workflowId}`;
}
export function sameScope(a: Scope, b: Scope): boolean {
  return scopeKey(a) === scopeKey(b);
}
export function scopeLabel(s: Scope): string {
  if (s.kind === 'org') return 'Everything';
  if (s.kind === 'company') return COMPANIES.find((c) => c.id === s.companyId)?.shortName ?? s.companyId;
  return WORKFLOWS.find((w) => w.id === s.workflowId)?.name ?? s.workflowId;
}

export function roleForWorkflow(userId: string, wf: Workflow, grants: Grant[]): Role | null {
  let role: Role | null = null;
  for (const g of grants) {
    if (g.userId !== userId) continue;
    if (g.scope.kind === 'org') role = higher(role, g.role);
    else if (g.scope.kind === 'company' && g.scope.companyId === wf.companyId) role = higher(role, g.role);
    else if (g.scope.kind === 'workflow' && g.scope.workflowId === wf.id) role = higher(role, g.role);
  }
  return role;
}

/** Role at company level (org or company grants only). */
export function roleForCompany(userId: string, companyId: string, grants: Grant[]): Role | null {
  let role: Role | null = null;
  for (const g of grants) {
    if (g.userId !== userId) continue;
    if (g.scope.kind === 'org') role = higher(role, g.role);
    else if (g.scope.kind === 'company' && g.scope.companyId === companyId) role = higher(role, g.role);
  }
  return role;
}

export function roleForScope(userId: string, scope: Scope, grants: Grant[]): Role | null {
  if (scope.kind === 'org') return grants.find((g) => g.userId === userId && g.scope.kind === 'org')?.role ?? null;
  if (scope.kind === 'company') return roleForCompany(userId, scope.companyId, grants);
  const wf = WORKFLOWS.find((w) => w.id === scope.workflowId);
  return wf ? roleForWorkflow(userId, wf, grants) : null;
}

export function canSeeWorkflow(userId: string, wf: Workflow, grants: Grant[]): boolean {
  return roleForWorkflow(userId, wf, grants) !== null;
}

/** A company is visible if the user has a role on it or on any workflow inside it. */
export function canSeeCompany(userId: string, companyId: string, grants: Grant[]): boolean {
  if (roleForCompany(userId, companyId, grants)) return true;
  return WORKFLOWS.some((w) => w.companyId === companyId && roleForWorkflow(userId, w, grants) !== null);
}

export function visibleWorkflows(userId: string, grants: Grant[]): Workflow[] {
  return WORKFLOWS.filter((w) => canSeeWorkflow(userId, w, grants));
}
export function visibleCompanies(userId: string, grants: Grant[]): Company[] {
  return COMPANIES.filter((c) => canSeeCompany(userId, c.id, grants));
}

export function canEdit(role: Role | null): boolean {
  return role === 'admin' || role === 'editor';
}
export function canComment(role: Role | null): boolean {
  return role !== null && role !== 'viewer';
}
export function canManage(role: Role | null): boolean {
  return role === 'admin';
}

export function isOrgAdmin(userId: string, grants: Grant[]): boolean {
  return grants.some((g) => g.userId === userId && g.scope.kind === 'org' && g.role === 'admin');
}

/** Highest role anywhere, for the users table. */
export function highestRole(userId: string, grants: Grant[]): Role | null {
  return grants.filter((g) => g.userId === userId).reduce<Role | null>((acc, g) => higher(acc, g.role), null);
}

/** Human chips describing where a user has access. */
export function accessSummary(userId: string, grants: Grant[]): { label: string; kind: Scope['kind']; role: Role }[] {
  const mine = grants.filter((g) => g.userId === userId);
  const out: { label: string; kind: Scope['kind']; role: Role }[] = [];
  const org = mine.find((g) => g.scope.kind === 'org');
  if (org) out.push({ label: 'All companies', kind: 'org', role: org.role });
  for (const g of mine) {
    if (g.scope.kind === 'company') out.push({ label: scopeLabel(g.scope), kind: 'company', role: g.role });
  }
  const wfs = mine.filter((g) => g.scope.kind === 'workflow');
  for (const g of wfs) out.push({ label: scopeLabel(g.scope), kind: 'workflow', role: g.role });
  return out;
}

export interface AccessEntry {
  user: User;
  role: Role;
  /** where the role comes from */
  via: Scope;
  inherited: boolean;
  grantId: string;
}

/** Everyone who can access a scope, with the grant that gives them the highest role. */
export function usersWithAccess(scope: Scope, grants: Grant[]): AccessEntry[] {
  const out: AccessEntry[] = [];
  for (const u of USERS) {
    let best: { role: Role; g: Grant } | null = null;
    for (const g of grants) {
      if (g.userId !== u.id) continue;
      let covers = false;
      if (g.scope.kind === 'org') covers = true;
      else if (scope.kind === 'company') covers = g.scope.kind === 'company' && g.scope.companyId === scope.companyId;
      else if (scope.kind === 'workflow') {
        const wf = WORKFLOWS.find((w) => w.id === scope.workflowId);
        covers =
          (g.scope.kind === 'workflow' && g.scope.workflowId === scope.workflowId) ||
          (g.scope.kind === 'company' && !!wf && g.scope.companyId === wf.companyId);
      }
      if (!covers) continue;
      if (!best || ROLE_RANK[g.role] > ROLE_RANK[best.role]) best = { role: g.role, g };
    }
    if (best) {
      out.push({ user: u, role: best.role, via: best.g.scope, inherited: !sameScope(best.g.scope, scope), grantId: best.g.id });
    }
  }
  return out.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.user.name.localeCompare(b.user.name));
}

/** Members (direct + inherited) for a company, used on cards. */
export function companyMembers(companyId: string, grants: Grant[]): AccessEntry[] {
  return usersWithAccess({ kind: 'company', companyId }, grants);
}
