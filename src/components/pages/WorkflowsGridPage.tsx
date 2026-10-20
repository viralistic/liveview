import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COMPANIES, productById } from '../../data';
import { useSession } from '../../stores/session';
import { fmtCompact, fmtPct } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { NodeIcon } from '../ui/NodeIcon';
import { ProductTag } from '../ui/ProductTag';
import { Bars } from '../ui/Sparkline';
import { PageHeader, ViewSwitcher } from './shared';
import s from './pages.module.css';

/** Workflows as cards. Click one to open it on the canvas. */
export function WorkflowsGridPage() {
  const { visibleWorkflows: wfs, visibleCompanies: companies } = useSession();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('all');
  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return wfs.filter((w) => (company === 'all' ? true : w.companyId === company)).filter((w) => !ql || w.name.toLowerCase().includes(ql));
  }, [wfs, q, company]);
  return (
    <>
      <PageHeader title="Workflows" lede="Every workflow you can reach, as cards you can filter and pin." actions={<ViewSwitcher value="grid" />} />
      <div className={s.filters}>
        <label className={s.searchBox}>
          <Search />
          <input placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
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
        <span className={s.spacer} />
        <span className={s.count}>{rows.length}</span>
      </div>
      <div className={s.gridCards}>
        {rows.map((w) => {
          const c = COMPANIES.find((x) => x.id === w.companyId)!;
          const product = w.productId ? productById(w.productId) : undefined;
          const breaking = w.issues.some((i) => i.severity === 'critical');
          return (
            <a key={w.id} href={`/workflows/canvas?focus=${w.id}`} className={s.wfCard} data-product={!!product}>
              <div className={s.wfCardTop}>
                <NodeIcon type={w.trigger.nodeTypeId} size={30} />
                <div className={s.wfCardName}>{w.name}</div>
                <Badge tone={!w.active ? 'neutral' : w.stats.lastStatus === 'error' ? 'danger' : 'success'} dot size="sm">
                  {!w.active ? 'Off' : w.stats.lastStatus === 'error' ? 'Failing' : 'Active'}
                </Badge>
              </div>
              <Bars data={w.stats.series7d} failures={w.stats.failures7d} width={300} height={28} color="var(--track-strong)" failColor="var(--accent)" />
              <div className={s.wfCardFoot}>
                <span>
                  {c.shortName} · {fmtCompact(w.stats.runs7d)} runs · {fmtPct(w.stats.successRate, 0)}
                </span>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {breaking && <span className={s.companyCritical}>breaking</span>}
                  {product && <ProductTag name={product.name} size="sm" />}
                </span>
              </div>
            </a>
          );
        })}
      </div>
      {rows.length === 0 && (
        <Card>
          <div className={s.calm}>No workflows match.</div>
        </Card>
      )}
    </>
  );
}
