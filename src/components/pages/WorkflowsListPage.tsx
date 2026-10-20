import { useMemo, useState } from 'react';
import { ChevronDown, Search, Workflow as WorkflowIcon } from 'lucide-react';
import { COMPANIES, SEVERITY_RANK, USERS, type TriggerKind } from '../../data';
import { useSession } from '../../stores/session';
import { roleForWorkflow } from '../../lib/access';
import { workflowHealth, worstSeverity } from '../../lib/health';
import { fmtCompact, fmtPct, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import { HealthRing } from '../ui/HealthRing';
import { Modal } from '../ui/Modal';
import { NodeIcon } from '../ui/NodeIcon';
import { SeverityIcon } from '../ui/SeverityIcon';
import { Bars } from '../ui/Sparkline';
import ui from '../ui/ui.module.css';
import { WorkflowPanel } from './WorkflowPanel';
import { CompanyChip, PageHeader, ViewSwitcher } from './shared';
import s from './pages.module.css';

const TRIGGER_LABEL: Record<TriggerKind, string> = { webhook: 'Webhook', schedule: 'Schedule', app: 'App event', called: 'Called by workflow', error: 'Error trigger', manual: 'Manual', chat: 'Chat' };

export function WorkflowsListPage() {
  const { user: me } = useSession();
  const { grants } = useSession();
  const { visibleWorkflows: wfs } = useSession();
  const { visibleCompanies: companies } = useSession();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('all');
  const [status, setStatus] = useState('all');
  const [trigger, setTrigger] = useState('all');
  const [sort, setSort] = useState<'health' | 'runs' | 'updated' | 'name'>('health');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return wfs
      .filter((w) => (company === 'all' ? true : w.companyId === company))
      .filter((w) => (status === 'all' ? true : status === 'failing' ? w.stats.lastStatus === 'error' : status === 'active' ? w.active && w.stats.lastStatus !== 'error' : !w.active))
      .filter((w) => (trigger === 'all' ? true : w.trigger.kind === trigger))
      .filter((w) => !ql || w.name.toLowerCase().includes(ql) || w.description.toLowerCase().includes(ql) || w.tags.some((t) => t.includes(ql)))
      .sort((a, b) => {
        if (sort === 'health') return workflowHealth(a) - workflowHealth(b) || b.stats.runs7d - a.stats.runs7d;
        if (sort === 'runs') return b.stats.runs7d - a.stats.runs7d;
        if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
        return a.name.localeCompare(b.name);
      });
  }, [wfs, q, company, status, trigger, sort]);

  return (
    <>
      <PageHeader
        title="Workflows"
        lede="Every workflow you can reach, with its health, runs and open issues."
        actions={<ViewSwitcher value="list" />}
      />

      <div className={s.filters}>
        <label className={s.searchBox}>
          <Search />
          <input placeholder="Filter by name, description or tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className={s.select}>
          <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company">
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName}
              </option>
            ))}
          </select>
          <ChevronDown />
        </span>
        <span className={s.select}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="failing">Failing</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown />
        </span>
        <span className={s.select}>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} aria-label="Trigger">
            <option value="all">Any trigger</option>
            {(Object.keys(TRIGGER_LABEL) as TriggerKind[]).map((k) => (
              <option key={k} value={k}>
                {TRIGGER_LABEL[k]}
              </option>
            ))}
          </select>
          <ChevronDown />
        </span>
        <span className={s.spacer} />
        <span className={s.count}>{rows.length} shown</span>
        <span className={s.select}>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="health">Sort: needs attention</option>
            <option value="runs">Sort: most runs</option>
            <option value="updated">Sort: recently updated</option>
            <option value="name">Sort: name</option>
          </select>
          <ChevronDown />
        </span>
      </div>

      <Card>
        <CardBody flush>
          <div className={s.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Company</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Runs · 7d</th>
                <th className={ui.num}>Success</th>
                <th>Health</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const c = COMPANIES.find((x) => x.id === w.companyId)!;
                const sev = worstSeverity(w);
                const by = USERS.find((u) => u.id === w.updatedById);
                const role = roleForWorkflow(me.id, w, grants);
                return (
                  <tr key={w.id} className="clickable" onClick={() => setOpen(w.id)}>
                    <td>
                      <div className={s.wfCell}>
                        <NodeIcon type={w.trigger.nodeTypeId} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div className={s.wfName}>
                            {w.name}
                            {w.shared && <span className={s.subtle} style={{ fontWeight: 450 }}> · shared</span>}
                            {w.calls.length > 0 && (
                              <span className={s.subtle} style={{ fontWeight: 450, display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6 }} title={`Triggers ${w.calls.length} workflow${w.calls.length === 1 ? '' : 's'}`}>
                                <WorkflowIcon size={11} /> {w.calls.length}
                              </span>
                            )}
                          </div>
                          <div className={s.wfDesc}>{w.description}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CompanyChip company={c} />
                    </td>
                    <td className={s.muted} style={{ whiteSpace: 'nowrap', maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis' }} title={w.trigger.label}>{w.trigger.label}</td>
                    <td>
                      <Badge tone={!w.active ? 'neutral' : w.stats.lastStatus === 'error' ? 'danger' : 'success'} dot>
                        {!w.active ? 'Inactive' : w.stats.lastStatus === 'error' ? 'Failing' : w.stats.lastStatus === 'running' ? 'Running' : 'Active'}
                      </Badge>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Bars data={w.stats.series7d} failures={w.stats.failures7d} width={56} height={20} />
                        <span className="tnum" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', minWidth: 30 }}>{fmtCompact(w.stats.runs7d)}</span>
                      </span>
                    </td>
                    <td className={ui.num} style={{ color: w.stats.successRate < 0.95 ? 'var(--danger-fg)' : undefined }}>{fmtPct(w.stats.successRate, 0)}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <HealthRing score={workflowHealth(w)} size={26} stroke={3} showLabel={false} />
                        {sev && <SeverityIcon severity={sev} size={13} />}
                        {w.issues.length > 0 && <span className="tnum" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{w.issues.length}</span>}
                      </span>
                    </td>
                    <td className={s.muted} style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {by && <Avatar user={by} size={18} />}
                        {relTime(w.updatedAt)}
                        {role === 'viewer' && <span className={s.subtle}>· view only</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className={ui.empty}>
                    No workflows match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </CardBody>
      </Card>

      {open && (
        <Modal open onClose={() => setOpen(null)} title={<span className="sr-only">Workflow</span>} width={440}>
          <div style={{ margin: '-40px -20px -20px', height: 'min(80vh, 760px)' }}>
            <WorkflowPanel workflowId={open} onFocus={(id) => setOpen(id)} showOpenCanvas showOpenGraph />
          </div>
        </Modal>
      )}
      <span className="sr-only">{SEVERITY_RANK.critical}</span>
    </>
  );
}
