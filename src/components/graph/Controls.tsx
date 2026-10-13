import { useState } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Company } from '../../data/types';
import { Segmented } from '../ui/Segmented';
import type { ColorMode } from './model';
import s from './graph.module.css';

export interface Settings {
  query: string;
  colorBy: ColorMode;
  showSources: boolean;
  showIsolated: boolean;
  showLabels: boolean;
  hiddenCompanies: string[];
  linkDistance: number;
  repulsion: number;
}

export const DEFAULT_SETTINGS: Settings = {
  query: '',
  colorBy: 'company',
  showSources: true,
  showIsolated: true,
  showLabels: true,
  hiddenCompanies: [],
  linkDistance: 90,
  repulsion: 280,
};

const COLOR_ITEMS = [
  { id: 'company', label: 'Company' },
  { id: 'health', label: 'Health' },
  { id: 'trigger', label: 'Trigger' },
];

export function Controls({
  settings,
  onChange,
  companies,
  counts,
  heatmap,
  onHeatmap,
  defaultOpen = true,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  companies: Company[];
  counts: Map<string, number>;
  heatmap: boolean;
  onHeatmap: (v: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dirty =
    settings.query !== '' ||
    settings.hiddenCompanies.length > 0 ||
    settings.colorBy !== DEFAULT_SETTINGS.colorBy ||
    settings.showSources !== DEFAULT_SETTINGS.showSources ||
    settings.showIsolated !== DEFAULT_SETTINGS.showIsolated ||
    settings.showLabels !== DEFAULT_SETTINGS.showLabels ||
    settings.linkDistance !== DEFAULT_SETTINGS.linkDistance ||
    settings.repulsion !== DEFAULT_SETTINGS.repulsion;

  const toggleCompany = (id: string) => {
    const hidden = new Set(settings.hiddenCompanies);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    onChange({ hiddenCompanies: Array.from(hidden) });
  };
  const soloCompany = (id: string) => {
    const others = companies.filter((c) => c.id !== id).map((c) => c.id);
    const alreadySolo = settings.hiddenCompanies.length === others.length && others.every((o) => settings.hiddenCompanies.includes(o));
    onChange({ hiddenCompanies: alreadySolo ? [] : others });
  };

  return (
    <div className={s.controls} data-open={open} role="region" aria-label="Graph controls">
      <div className={s.controlsHead}>
        <button type="button" className={s.controlsTitle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <SlidersHorizontal />
          Graph controls
        </button>
        <div className={s.controlsHeadRight}>
          {open && dirty && (
            <button type="button" className={s.textBtn} onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
              Reset
            </button>
          )}
          <button type="button" className={s.iconBtn} onClick={() => setOpen((v) => !v)} aria-label={open ? 'Collapse controls' : 'Expand controls'}>
            <ChevronDown />
          </button>
        </div>
      </div>

      {open && (
        <div className={s.controlsBody}>
          <label className={s.search}>
            <Search />
            <input
              type="search"
              placeholder="Filter workflows"
              value={settings.query}
              onChange={(e) => onChange({ query: e.target.value })}
              aria-label="Filter workflows"
              autoComplete="off"
              spellCheck={false}
            />
            {settings.query && (
              <button type="button" className={s.clearBtn} onClick={() => onChange({ query: '' })} aria-label="Clear filter">
                <X />
              </button>
            )}
          </label>

          <div className={s.section}>
            <div className={s.sectionLabel}>Color by</div>
            <Segmented items={COLOR_ITEMS} value={settings.colorBy} onChange={(id) => onChange({ colorBy: id as ColorMode })} />
          </div>

          <div className={s.section}>
            <div className={s.sectionLabel}>Display</div>
            <Toggle label="Show sources" on={settings.showSources} onChange={(v) => onChange({ showSources: v })} />
            <Toggle label="Show isolated" on={settings.showIsolated} onChange={(v) => onChange({ showIsolated: v })} />
            <Toggle label="Show labels" on={settings.showLabels} onChange={(v) => onChange({ showLabels: v })} />
            <Toggle label="Highlight heatmap" on={heatmap} onChange={onHeatmap} />
          </div>

          {companies.length > 1 && (
            <div className={s.section}>
              <div className={s.sectionLabel}>
                Companies
                <small>{companies.length - settings.hiddenCompanies.filter((id) => companies.some((c) => c.id === id)).length} of {companies.length}</small>
              </div>
              {companies.map((c) => {
                const on = !settings.hiddenCompanies.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={s.companyRow}
                    data-on={on}
                    onClick={(e) => (e.altKey ? soloCompany(c.id) : toggleCompany(c.id))}
                    title="Click to toggle, Alt-click to solo"
                    role="checkbox"
                    aria-checked={on}
                  >
                    <span className={s.swatch} style={{ background: c.color }} />
                    <span className={s.companyName}>{c.shortName}</span>
                    <span className={s.companyCount}>{counts.get(c.id) ?? 0}</span>
                    <span className={s.check} data-on={on}>
                      {on && <Check strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={s.section}>
            <div className={s.sectionLabel}>Forces</div>
            <Slider label="Link distance" value={settings.linkDistance} min={40} max={200} step={5} onChange={(v) => onChange({ linkDistance: v })} />
            <Slider label="Repulsion" value={settings.repulsion} min={40} max={900} step={10} onChange={(v) => onChange({ repulsion: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={s.toggleRow} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={s.switch} data-on={on} />
    </button>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className={s.sliderRow}>
      <div className={s.sliderLabel}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input type="range" className={s.range} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}
