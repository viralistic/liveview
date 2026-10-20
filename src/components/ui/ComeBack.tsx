import type { Upcoming } from '../../lib/today';
import { companyShort, whenLabel } from '../../lib/today';

/**
 * "Today: ‘Call Lotte’ (Volkswagen). Come back tomorrow for ‘Fix the webhook’
 * and Thursday for ‘Quarterly review’." Reads well for any title.
 */
export function ComeBack({ items, company = true }: { items: Upcoming[]; company?: boolean }) {
  if (!items.length) return null;
  const today = items.filter((u) => whenLabel(u.at) === 'today');
  const later = items.filter((u) => whenLabel(u.at) !== 'today');
  const one = (u: Upcoming, withWhen: boolean) => (
    <span key={u.title + u.at}>
      {withWhen && (
        <>
          <b>{whenLabel(u.at)}</b> for{' '}
        </>
      )}
      ‘{u.title}’{company && u.companyId ? ` (${companyShort(u.companyId)})` : ''}
    </span>
  );
  const join = (nodes: React.ReactNode[]) => nodes.map((n, i) => <span key={i}>{i > 0 && (i === nodes.length - 1 ? ' and ' : ', ')}{n}</span>);
  return (
    <>
      {today.length > 0 && (
        <>
          {' '}
          <b>Today</b>: {join(today.map((u) => one(u, false)))}.
        </>
      )}
      {later.length > 0 && <> Come back {join(later.map((u) => one(u, true)))}.</>}
    </>
  );
}
