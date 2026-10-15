import { ROUTE_LABEL, SIZE_LABEL } from '../../data';
import { relTime } from '../../lib/format';
import type { Signal } from '../../stores/signals';
import { Badge } from '../ui/Badge';
import { CompanyMark } from '../ui/CompanyMark';
import { SeverityIcon } from '../ui/SeverityIcon';
import { SignalActions, SignalStateChip } from './SignalButton';
import type { Incident } from './incidents';
import v from './vendor.module.css';

/**
 * One incident. As a list item (with onSelect) the whole row is a button and
 * carries no nested controls; as an overview row it links out and shows the actions.
 */
export function IncidentRow({ inc, signal, selected, onSelect }: { inc: Incident; signal?: Signal; selected?: boolean; onSelect?: () => void }) {
  const { issue, wf, company } = inc;
  const meta = (
    <div className={v.incidentMeta}>
      <CompanyMark company={company} size={16} />
      <b>{company.shortName}</b>
      <Badge tone="neutral" size="sm" title={`${company.employees.toLocaleString('en-US')} people`}>
        {SIZE_LABEL[company.size]}
      </Badge>
      <span className={v.routeTag} data-route={company.route}>
        {ROUTE_LABEL[company.route]}
      </span>
    </div>
  );
  const impact = (
    <div className={v.incidentImpact}>
      {onSelect ? <b>{wf.name}</b> : <a href={`/workflows/canvas?focus=${wf.id}`}><b>{wf.name}</b></a>}
      <span>·</span>
      {issue.impact}
      <span>· {relTime(issue.detectedAt)}</span>
    </div>
  );

  if (onSelect) {
    return (
      <button type="button" className={v.incident} data-selected={selected} onClick={onSelect} aria-pressed={selected}>
        <SeverityIcon severity={issue.severity} size={13} filled />
        <div className={v.incidentMain}>
          <div className={v.incidentTitle}>{issue.action}</div>
          {meta}
          {impact}
        </div>
        <div className={v.incidentActions}>{signal && <SignalStateChip signal={signal} />}</div>
      </button>
    );
  }
  return (
    <div className={v.incident}>
      <SeverityIcon severity={issue.severity} size={13} filled />
      <div className={v.incidentMain}>
        <div className={v.incidentTitle}>{issue.action}</div>
        {meta}
        {impact}
        {signal && <div className={v.sigNote}>{signal.note}</div>}
      </div>
      <div className={v.incidentActions}>
        <SignalActions incident={inc} />
      </div>
    </div>
  );
}
