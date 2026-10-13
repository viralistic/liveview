import type { Company, TriggerKind } from '../../data/types';
import type { SourceKind } from '../../lib/layout';
import { HEALTH_COLOR, HEALTH_LABEL, TRIGGER_COLOR, TRIGGER_LABEL, type ColorMode, type GraphStats } from './model';
import s from './graph.module.css';

const TRIGGER_ORDER: TriggerKind[] = ['webhook', 'schedule', 'app', 'called', 'error', 'manual', 'chat'];

export function Legend({
  mode,
  companies,
  hidden,
  stats,
  triggerKinds,
  sourceKinds,
  hasFailing,
  hasIssues,
  heatmap,
}: {
  mode: ColorMode;
  companies: Company[];
  hidden: Set<string>;
  stats: GraphStats;
  triggerKinds: TriggerKind[];
  sourceKinds: SourceKind[];
  hasFailing: boolean;
  hasIssues: boolean;
  heatmap: boolean;
}) {
  const colorItems: { key: string; color: string; label: string }[] =
    mode === 'company'
      ? companies.filter((c) => !hidden.has(c.id)).map((c) => ({ key: c.id, color: c.color, label: c.shortName }))
      : mode === 'health'
        ? (['good', 'warn', 'bad'] as const).map((t) => ({ key: t, color: HEALTH_COLOR[t], label: HEALTH_LABEL[t] }))
        : TRIGGER_ORDER.filter((k) => triggerKinds.includes(k)).map((k) => ({ key: k, color: TRIGGER_COLOR[k], label: TRIGGER_LABEL[k] }));

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className={s.legend} role="note" aria-label="Legend">
      <div className={s.stats}>
        <span>{plural(stats.workflows, 'workflow', 'workflows')}</span>
        <i />
        <span>{plural(stats.connections, 'connection', 'connections')}</span>
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
        {hasFailing && (
          <div className={s.legendItem}>
            <span className={s.glyph}>
              <span className={s.legendFail} />
            </span>
            Failing right now
          </div>
        )}
        {heatmap && hasIssues && (
          <div className={s.legendItem}>
            <span className={s.glyph}>
              <span className={s.legendHalo} />
            </span>
            Has open issues
          </div>
        )}
      </div>
    </div>
  );
}
