/** Floating zoom-context pill: All companies › Volkswagen › Dealer lead routing. Each crumb fits that level. */
import { useStore } from '@nanostores/react';
import { ChevronRight, Workflow as WorkflowIcon } from 'lucide-react';
import type { Company, Workflow } from '../../data/types';
import type { WorldLayout } from '../../lib/layout';
import { intersectArea, rectContains } from './geometry';
import { $viewport, type ViewportController } from './viewport';
import type { Selection } from './types';
import s from './canvas.module.css';

export interface Context {
  companyId: string | null;
  workflowId: string | null;
}

/** What the camera is looking at: section under the centre, card covering ≥40% (or selected). */
export function deriveContext(ctrl: ViewportController, layout: WorldLayout, selection: Selection, visibleIds: ReadonlySet<string>): Context {
  const center = ctrl.center();
  let workflowId = selection?.kind === 'workflow' ? selection.id : null;
  if (!workflowId) {
    const vis = ctrl.visibleRect();
    const area = vis.w * vis.h;
    for (const card of Object.values(layout.cards)) {
      if (!visibleIds.has(card.workflowId)) continue;
      const ix = Math.min(card.x + card.w, vis.x + vis.w) - Math.max(card.x, vis.x);
      const iy = Math.min(card.y + card.h, vis.y + vis.h) - Math.max(card.y, vis.y);
      if (ix <= 0 || iy <= 0) continue;
      if (intersectArea(card, vis) / area >= 0.4 || (ix / vis.w >= 0.5 && iy / vis.h >= 0.25)) {
        workflowId = card.workflowId;
        break;
      }
    }
  }
  let companyId: string | null = null;
  if (workflowId) companyId = layout.cards[workflowId]?.companyId ?? null;
  else if (selection?.kind === 'section') companyId = selection.companyId;
  else companyId = layout.sections.find((sec) => rectContains(sec, center))?.companyId ?? null;
  return { companyId, workflowId };
}

export function Breadcrumb({ ctrl, layout, selection, visibleIds, companyById, workflowById, onFitAll, onFitSection, onFitWorkflow }: { ctrl: ViewportController; layout: WorldLayout; selection: Selection; visibleIds: ReadonlySet<string>; companyById: ReadonlyMap<string, Company>; workflowById: ReadonlyMap<string, Workflow>; onFitAll: () => void; onFitSection: (id: string) => void; onFitWorkflow: (id: string) => void }) {
  useStore($viewport); // re-derive on every camera change
  const ctx = deriveContext(ctrl, layout, selection, visibleIds);
  const company = ctx.companyId ? companyById.get(ctx.companyId) : undefined;
  const wf = ctx.workflowId ? workflowById.get(ctx.workflowId) : undefined;
  const level = wf ? 2 : company ? 1 : 0;
  return (
    <nav className={s.crumbs} data-ui aria-label="Zoom context">
      <button type="button" className={s.crumb} data-current={level === 0} onClick={onFitAll}>
        All companies
      </button>
      {company && (
        <>
          <ChevronRight className={s.crumbSep} />
          <button type="button" className={s.crumb} data-current={level === 1} onClick={() => onFitSection(company.id)}>
            <span className={s.crumbMark} aria-hidden="true">
              {company.initials}
            </span>
            {company.shortName}
          </button>
        </>
      )}
      {wf && (
        <>
          <ChevronRight className={s.crumbSep} />
          <button type="button" className={s.crumb} data-current={level === 2} onClick={() => onFitWorkflow(wf.id)}>
            <WorkflowIcon size={13} style={{ color: 'var(--text-subtle)', flex: 'none' }} />
            {wf.name}
          </button>
        </>
      )}
    </nav>
  );
}
