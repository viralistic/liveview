import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, GitFork, Star } from 'lucide-react';
import type { Product } from '../../data/types';
import { companyById } from '../../data/companies';
import { productCategory } from '../../data/products';
import { canSeeCompany } from '../../lib/access';
import { useSession } from '../../stores/session';
import { useProductSummary } from '../../stores/forks';
import { CompanyMark } from '../ui/CompanyMark';
import { LiveGraph } from './LiveGraph';
import s from './products.module.css';

/** Hover tip rendered on document.body: the card lifts on hover (a transform), which would clip a fixed tip inside it. */
function CardTip({ label, children }: { label: ReactNode; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (e: MouseEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top - 8 });
  };
  return (
    <span className={s.cardTipWrap} onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      {children}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span className={s.cardTip} style={{ left: pos.x, top: pos.y }} role="tooltip">
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** Unique companies running a product, in instance order. */
export function productCompanyIds(product: Product): string[] {
  const out: string[] = [];
  for (const i of product.instances) if (!out.includes(i.companyId)) out.push(i.companyId);
  return out;
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { userId, grants } = useSession();
  const { forkCount, forkNames, version, stars } = useProductSummary(product);
  const companyIds = productCompanyIds(product);
  const visible = companyIds.filter((id) => canSeeCompany(userId, id, grants));
  const hidden = companyIds.length - visible.length;
  const category = productCategory(product.category);
  const usedTitle = visible.map((id) => companyById(id).shortName).join(', ') + (hidden ? ` and ${hidden} more` : '');
  const forkTip = (
    <span className={s.tipList}>
      <span className={s.tipLine}>
        <b>{forkCount === 0 ? 'No forks yet' : `${forkCount} ${forkCount === 1 ? 'fork' : 'forks'}`}</b>
      </span>
      {forkNames.slice(0, 6).map((n) => (
        <span key={n} className={s.tipLine}>
          {n}
        </span>
      ))}
      {forkNames.length > 6 && <span className={s.tipLine}>and {forkNames.length - 6} more</span>}
    </span>
  );

  return (
    <a href={`/products/${product.slug}`} className={s.card} style={{ '--i': index } as CSSProperties} aria-label={`${product.name} · ${product.tagline}`}>
      <div className={s.cardTop}>
        <span className={s.cardEyebrow}>{category.label}</span>
        <span className={s.cardStats}>
          <CardTip label={forkTip}>
            <span className={s.cardStat} aria-label={`${forkCount} forks`}>
              <GitFork />
              {forkCount}
            </span>
          </CardTip>
          <span className={s.cardStat} title={`${stars} stars`}>
            <Star />
            {stars}
          </span>
          <span className={s.version} title={`Version ${version}`}>
            <Box />v{version}
          </span>
        </span>
      </div>
      <div className={s.cardGraph}>
        <LiveGraph nodes={product.nodes} connections={product.connections} variant="card" maxHeight={172} />
      </div>
      <div className={s.cardFoot}>
        <div className={s.cardText}>
          <div className={s.cardName}>{product.name}</div>
          <div className={s.cardTagline}>{product.tagline}</div>
        </div>
        {companyIds.length === 0 ? (
          <span className={s.notDeployed}>Not deployed yet</span>
        ) : (
          <span className={s.marks} title={`Used in ${usedTitle}`}>
            {visible.map((id) => (
              <CompanyMark key={id} company={companyById(id)} size={20} />
            ))}
            {hidden > 0 && <span className={s.more}>+{hidden}</span>}
          </span>
        )}
      </div>
    </a>
  );
}
