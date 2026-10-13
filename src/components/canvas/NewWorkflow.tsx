/**
 * "+ New workflow": a pink pill with a small liquid-glass popover. Creating
 * only produces a temporary draft (local state) in the view that owns it.
 * Shared by the canvas and the graph.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import type { Company, Product, Workflow } from '../../data/types';
import { PRODUCTS, productById } from '../../data/products';
import { toast } from '../../stores/session';
import { Button } from '../ui/Button';
import { ProductTag } from '../ui/ProductTag';
import s from './newWorkflow.module.css';

export interface NewWorkflowDraft {
  name: string;
  companyId: string;
  product?: Product;
}

export const DRAFT_PREFIX = 'draft-';
export const isDraft = (wf: Pick<Workflow, 'id'>) => wf.id.startsWith(DRAFT_PREFIX);

let seq = 0;
/** A temporary Workflow object so every view can render the draft like a real one. */
export function draftWorkflow(d: NewWorkflowDraft, ownerId: string): Workflow {
  const now = new Date().toISOString();
  const p = d.product;
  return {
    id: `${DRAFT_PREFIX}${Date.now().toString(36)}-${++seq}`,
    slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: d.name,
    companyId: d.companyId,
    description: p ? `Instance of the ${p.name} product. Not deployed yet.` : 'Draft workflow. Not deployed yet.',
    trigger: p ? p.trigger : { kind: 'manual', label: 'Manual', nodeTypeId: 'manual' },
    active: false,
    nodes: p ? p.nodes : [{ id: 't', type: 'manual', name: 'Start', col: 0, row: 0 }],
    connections: p ? p.connections : [],
    calls: [],
    tags: ['draft'],
    ownerId,
    updatedAt: now,
    updatedById: ownerId,
    version: 1,
    credentialIds: [],
    stats: { runs7d: 0, runs24h: 0, failed7d: 0, failed24h: 0, successRate: 1, avgDurationMs: 0, p95DurationMs: 0, lastRunAt: now, lastStatus: 'success', series7d: new Array(28).fill(0), failures7d: new Array(28).fill(0) },
    issues: [],
    productId: p?.id,
  };
}

export function NewWorkflowButton({ companies, defaultCompanyId, onCreate }: { companies: Company[]; defaultCompanyId?: string | null; onCreate: (draft: NewWorkflowDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const effectiveCompany = companies.some((c) => c.id === companyId) ? companyId : companies.some((c) => c.id === defaultCompanyId) ? defaultCompanyId! : (companies[0]?.id ?? '');
  const product = productId ? productById(productId) : undefined;

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const n = name.trim() || (product ? product.name : '');
    if (!n || !effectiveCompany) return;
    onCreate({ name: n, companyId: effectiveCompany, product });
    toast('Created in n8n (demo)');
    setOpen(false);
    setName('');
    setProductId('');
  };

  return (
    <div ref={wrapRef} className={s.wrap} data-ui>
      {open && (
        <form className={s.pop} role="dialog" aria-label="New workflow" onSubmit={submit} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
          <div className={s.head}>
            <span className={s.title}>New workflow</span>
            <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close">
              <X />
            </button>
          </div>
          <label className={s.field}>
            <span className={s.label}>Name</span>
            <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder={product ? product.name : 'e.g. Lead intake'} autoFocus autoComplete="off" spellCheck={false} />
          </label>
          <label className={s.field}>
            <span className={s.label}>Project</span>
            <span className={s.selectWrap}>
              <select className={s.select} value={effectiveCompany} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </select>
              <ChevronDown />
            </span>
          </label>
          <label className={s.field}>
            <span className={s.label}>
              Start from a product
              {product && <ProductTag name={product.name} size="sm" />}
            </span>
            <span className={s.selectWrap} data-product={!!product}>
              <select className={s.select} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Blank workflow</option>
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · v{p.version}
                  </option>
                ))}
              </select>
              <ChevronDown />
            </span>
          </label>
          <div className={s.hint}>{product ? `${product.tagline} Updates to the product roll out to this instance.` : 'Starts with a manual trigger. You build the rest in n8n.'}</div>
          <div className={s.foot}>
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit" disabled={!(name.trim() || product) || !effectiveCompany}>
              Create
            </Button>
          </div>
        </form>
      )}
      <button type="button" className={s.btn} data-open={open} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
        <Plus /> New workflow
      </button>
    </div>
  );
}
