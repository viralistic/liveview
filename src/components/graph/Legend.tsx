import { useState } from 'react';
import type { Company, TriggerKind } from '../../data/types';
import type { SourceKind } from '../../lib/layout';
import { SEVERITY_HEX } from '../../lib/health';
import { HEALTH_COLOR, HEALTH_LABEL, TRIGGER_COLOR, TRIGGER_LABEL, type ColorMode, type GraphStats } from './model';
import s from './graph.module.css';

const TRIGGER_ORDER: TriggerKind[] = ['webhook', 'schedule', 'app', 'called', 'error', 'manual', 'chat'];

/** Hidden by default: a small pill that reveals the legend on hover; `?` pins it. */
export function Legend({
  mode,
  companies,
  hidden,
  stats,
  triggerKinds,
  sourceKinds,
  hasFailing,
  hasBreaking,
  hasWasteful,
  hasProducts,
  heatmap,
  pinned,
  onPin,
}: {
  mode: ColorMode;
  companies: Company[];
  hidden: Set<string>;
  stats: GraphStats;
  triggerKinds: TriggerKind[];
  sourceKinds: SourceKind[];
  hasFailing: boolean;
  hasBreaking: boolean;
  hasWasteful: boolean;
  hasProducts: boolean;
  heatmap: boolean;
  pinned: boolean;
  onPin: (v: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  const open = hover || pinned;
  const colorItems: { key: string; color: string; label: string }[] =
    mode === 'company'
      ? companies.filter((c) => !hidden.has(c.id)).map((c) => ({ key: c.id, color: c.color, label: c.shortName }))
      : mode === 'health'
        ? (['good', 'mid', 'low'] as const).map((t) => ({ key: t, color: HEALTH_COLOR[t], label: HEALTH_LABEL[t] }))
        : TRIGGER_ORDER.filter((k) => triggerKinds.includes(k)).map((k) => ({ key: k, color: TRIGGER_COLOR[k], label: TRIGGER_LABEL[k] }));

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className={s.legendWrap} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      {open && (
        <div className={s.legend} role="note" aria-label="Legend">
          <div className={s.stats}>
            <span>{plural(stats.workflows, 'workflow', 'workflows')}</span>
            <i />
            <span>{plural(stats.connections, 'thread', 'threads')}</span>
            <i />
            <span>{stats.isolated} isolated</span>
            {stats.hiddenByFilter > 0 && (
              <>
                <i />
                <span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>{stats.hiddenByFilter} hidden</span>
              </>
            )}
          </div>
          <div className={s.legendGrid}>
            {colorItems.map((it) => (
              <div key={it.key} className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendDot} style={{ background: it.color }} />
                </span>
                <b>{it.label}</b>
              </div>
            ))}
            {stats.connections > 0 && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendThread} />
                </span>
                Data flowing between workflows
              </div>
            )}
            {sourceKinds.length > 0 && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendHollow} />
                </span>
                Trigger source
              </div>
            )}
            {stats.isolated > 0 && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendIsolated} />
                </span>
                Isolated, no workflow links
              </div>
            )}
            {hasProducts && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendProduct} />
                </span>
                Product instance
              </div>
            )}
            {hasFailing && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendFail} />
                </span>
                Failing right now
              </div>
            )}
            {heatmap && hasBreaking && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendHalo} style={{ ['--halo' as string]: `color-mix(in srgb, ${SEVERITY_HEX.critical} 35%, transparent)` }} />
                </span>
                Breaking finding
              </div>
            )}
            {heatmap && hasWasteful && (
              <div className={s.legendItem}>
                <span className={s.glyph}>
                  <span className={s.legendHalo} style={{ ['--halo' as string]: `color-mix(in srgb, ${SEVERITY_HEX.inefficient} 35%, transparent)` }} />
                </span>
                Wasteful finding
              </div>
            )}
          </div>
        </div>
      )}
      <button type="button" className={s.legendPill} data-on={open} onClick={() => onPin(!pinned)} aria-expanded={open} aria-label="Legend">
        Legend <kbd>?</kbd>
      </button>
    </div>
  );
}
