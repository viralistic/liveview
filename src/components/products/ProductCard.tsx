import type { CSSProperties } from 'react';
import { Box } from 'lucide-react';
import type { Product } from '../../data/types';
import { companyById } from '../../data/companies';
import { productCategory } from '../../data/products';
import { canSeeCompany } from '../../lib/access';
import { useSession } from '../../stores/session';
import { CompanyMark } from '../ui/CompanyMark';
import { LiveGraph } from './LiveGraph';
import s from './products.module.css';

/** Unique companies running a product, in instance order. */
export function productCompanyIds(product: Product): string[] {
  const out: string[] = [];
  for (const i of product.instances) if (!out.includes(i.companyId)) out.push(i.companyId);
  return out;
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { userId, grants } = useSession();
  const companyIds = productCompanyIds(product);
  const visible = companyIds.filter((id) => canSeeCompany(userId, id, grants));
  const hidden = companyIds.length - visible.length;
  const category = productCategory(product.category);
  const usedTitle = visible.map((id) => companyById(id).shortName).join(', ') + (hidden ? ` and ${hidden} more` : '');

  return (
    <a href={`/products/${product.slug}`} className={s.card} style={{ '--i': index } as CSSProperties} aria-label={`${product.name} · ${product.tagline}`}>
      <div className={s.cardTop}>
        <span className={s.cardEyebrow}>{category.label}</span>
        <span className={s.version} title={`Version ${product.version}`}>
          <Box />v{product.version}
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
