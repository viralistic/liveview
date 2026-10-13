/** Issue markers on the node that has the problem (zoomed in), with a minimal glass popover and the Smart fix flow. */
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { ArrowUpRight, Check } from 'lucide-react';
import type { Issue, Workflow } from '../../data/types';
import { NODE_SIZE, nodeWorldPos, type WorldLayout } from '../../lib/layout';
import { SEVERITY_WORD } from '../../lib/health';
import { relTime } from '../../lib/format';
import { $proposals, proposalFor } from '../../stores/fixes';
import { SeverityIcon } from '../ui/SeverityIcon';
import { SmartFix } from '../planner/SmartFix';
import { $markersVisible } from './viewport';
import s from './canvas.module.css';

export function Markers({ layout, workflows, onOpenPanel }: { layout: WorldLayout; workflows: Workflow[]; onOpenPanel: (workflowId: string) => void }) {
  const visible = useStore($markersVisible);
  const proposals = useStore($proposals);
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
      {items.map(({ issue, wf, x, y }) => {
        const proposal = proposalFor(issue.id, proposals);
        return (
          <div key={issue.id} className={s.anchor} style={{ left: x, top: y, zIndex: open === issue.id ? 2 : 1 }} data-ui data-issue={issue.id} onPointerEnter={() => setOpen(issue.id)} onPointerLeave={() => setOpen((v) => (v === issue.id ? null : v))}>
            <div className={s.markerWrap}>
              <span className={s.marker} title={`${SEVERITY_WORD[issue.severity]}: ${issue.action}`}>
                <SeverityIcon severity={issue.severity} size={12} filled />
                {proposal && (
                  <span className={s.markerFix} data-applied={proposal.status === 'applied'} title={proposal.status === 'applied' ? 'Smart fix applied' : 'Smart fix in flight'}>
                    {proposal.status === 'applied' && <Check size={8} strokeWidth={3.5} />}
                  </span>
                )}
              </span>
              {open === issue.id && (
                <div className={[s.pop, s.popIssue].join(' ')}>
                  <div className={s.issueHead}>
                    <SeverityIcon severity={issue.severity} size={12} filled />
                    <div style={{ minWidth: 0 }}>
                      <div className={s.issueSev} data-sev={issue.severity}>
                        {SEVERITY_WORD[issue.severity]}
                      </div>
                      <div className={s.issueTitle}>{issue.action}</div>
                    </div>
                  </div>
                  <div className={s.issueImpact}>
                    <span>
                      {issue.impact} · {relTime(issue.detectedAt)}
                    </span>
                    <button type="button" className={s.linkBtn} onClick={() => onOpenPanel(wf.id)}>
                      Details <ArrowUpRight />
                    </button>
                  </div>
                  <div className={s.issueSmart}>
                    <SmartFix issue={issue} compact />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
