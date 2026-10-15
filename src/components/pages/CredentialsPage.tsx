import { NoAccess } from '../shell/NoAccess';
import { useMemo, useState } from 'react';
import { ChevronDown, KeyRound, RefreshCw, Search, TriangleAlert, Workflow as WorkflowIcon } from 'lucide-react';
import { COMPANIES, CREDENTIALS, USERS, WORKFLOWS } from '../../data';
import { toast, useSession } from '../../stores/session';
import { canSeeCompany } from '../../lib/access';
import { relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { NodeIcon } from '../ui/NodeIcon';
import { Tooltip } from '../ui/Tooltip';
import ui from '../ui/ui.module.css';
import { CompanyChip, PageHeader } from './shared';
import s from './pages.module.css';

/** Gate first, so the inner component keeps a stable hook order. */
export function CredentialsPage() {
  const { can } = useSession();
  if (!can('manage-credentials')) return <NoAccess cap="manage-credentials" />;
  return <CredentialsPageInner />;
}

function CredentialsPageInner() {
  const { user: me, grants, visibleWorkflows: visibleWfs } = useSession();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const creds = useMemo(() => {
    const ql = q.toLowerCase();
    return CREDENTIALS.filter((c) => (c.companyId ? canSeeCompany(me.id, c.companyId, grants) : true))
      .filter((c) => (status === 'all' ? true : c.status === status))
      .filter((c) => !ql || c.name.toLowerCase().includes(ql) || c.typeLabel.toLowerCase().includes(ql))
      .sort((a, b) => rank(a.status) - rank(b.status) || b.usedBy.length - a.usedBy.length);
  }, [me.id, grants, q, status]);

  const expired = creds.filter((c) => c.status === 'expired');
  const expiring = creds.filter((c) => c.status === 'expiring');
  const failingWfs = expired.flatMap((c) => c.usedBy).filter((id, i, arr) => arr.indexOf(id) === i);

  return (
    <>
      <PageHeader
        title="Credentials"
        actions={
          <Button variant="primary" onClick={() => toast('Credential picker opens in n8n (demo)')}>
            <KeyRound /> Add credential
          </Button>
        }
      />

      {expired.length > 0 && (
        <div className={s.banner}>
          <TriangleAlert />
          <span>
            <b>{expired.map((c) => c.name).join(', ')}</b> expired {relTime(expired[0]!.expiresAt!)}. {failingWfs.length} workflows are failing because of it.
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Button size="sm" variant="secondary" href={`/workflows/canvas?focus=${failingWfs[0]}`}>
              Show on canvas
            </Button>
            <Button size="sm" variant="primary" onClick={() => toast('Re-authentication started in n8n (demo)')}>
              <RefreshCw /> Reconnect
            </Button>
          </span>
        </div>
      )}
      {expiring.length > 0 && (
        <div className={[s.banner, s.bannerWarn].join(' ')}>
          <TriangleAlert />
          <span>
            {expiring.length} credential{expiring.length === 1 ? '' : 's'} expire soon: <b>{expiring.map((c) => `${c.name} (${daysUntil(c.expiresAt!)}d)`).join(', ')}</b>.
          </span>
        </div>
      )}

      <div className={s.filters}>
        <label className={s.searchBox}>
          <Search />
          <input placeholder="Filter credentials" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className={s.select}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Any status</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
          </select>
          <ChevronDown />
        </span>
        <span className={s.spacer} />
        <span className={s.count}>{creds.length} credentials</span>
      </div>

      <Card>
        <CardBody flush>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Credential</th>
                <th>Owner</th>
                <th>Shared with</th>
                <th>Used by</th>
                <th>Last used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => {
                const owner = USERS.find((u) => u.id === c.ownerId);
                const company = c.companyId ? COMPANIES.find((x) => x.id === c.companyId) : undefined;
                const used = c.usedBy.map((id) => WORKFLOWS.find((w) => w.id === id)!).filter(Boolean);
                const hidden = used.filter((w) => !visibleWfs.some((v) => v.id === w.id)).length;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className={s.credCell}>
                        <NodeIcon type={c.type} size={30} />
                        <div>
                          <div className={s.wfName}>{c.name}</div>
                          <div className={s.wfDesc}>{c.typeLabel} · created {relTime(c.createdAt)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {owner && (
                        <span className={s.personCell} style={{ gap: 8 }}>
                          <Avatar user={owner} size={22} />
                          <span style={{ fontSize: 'var(--fs-sm)' }}>{owner.name}</span>
                        </span>
                      )}
                    </td>
                    <td>{company ? <CompanyChip company={company} /> : <Badge tone="outline">All companies</Badge>}</td>
                    <td>
                      <Tooltip label={used.map((w) => w.name).join(' · ')}>
                        <span className={s.usedBy}>
                          <WorkflowIcon size={13} /> {used.length} workflow{used.length === 1 ? '' : 's'}
                          {hidden > 0 && <span className={s.subtle}> ({hidden} hidden)</span>}
                        </span>
                      </Tooltip>
                    </td>
                    <td className={s.muted} style={{ whiteSpace: 'nowrap' }}>{relTime(c.lastUsedAt)}</td>
                    <td>
                      <Badge tone={c.status === 'valid' ? 'success' : c.status === 'expiring' ? 'warning' : 'danger'} dot>
                        {c.status === 'valid' ? 'Valid' : c.status === 'expiring' ? `Expires in ${daysUntil(c.expiresAt!)}d` : 'Expired'}
                      </Badge>
                    </td>
                    <td>
                      {c.status !== 'valid' && (
                        <Button size="sm" variant={c.status === 'expired' ? 'primary' : 'secondary'} onClick={() => toast(`Re-authenticating ${c.name} (demo)`)}>
                          <RefreshCw /> Reconnect
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}

function rank(s: string) {
  return s === 'expired' ? 0 : s === 'expiring' ? 1 : 2;
}
function daysUntil(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - new Date('2026-10-13T14:32:00+02:00').getTime()) / 86_400_000));
}
