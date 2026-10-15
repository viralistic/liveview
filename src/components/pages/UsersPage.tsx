import { useMemo } from 'react';
import { Crown, Eye, MessageSquareText, Pencil, ShieldCheck, UserPlus, Users as UsersIcon, Minus } from 'lucide-react';
import { COMPANIES, ROLE_LABEL, USERS, WORKFLOWS, orgOfUser, type Role, type User } from '../../data';
import { openShare, useSession } from '../../stores/session';
import { accessSummary, highestRole, isOrgAdmin, roleForCompany, canSeeCompany, roleForWorkflow, usersWithAccess } from '../../lib/access';
import { personaOf } from '../../lib/persona';
import { relTime } from '../../lib/format';
import { RolesMatrix } from './RolesMatrix';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Tooltip } from '../ui/Tooltip';
import ui from '../ui/ui.module.css';
import { PageHeader } from './shared';
import s from './pages.module.css';

const ROLE_ICON: Record<Role, React.ReactNode> = { admin: <Crown />, editor: <Pencil />, commenter: <MessageSquareText />, viewer: <Eye /> };

/** Small tag for the kind of organization someone belongs to. */
function kindOf(u: User): 'n8n' | 'partner' | 'client' | 'external' {
  if (u.persona === 'external-dev') return 'external';
  const kind = orgOfUser(u).kind;
  return kind === 'vendor' ? 'n8n' : kind;
}

export function UsersPage() {
  const { user: me, grants, persona, visibleCompanies } = useSession();
  const admin = isOrgAdmin(me.id, grants);
  /** Vendor and partner personas see everyone; a client sees its own people plus the partner people who have access to its company. */
  const people = useMemo(() => {
    if (persona.org !== 'client') return USERS;
    const partnerIds = new Set(
      usersWithAccess({ kind: 'company', companyId: me.companyId }, grants)
        .filter((e) => orgOfUser(e.user).kind === 'partner')
        .map((e) => e.user.id),
    );
    return USERS.filter((u) => u.companyId === me.companyId || partnerIds.has(u.id));
  }, [persona.org, me.companyId, grants]);
  const columns = visibleCompanies;

  return (
    <>
      <PageHeader
        title="Users & access"
        actions={
          admin ? (
            <Button variant="primary" onClick={() => openShare({ kind: 'org' })}>
              <UserPlus /> Invite people
            </Button>
          ) : undefined
        }
      />

      <div className={s.stack}>
        <Card>
          <CardHeader title="People" sub={`${people.length} people`} icon={<UsersIcon />} />
          <CardBody flush>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Works at</th>
                  <th>Highest role</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {people.map((u) => {
                  const r = highestRole(u.id, grants);
                  const chips = accessSummary(u.id, grants);
                  const employer = orgOfUser(u);
                  const kind = kindOf(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className={s.personCell}>
                          <Avatar user={u} size={32} online={u.online} />
                          <div>
                            <div className={s.personName} title={u.email}>
                              {u.name}
                              {u.id === me.id && <span className={s.subtle} style={{ fontWeight: 450 }}>· you</span>}
                              {isOrgAdmin(u.id, grants) && <Badge tone="dark" size="sm">Owner</Badge>}
                            </div>
                            <div className={s.personaLine}>
                              <span className={s.orgTag} data-kind={kind}>
                                {kind}
                              </span>
                              {personaOf(u).label}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--fs-sm)' }}>{employer.shortName}</div>
                        <div className={s.personSub}>{u.title}</div>
                      </td>
                      <td>{r ? <Badge tone={r === 'admin' ? 'dark' : 'outline'}>{ROLE_LABEL[r]}</Badge> : <span className={s.subtle}>No access</span>}</td>
                      <td>
                        <div className={s.chips}>
                          {chips.map((c, i) => (
                            <span key={i} className={s.chip} title={`${ROLE_LABEL[c.role]} on ${c.label}`}>
                              <span style={{ display: 'grid', color: 'var(--text-subtle)' }}>{c.kind === 'org' ? <ShieldCheck size={11} /> : c.kind === 'company' ? <span className={s.chipDot} style={{ background: COMPANIES.find((x) => x.shortName === c.label)?.color }} /> : <Pencil size={10} />}</span>
                              {c.label}
                              <span className={s.subtle}>· {ROLE_LABEL[c.role].replace('Can ', '')}</span>
                            </span>
                          ))}
                          {chips.length === 0 && <span className={s.subtle}>–</span>}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {u.online ? (
                          <Badge tone="success" dot>
                            Online
                          </Badge>
                        ) : (
                          <span className={s.muted}>Active {relTime(u.lastActiveAt)}</span>
                        )}
                      </td>
                      <td>
                        {admin && (
                          <span className={s.rowAction}>
                            <Button size="sm" variant="secondary" onClick={() => openShare({ kind: 'org' })}>
                              Manage
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <RolesMatrix users={people} />

        <div className={s.grid2}>
          <Card>
            <CardHeader title="Access matrix" icon={<ShieldCheck />} />
            <CardBody flush>
              <table className={s.matrix}>
                <thead>
                  <tr>
                    <th>Person</th>
                    {columns.map((c) => (
                      <th key={c.id}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span className={s.chipDot} style={{ background: c.color }} />
                          {c.shortName}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className={s.personCell}>
                          <Avatar user={u} size={22} />
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{u.name}</span>
                        </span>
                      </td>
                      {columns.map((c) => {
                        const role = roleForCompany(u.id, c.id, grants);
                        const partial = !role && canSeeCompany(u.id, c.id, grants);
                        const partialCount = partial ? WORKFLOWS.filter((w) => w.companyId === c.id && roleForWorkflow(u.id, w, grants)).length : 0;
                        const orgGrant = grants.find((g) => g.userId === u.id && g.scope.kind === 'org');
                        const inherited = !!role && !!orgGrant && !grants.some((g) => g.userId === u.id && g.scope.kind === 'company' && g.scope.companyId === c.id && g.role === role);
                        const label = role ? `${ROLE_LABEL[role]}${inherited ? ' · inherited from Everything' : ''}` : partial ? `${partialCount} workflow${partialCount === 1 ? '' : 's'} only` : 'No access';
                        return (
                          <td key={c.id}>
                            <Tooltip label={label}>
                              <button type="button" className={s.cell} data-role={role ?? 'none'} data-partial={partial} onClick={() => openShare({ kind: 'company', companyId: c.id })} aria-label={`${u.name} on ${c.shortName}: ${label}`} style={{ position: 'relative' }}>
                                {role ? ROLE_ICON[role] : partial ? <span style={{ fontSize: 10, fontWeight: 600 }}>{partialCount}</span> : <Minus />}
                                {inherited && <span className={s.inherited} />}
                              </button>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Roles" icon={<Crown />} />
            <CardBody>
              <div className={s.roles} style={{ gridTemplateColumns: '1fr 1fr' }}>
                {(['admin', 'editor', 'commenter', 'viewer'] as Role[]).map((r) => (
                  <div key={r} className={s.role}>
                    <div className={s.roleName}>
                      <span style={{ background: r === 'admin' ? 'var(--primary)' : 'var(--surface)', color: r === 'admin' ? 'var(--primary-fg)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>{ROLE_ICON[r]}</span>
                      {ROLE_LABEL[r]}
                    </div>
                    <div className={s.roleDesc}>
                      {r === 'admin' && 'Invite, change roles, share.'}
                      {r === 'editor' && 'Change and activate workflows.'}
                      {r === 'commenter' && 'Comment on the canvas.'}
                      {r === 'viewer' && 'Read only.'}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
