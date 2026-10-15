import { useEffect, useState } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES } from '../../data/products';
import { forksOf } from '../../data/forks';
import type { ProductCategoryId } from '../../data/types';
import { $userForks, useForkStore } from '../../stores/forks';
import { PageHeader } from '../pages/shared';
import { ProductCard } from './ProductCard';
import s from './products.module.css';

type Filter = 'all' | ProductCategoryId;
const isFilter = (v: string | null): v is Filter => v === 'all' || PRODUCT_CATEGORIES.some((c) => c.id === v);

export function ProductsGallery() {
  const [filter, setFilter] = useState<Filter>('all');
  const userForks = useForkStore($userForks);

  // deep links: /products?category=marketing (read after mount so SSR and hydration agree)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('category');
    if (isFilter(q)) setFilter(q);
  }, []);
  const choose = (f: Filter) => {
    setFilter(f);
    const url = new URL(window.location.href);
    if (f === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', f);
    window.history.replaceState(null, '', url);
  };

  const list = filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);
  const pills: { id: Filter; label: string; count: number; title?: string }[] = [
    { id: 'all', label: 'All', count: PRODUCTS.length },
    ...PRODUCT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: PRODUCTS.filter((p) => p.category === c.id).length, title: c.description })),
  ];
  const current = PRODUCT_CATEGORIES.find((c) => c.id === filter);
  const totalForks = list.reduce((a, p) => a + forksOf(p.id, userForks).length, 0);

  return (
    <>
      <PageHeader title="Products" lede="Reusable automations. Update one, every project gets it." />

      <div className={s.filterRow}>
        <div className={s.pills} role="tablist" aria-label="Category">
          {pills.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === filter} className={s.pill} data-active={p.id === filter} onClick={() => choose(p.id)} title={p.title}>
              {p.label}
              <span className={s.pillCount}>{p.count}</span>
            </button>
          ))}
        </div>
        <span className={s.count}>
          {list.length} {list.length === 1 ? 'product' : 'products'} · {totalForks} {totalForks === 1 ? 'fork' : 'forks'}
          {current && <span className={s.countSub}> · {current.description}</span>}
        </span>
      </div>

      <div className={s.grid}>
        {list.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    </>
  );
}
