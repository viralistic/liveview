import { memo } from 'react';
import { Share2, UsersRound } from 'lucide-react';
import type { Company, User, Workflow } from '../../data/types';
import type { SectionLayout } from '../../lib/layout';
import { CARD_W } from '../../lib/layout';
import { sourceRoute } from './geometry';
import { SEVERITY_HEX, companyHealth, worstSeverity } from '../../lib/health';
import { openShare } from '../../stores/session';
import { AvatarGroup } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { WorkflowCard } from './WorkflowCard';
import type { Tier } from './viewport';
import s from './canvas.module.css';

export interface SectionProps {
  section: SectionLayout;
  company: Company;
  workflows: Workflow[];
  visibleIds: ReadonlySet<string>;
  members: User[];
  ownerById: ReadonlyMap<string, User>;
  canManage: boolean;
  askName?: string;
  tier: Tier;
  selected: boolean;
  selectedWf: string | null;
  heat: boolean;
  showSources: boolean;
}

/* The hue is huge on purpose: 2.5 card widths across, soft falloff, low peak so text stays readable. */
const HEAT_RX = CARD_W * 1.25;
const HEAT_RY = CARD_W * 0.68;
/** Breaking is red, wasteful is orange. Minor findings get no hue (they show as a quiet marker when zoomed in). */
const HEAT_OPACITY: Partial<Record<keyof typeof SEVERITY_HEX, number>> = { critical: 0.28, inefficient: 0.22 };

export const Section = memo(function Section({ section, company, workflows, visibleIds, members, ownerById, canManage, askName, tier, selected, selectedWf, heat, showSources }: SectionProps) {
  const visibleCount = workflows.filter((w) => visibleIds.has(w.id)).length;
  const health = companyHealth(company.id);
  return (
    <div className={s.section} data-section={company.id} data-selected={selected} data-tier={tier} style={{ left: section.x, top: section.y, width: section.w, height: section.h }}>
      <div className={[s.sectionLabel, s.csBL].join(' ')} data-section-label={company.id}>
        <span className={s.sectionMark} aria-hidden="true">
          {company.initials}
        </span>
        <span className={s.sectionName}>{company.shortName}</span>
        <span className={s.sectionMeta}>
          {visibleCount < workflows.length ? `${visibleCount} of ${workflows.length}` : workflows.length} workflows · health <b>{health}</b>
        </span>
        <AvatarGroup users={members} size={20} max={4} />
      </div>
      <div className={[s.sectionActions, s.csBL].join(' ')} data-ui>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => openShare({ kind: 'company', companyId: company.id })}>
            <UsersRound /> Manage access
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => openShare({ kind: 'company', companyId: company.id })}>
          <Share2 /> Share
        </Button>
      </div>
      <div className={s.heatLayer} aria-hidden="true">
        {section.cards.map((card) => {
          const wf = workflows.find((w) => w.id === card.workflowId);
          if (!wf || !visibleIds.has(wf.id)) return null;
          const worst = worstSeverity(wf);
          const o = worst ? HEAT_OPACITY[worst] : undefined;
          if (!worst || !o) return null;
          return (
            <div
              key={`heat-${wf.id}`}
              className={s.heat}
              data-on={heat}
              style={{ ['--heat' as string]: SEVERITY_HEX[worst], ['--heat-o' as string]: o, left: card.x + card.w / 2 - HEAT_RX - section.x, top: card.y + card.h / 2 - HEAT_RY - section.y, width: HEAT_RX * 2, height: HEAT_RY * 2 }}
            />
          );
        })}
      </div>
      {showSources && (
        <svg className={s.sectionSvg} aria-hidden="true">
          {section.sources.flatMap((src) =>
            src.workflowIds.map((id) => {
              const wf = workflows.find((w) => w.id === id);
              const card = section.cards.find((c) => c.workflowId === id);
              if (!wf || !card || !visibleIds.has(id)) return null;
              const route = sourceRoute({ ...src, x: src.x - section.x, y: src.y - section.y }, { ...card, x: card.x - section.x, y: card.y - section.y }, wf);
              const eid = `s-${src.id.replace(':', '-')}-${id}`;
              const dur = Math.min(7, Math.max(2.4, route.len / 260));
              return (
                <g key={eid}>
                  <path id={eid} className={s.srcEdge} d={route.d} />
                  {wf.active && (
                    <g>
                      <animateMotion dur={`${dur.toFixed(2)}s`} repeatCount="indefinite" begin={`-${(dur * 0.37).toFixed(2)}s`}>
                        <mpath href={`#${eid}`} />
                      </animateMotion>
                      <circle className={[s.dot, s.srcDot].join(' ')} r={2.6} />
                    </g>
                  )}
                </g>
              );
            }),
          )}
        </svg>
      )}
      {section.cards.map((card) => {
        const wf = workflows.find((w) => w.id === card.workflowId);
        if (!wf) return null;
        const locked = !visibleIds.has(wf.id);
        return <WorkflowCard key={wf.id} card={card} origin={section} wf={wf} company={company} owner={ownerById.get(wf.ownerId)} tier={tier} selected={selectedWf === wf.id} locked={locked} askName={askName} />;
      })}
    </div>
  );
});
