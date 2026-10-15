import { useEffect, useMemo, useState } from 'react';
import { Check, Server, Sparkles } from 'lucide-react';
import { ROUTE_LABEL, SEVERITY_LABEL, SIZE_LABEL, USERS, nodeType, orgOfUser, projectFor } from '../../data';
import { useSession } from '../../stores/session';
import { useClientStore, useSignals } from '../../stores/signals';
import { $proposals, proposalFor } from '../../stores/fixes';
import type { FixProposal } from '../../data/fixes';
import { relTime } from '../../lib/format';
import { NoAccess } from '../shell/NoAccess';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card, CardBody } from '../ui/Card';
import { CompanyMark } from '../ui/CompanyMark';
import { NodeIcon } from '../ui/NodeIcon';
import { Segmented } from '../ui/Segmented';
import { SeverityIcon } from '../ui/SeverityIcon';
import { PageHeader } from '../pages/shared';
import { IncidentRow } from './IncidentRow';
import { SignalActions } from './SignalButton';
import { STATE_LABEL, incidentState, incidentsFor, partnerOf, type Incident, type IncidentState } from './incidents';
import v from './vendor.module.css';

const NO_PROPOSALS: FixProposal[] = [];
const first = (name: string) => name.split(' ')[0]!;
const FIX_STATUS: Record<FixProposal['status'], string> = { proposed: 'proposed, waiting for review', accepted: 'accepted, applying in staging', applied: 'applied and tested in staging', rejected: 'rejected' };

/** Gate first, so the inner component keeps a stable hook order. */
export function IncidentsPage() {
  const { can } = useSession();
  if (!can('respond-incidents')) return <NoAccess cap="respond-incidents" />;
  return <IncidentsInner />;
}

type StateFilter = 'all' | IncidentState;
type SevFilter = 'all' | 'critical' | 'inefficient';

function IncidentsInner() {
  const { visibleCompanies: companies, visibleWorkflows: wfs, org } = useSession();
  const signals = useSignals();
  const proposals = useClientStore($proposals, NO_PROPOSALS);
  const all = useMemo(() => incidentsFor(companies, wfs), [companies, wfs]);
  const [state, setState] = useState<StateFilter>('all');
  const [sev, setSev] = useState<SevFilter>('all');
  const [instances, setInstances] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // deep links: /incidents?issue=<id> and /incidents?instance=<companyId>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const issue = q.get('issue');
    if (issue) setSelectedId(issue);
    const inst = q.get('instance');
    if (inst) setInstances([inst]);
  }, []);

  const filtered = all.filter((inc) => (sev === 'all' || inc.issue.severity === sev) && (instances.length === 0 || instances.includes(inc.company.id)) && (state === 'all' || incidentState(inc.issue.id, signals) === state));
  const selected = filtered.find((i) => i.issue.id === selectedId) ?? filtered[0];
  const select = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('issue', id);
    window.history.replaceState(null, '', url);
  };
  const toggleInstance = (id: string) => setInstances((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const countFor = (st: IncidentState) => all.filter((inc) => incidentState(inc.issue.id, signals) === st).length;

  return (
    <>
      <PageHeader
        title="Incidents"
      />

      <div className={v.filters}>
        <Segmented
          value={state}
          onChange={(id) => setState(id as StateFilter)}
          items={[
            { id: 'all', label: `All · ${all.length}` },
            { id: 'open', label: `${STATE_LABEL.open} · ${countFor('open')}` },
            { id: 'signalled', label: `${STATE_LABEL.signalled} · ${countFor('signalled')}` },
            { id: 'acknowledged', label: `${STATE_LABEL.acknowledged} · ${countFor('acknowledged')}` },
          ]}
        />
        {companies.map((c) => {
          const n = all.filter((inc) => inc.company.id === c.id).length;
          return (
            <button key={c.id} type="button" className={v.chipBtn} aria-pressed={instances.includes(c.id)} onClick={() => toggleInstance(c.id)} title={`${c.name} · ${ROUTE_LABEL[c.route]}`}>
              <CompanyMark company={c} size={16} />
              {c.shortName}
              <small>{n}</small>
            </button>
          );
        })}
        <Segmented
          value={sev}
          onChange={(id) => setSev(id as SevFilter)}
          items={[
            { id: 'all', label: 'Any severity' },
            { id: 'critical', label: SEVERITY_LABEL.critical },
            { id: 'inefficient', label: SEVERITY_LABEL.inefficient },
          ]}
        />
        <span className={v.count}>
          {filtered.length} of {all.length}
        </span>
      </div>

      <div className={v.split}>
        <Card>
          <CardBody flush>
            {filtered.length === 0 ? (
              <div className={v.empty}>
                <Check /> Nothing matches these filters.
              </div>
            ) : (
              filtered.map((inc) => {
                const sg = [...signals].reverse().find((x) => x.issueId === inc.issue.id);
                return <IncidentRow key={inc.issue.id} inc={inc} signal={sg} selected={selected?.issue.id === inc.issue.id} onSelect={() => select(inc.issue.id)} />;
              })
            )}
          </CardBody>
        </Card>
        {selected && <Detail inc={selected} proposal={proposalFor(selected.issue.id, proposals)} />}
      </div>
    </>
  );
}

function Detail({ inc, proposal }: { inc: Incident; proposal: FixProposal | undefined }) {
  const signals = useSignals();
  const { issue, wf, company } = inc;
  const node = issue.nodeId ? wf.nodes.find((n) => n.id === issue.nodeId) : undefined;
  const partner = partnerOf(company);
  const project = projectFor(company.id);
  const techOwner = project ? USERS.find((u) => u.id === project.technicalOwnerId) : undefined;
  const processOwner = project ? USERS.find((u) => u.id === project.processOwnerId) : undefined;
  const mine = signals.filter((sg) => sg.issueId === issue.id);
  const reviewer = proposal ? USERS.find((u) => u.id === proposal.reviewerId) : undefined;
  const now = new Date();

  return (
    <Card className={v.detail}>
      <div className={v.detailHead}>
        <SeverityIcon severity={issue.severity} size={14} filled />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={v.detailTitle}>{issue.action}</div>
          <div className={v.detailSub}>
            <CompanyMark company={company} size={14} />
            <b style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{company.shortName}</b>
            <Badge tone="neutral" size="sm">
              {SIZE_LABEL[company.size]}
            </Badge>
            <span className={v.routeTag} data-route={company.route}>
              {ROUTE_LABEL[company.route]}
            </span>
            <span>·</span>
            <a href={`/workflows/canvas?focus=${wf.id}`} style={{ color: 'var(--text-secondary)' }}>
              {wf.name}
            </a>
          </div>
        </div>
        <Badge tone={issue.severity === 'critical' ? 'danger' : 'neutral'}>{SEVERITY_LABEL[issue.severity]}</Badge>
      </div>

      <div className={v.section}>
        <div className={v.sectionLabel}>What n8n sees</div>
        <div className={v.sectionText}>
          <b>{issue.title}.</b> {issue.detail}
        </div>
        <div className={v.sectionText} style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
          {issue.impact} · detected {relTime(issue.detectedAt)}
        </div>
      </div>

      <div className={v.section}>
        <div className={v.sectionLabel}>Suggestion</div>
        <div className={v.sectionText}>{issue.suggestion}</div>
      </div>

      {node && (
        <div className={v.section}>
          <div className={v.sectionLabel}>Node</div>
          <div className={v.nodeRow}>
            <NodeIcon type={node.type} size={30} />
            <div style={{ minWidth: 0 }}>
              <b>{node.name}</b>
              <span>
                {nodeType(node.type).label}
                {node.note ? ` · ${node.note}` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={v.section}>
        <div className={v.sectionLabel}>Allocated partner</div>
        <div className={v.cardPeople}>
          {partner && (
            <span className={v.who}>
              <CompanyMark company={partner} size={18} />
              <b>{partner.shortName}</b> {ROUTE_LABEL[company.route].toLowerCase()}
            </span>
          )}
          {techOwner && (
            <span className={v.who}>
              <Avatar user={techOwner} size={18} />
              <b>{techOwner.name}</b> technical owner
            </span>
          )}
          {processOwner && (
            <span className={v.who}>
              <Avatar user={processOwner} size={18} />
              <b>{first(processOwner.name)}</b> process owner
            </span>
          )}
        </div>
        {company.route === 'self-hosted' && (
          <div className={v.localNote} style={{ marginBottom: 0 }}>
            <Server />
            <div>
              <b>Local host: n8n supports this instance directly.</b> Signals still go to {partner?.shortName ?? 'the partner'}, who build and run the project.
            </div>
          </div>
        )}
      </div>

      <div className={v.section}>
        <div className={v.sectionLabel}>Timeline</div>
        <ol className={v.timeline}>
          <li className={v.tl} data-kind="detected">
            <b>Detected</b> by n8n monitoring · {relTime(issue.detectedAt)}
          </li>
          {mine.length === 0 && (
            <li className={v.tl} data-kind="open">
              Not signalled yet.
            </li>
          )}
          {mine.map((sg) => {
            const by = USERS.find((u) => u.id === sg.byId);
            const to = sg.assigneeId ? USERS.find((u) => u.id === sg.assigneeId) : undefined;
            const notified = sg.notifiedId ? USERS.find((u) => u.id === sg.notifiedId) : undefined;
            const ackBy = sg.acknowledgedById ? USERS.find((u) => u.id === sg.acknowledgedById) : undefined;
            return (
              <li key={sg.id} style={{ display: 'contents' }}>
                <div className={v.tl} data-kind="signalled">
                  <b>Signalled</b> by {by ? by.name : 'n8n'}
                  {to ? ` to ${to.name} at ${orgOfUser(to).shortName}` : ''} · {relTime(sg.at, now)} · {sg.importance} importance ·{' '}
                  {sg.plannedAt ? `planned ${new Date(sg.plannedAt).toLocaleDateString('en-GB', { weekday: 'short' })} ${new Date(sg.plannedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'in the inbox'}
                  <div className={v.tlNote}>{sg.note}</div>
                  {notified && <div style={{ marginTop: 4 }}>Also notified {notified.name} ({notified.title}) by email.</div>}
                </div>
                {sg.status === 'acknowledged' && (
                  <div className={v.tl} data-kind="acknowledged">
                    <b>Acknowledged</b>
                    {ackBy ? ` by ${ackBy.name}` : ''} · {relTime(sg.acknowledgedAt ?? sg.at, now)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className={v.section}>
        <div className={v.sectionLabel}>Smart fix</div>
        {proposal ? (
          <div className={v.fixState}>
            <Sparkles />
            <div style={{ minWidth: 0 }}>
              <b>{proposal.summary}</b> · {FIX_STATUS[proposal.status]}
              {reviewer ? ` · reviewer ${first(reviewer.name)}` : ''}
            </div>
          </div>
        ) : (
          <div className={v.sectionText} style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
            No proposal yet.
          </div>
        )}
      </div>

      <div className={v.detailActions}>
        <SignalActions incident={inc} />
      </div>
    </Card>
  );
}
