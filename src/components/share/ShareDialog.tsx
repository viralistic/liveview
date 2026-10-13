import { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Copy, Globe, Link2, Lock, Workflow, ArrowUpRight } from 'lucide-react';
import { COMPANIES, ROLE_LABEL, USERS, WORKFLOWS, type Role, type Scope } from '../../data';
import { $shareDialog, closeShare, setGrant, toast, useStore, useSession } from '../../stores/session';
import { canManage, roleForScope, scopeLabel, usersWithAccess, sameScope } from '../../lib/access';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import s from './share.module.css';

const ROLES: Role[] = ['admin', 'editor', 'commenter', 'viewer'];

function RoleSelect({ value, onChange, disabled, allowRemove }: { value: Role; onChange: (r: Role | 'remove') => void; disabled?: boolean; allowRemove?: boolean }) {
  return (
    <span className={s.roleSelect}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role | 'remove')} aria-label="Role">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
        {allowRemove && <option value="remove">Remove access</option>}
      </select>
      <ChevronDown />
    </span>
  );
}

export function ShareDialog() {
  const scope = useStore($shareDialog);
  const { grants } = useSession();
  const { user: me } = useSession();
  const [query, setQuery] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [linkOn, setLinkOn] = useState(true);
  const [linkRole, setLinkRole] = useState<Role>('viewer');
  const [copied, setCopied] = useState(false);

  const entries = useMemo(() => (scope ? usersWithAccess(scope, grants) : []), [scope, grants]);
  if (!scope) return null;

  const myRole = roleForScope(me.id, scope, grants);
  const iCanManage = canManage(myRole);
  const wf = scope.kind === 'workflow' ? WORKFLOWS.find((w) => w.id === scope.workflowId) : undefined;
  const companyId = scope.kind === 'company' ? scope.companyId : wf?.companyId;
  const company = companyId ? COMPANIES.find((c) => c.id === companyId) : undefined;

  const hierarchy: { scope: Scope; kind: string; label: string; count: string; icon: React.ReactNode }[] = [];
  if (wf) hierarchy.push({ scope: { kind: 'workflow', workflowId: wf.id }, kind: 'Workflow', label: wf.name, count: `${wf.nodes.length} nodes`, icon: <Workflow /> });
  if (company) hierarchy.push({ scope: { kind: 'company', companyId: company.id }, kind: 'Company', label: company.shortName, count: `${WORKFLOWS.filter((w) => w.companyId === company.id).length} workflows`, icon: <Building2 /> });
  hierarchy.push({ scope: { kind: 'org' }, kind: 'Everything', label: 'All companies', count: `${COMPANIES.length} companies · ${WORKFLOWS.length} workflows`, icon: <Globe /> });

  const title = scope.kind === 'org' ? 'Share everything' : `Share “${scopeLabel(scope)}”`;

  const invite = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const user = USERS.find((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase() === q);
    if (user) {
      setGrant(user.id, scope, inviteRole, me.id);
      toast(`${user.name.split(' ')[0]} can now ${ROLE_LABEL[inviteRole].toLowerCase().replace('can ', '')} ${scopeLabel(scope)}`);
    } else {
      toast(`Invitation sent to ${query.trim()}`);
    }
    setQuery('');
  };

  const copy = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}${window.location.search}` : '';
    try {
      await navigator.clipboard.writeText(url + (url.includes('?') ? '&' : '?') + `share=${encodeURIComponent(scopeKeyShort(scope))}&access=${linkRole}`);
    } catch {
      /* ignore */
    }
    setCopied(true);
    toast('Link copied');
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Modal open onClose={closeShare} title={title} width={560}>
      {/* hierarchy picker */}
      <div className={s.sectionTitle}>
        <span>Share at which level?</span>
        <span className={s.scopeHint}>Roles cascade downwards</span>
      </div>
      <div className={s.hier} style={{ gridTemplateColumns: `repeat(${hierarchy.length}, 1fr)` }}>
        {hierarchy.map((h) => (
          <button key={h.kind} type="button" className={s.hierItem} aria-pressed={sameScope(h.scope, scope)} onClick={() => $shareDialog.set(h.scope)}>
            <span className={s.hierKind}>
              {h.icon}
              {h.kind}
            </span>
            <span className={s.hierLabel}>{h.label}</span>
            <span className={s.hierCount}>{h.count}</span>
          </button>
        ))}
      </div>

      {/* invite */}
      <div className={s.invite}>
        <div className={s.inviteBox}>
          <input
            placeholder={iCanManage ? 'Invite by name or email…' : 'Only admins can invite here'}
            value={query}
            disabled={!iCanManage}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            list="lv-people"
          />
          <datalist id="lv-people">
            {USERS.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
          <RoleSelect value={inviteRole} onChange={(r) => r !== 'remove' && setInviteRole(r)} disabled={!iCanManage} />
        </div>
        <Button variant="primary" onClick={invite} disabled={!iCanManage || !query.trim()}>
          Invite
        </Button>
      </div>

      {/* people */}
      <div className={s.sectionTitle}>
        <span>Who has access · {entries.length}</span>
        {!iCanManage && (
          <span className={s.scopeHint} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Lock size={11} /> You can {myRole ? ROLE_LABEL[myRole].toLowerCase().replace('can ', '') : 'not access this'}
          </span>
        )}
      </div>
      <div className={s.list}>
        {entries.map((e) => {
          const direct = !e.inherited;
          return (
            <div key={e.user.id} className={s.row}>
              <Avatar user={e.user} size={30} online={e.user.online} />
              <div className={s.who}>
                <div className={s.name}>
                  {e.user.name}
                  {e.user.id === me.id && <span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>(you)</span>}
                  {e.inherited && (
                    <span className={s.via} title={`Inherited from ${scopeLabel(e.via)}`}>
                      <ArrowUpRight />
                      via{' '}
                      <span className={s.viaLink} onClick={() => $shareDialog.set(e.via)}>
                        {scopeLabel(e.via)}
                      </span>
                    </span>
                  )}
                </div>
                <div className={s.email}>{e.user.email}</div>
              </div>
              <RoleSelect
                value={e.role}
                disabled={!iCanManage || !direct || (e.user.id === me.id && e.role === 'admin' && scope.kind === 'org')}
                allowRemove={direct}
                onChange={(r) => {
                  setGrant(e.user.id, scope, r === 'remove' ? null : r, me.id);
                  toast(r === 'remove' ? `Removed ${e.user.name.split(' ')[0]} from ${scopeLabel(scope)}` : `${e.user.name.split(' ')[0]} is now “${ROLE_LABEL[r]}” on ${scopeLabel(scope)}`);
                }}
              />
            </div>
          );
        })}
        {entries.length === 0 && <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Nobody has access yet.</div>}
      </div>

      {/* link */}
      <div className={s.link}>
        <span className={s.linkIcon}>
          <Link2 />
        </span>
        <div className={s.linkMeta}>
          <div className={s.linkTitle}>
            Anyone with the link
            <button type="button" className={s.toggle} role="switch" aria-checked={linkOn} onClick={() => setLinkOn((v) => !v)} aria-label="Toggle link access" />
          </div>
          <div className={s.linkSub}>{linkOn ? 'The link opens exactly this view, at this zoom level.' : 'Only people above can open this view.'}</div>
        </div>
        {linkOn && <RoleSelect value={linkRole} onChange={(r) => r !== 'remove' && setLinkRole(r)} />}
        <Button variant="secondary" onClick={copy} size="sm">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>

      <div className={s.footer}>
        <span>Admin → manage access · Can edit → change workflows · Can comment → leave notes on the canvas · Can view → read only.</span>
      </div>
    </Modal>
  );
}

function scopeKeyShort(scope: Scope): string {
  return scope.kind === 'org' ? 'org' : scope.kind === 'company' ? scope.companyId : scope.workflowId;
}
