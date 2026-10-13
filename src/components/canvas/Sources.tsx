import { memo } from 'react';
import { Clock, Globe, Mail, TriangleAlert } from 'lucide-react';
import type { SourceLayout } from '../../lib/layout';
import type { Tier } from './viewport';
import s from './canvas.module.css';

const ICONS = { internet: Globe, schedule: Clock, app: Mail, error: TriangleAlert } as const;

export const Sources = memo(function Sources({ sources, visibleIds, tier }: { sources: SourceLayout[]; visibleIds: ReadonlySet<string>; tier: Tier }) {
  const iconSize = tier === 'tiny' ? 0 : tier === 'compact' ? 11 : tier === 'mini' ? 18 : tier === 'mini2' ? 22 : 28;
  return (
    <>
      {sources.map((src) => {
        const count = src.workflowIds.filter((id) => visibleIds.has(id)).length;
        if (!count) return null;
        const Icon = ICONS[src.kind];
        return (
          <div key={src.id} className={s.source} data-kind={src.kind} data-tier={tier} style={{ left: src.x - src.r, top: src.y - src.r, width: src.r * 2, height: src.r * 2 }} title={src.label}>
            {iconSize > 0 && (
              <span className={[s.sourceIcon, s.csC].join(' ')}>
                <Icon strokeWidth={1.75} style={{ width: iconSize, height: iconSize }} />
              </span>
            )}
            <span className={s.sourceLabel}>
              {src.label}
              {tier !== 'tiny' && tier !== 'compact' && (
                <small>
                  {count} {count === 1 ? 'workflow' : 'workflows'}
                </small>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
});
