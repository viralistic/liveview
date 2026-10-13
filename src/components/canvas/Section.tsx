import { memo } from 'react';
import { Share2, UsersRound } from 'lucide-react';
import type { Company, User, Workflow } from '../../data/types';
import type { SectionLayout } from '../../lib/layout';
import { CARD_W } from '../../lib/layout';
import { SEVERITY_HEX, companyHealth, worstSeverity } from '../../lib/health';
import { openShare } from '../../stores/session';
import { AvatarGroup } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
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
}

const HEAT_R = CARD_W * 0.6;

export const Section = memo(function Section({ section, company, workflows, visibleIds, members, ownerById, canManage, askName, tier, selected, selectedWf, heat }: SectionProps) {
  const visibleCount = workflows.filter((w) => visibleIds.has(w.id)).length;
  const health = companyHealth(company.id);
  return (
    <div className={s.section} data-section={company.id} data-selected={selected} style={{ left: section.x, top: section.y, width: section.w, height: section.h }}>
      <div className={[s.sectionLabel, s.csBL].join(' ')} data-section-label={company.id}>
        <CompanyMark company={company} size={20} />
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
      {section.cards.map((card) => {
        const wf = workflows.find((w) => w.id === card.workflowId);
        if (!wf || !visibleIds.has(wf.id)) return null;
        const worst = worstSeverity(wf);
        if (!worst) return null;
        return (
          <div
            key={`heat-${wf.id}`}
            className={s.heat}
            data-on={heat}
            style={{ ['--heat' as string]: SEVERITY_HEX[worst], left: card.x + card.w / 2 - HEAT_R - section.x, top: card.y + card.h / 2 - HEAT_R - section.y, width: HEAT_R * 2, height: HEAT_R * 2 }}
          />
        );
      })}
      {section.cards.map((card) => {
        const wf = workflows.find((w) => w.id === card.workflowId);
        if (!wf) return null;
        const locked = !visibleIds.has(wf.id);
        return <WorkflowCard key={wf.id} card={card} origin={section} wf={wf} company={company} owner={ownerById.get(wf.ownerId)} tier={tier} selected={selectedWf === wf.id} locked={locked} askName={askName} />;
      })}
    </div>
  );
});
