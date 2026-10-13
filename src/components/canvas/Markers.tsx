/** Issue markers on the node that has the problem (zoomed in), with an explaining popover. */
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { ArrowUpRight } from 'lucide-react';
import type { Issue, Workflow } from '../../data/types';
import { SEVERITY_LABEL } from '../../data/types';
import { NODE_SIZE, nodeWorldPos, type WorldLayout } from '../../lib/layout';
import { SEVERITY_COLOR } from '../../lib/health';
import { relTime } from '../../lib/format';
import { SeverityIcon } from '../ui/SeverityIcon';
import { $markersVisible } from './viewport';
import s from './canvas.module.css';

export function Markers({ layout, workflows, onOpenPanel }: { layout: WorldLayout; workflows: Workflow[]; onOpenPanel: (workflowId: string) => void }) {
  const visible = useStore($markersVisible);
  const [open, setOpen] = useState<string | null>(null);
  if (!visible) return null;
  const items: { issue: Issue; wf: Workflow; x: number; y: number }[] = [];
  for (const wf of workflows) {
    const card = layout.cards[wf.id];
    if (!card) continue;
    for (const issue of wf.issues) {
      const node = wf.nodes.find((n) => n.id === issue.nodeId) ?? wf.nodes[0];
      if (!node) continue;
      const p = nodeWorldPos(card, node);
      items.push({ issue, wf, x: p.x + NODE_SIZE - 4, y: p.y + 4 });
    }
  }
  return (
    <>
      {items.map(({ issue, wf, x, y }) => (
        <div key={issue.id} className={s.anchor} style={{ left: x, top: y, zIndex: open === issue.id ? 2 : 1 }} data-ui data-issue={issue.id} onPointerEnter={() => setOpen(issue.id)} onPointerLeave={() => setOpen((v) => (v === issue.id ? null : v))}>
          <div className={s.markerWrap}>
            <span className={s.marker}>
              <SeverityIcon severity={issue.severity} size={12} filled />
            </span>
            {open === issue.id && (
              <div className={[s.pop, s.popIssue].join(' ')}>
                <div className={s.issueHead}>
                  <SeverityIcon severity={issue.severity} size={12} filled />
                  <div style={{ minWidth: 0 }}>
                    <div className={s.issueSev} style={{ color: SEVERITY_COLOR[issue.severity] }}>
                      {SEVERITY_LABEL[issue.severity]}
                    </div>
                    <div className={s.issueTitle}>{issue.title}</div>
                  </div>
                </div>
                <div className={s.issueDetail}>{issue.detail}</div>
                <div className={s.issueFix}>
                  <b>Fix:</b> {issue.suggestion}
                </div>
                <div className={s.issueImpact}>
                  <span>
                    {issue.impact} · {relTime(issue.detectedAt)}
                  </span>
                  <button type="button" className={s.linkBtn} onClick={() => onOpenPanel(wf.id)}>
                    View details <ArrowUpRight />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
