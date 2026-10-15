import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, ChevronDown, FileText, Lock, ShieldCheck, ShieldAlert, Sparkles, Trash2, Users } from 'lucide-react';
import { COMPANIES, ROUTE_LABEL, SENSITIVITY_LABEL, SIZE_HINT, SIZE_LABEL, USERS, type CompanySize, type HostingRoute, type N8nPlan, type Sensitivity, type SupportTier } from '../../data';
import { applySensitivity, isLocked, SENSITIVITY_HINT, type ProjectSettings, type SettingKey } from '../../data/settings';
import { usersWithAccess } from '../../lib/access';
import { fmtInt, relTime } from '../../lib/format';
import { useSession, useStore } from '../../stores/session';
import { $newProjects, $projectSettings, $settingsDialog, closeProjectSettings, removeProject, resetSettings, saveSettings, settingsFor } from '../../stores/projects';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import s from './projects.module.css';

type Tab = 'profile' | 'sensitivity' | 'approvals' | 'alerts' | 'people' | 'context';
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <Building2 /> },
  { id: 'sensitivity', label: 'Sensitivity & data', icon: <ShieldCheck /> },
  { id: 'approvals', label: 'Approvals', icon: <Sparkles /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell /> },
  { id: 'people', label: 'People & culture', icon: <Users /> },
  { id: 'context', label: 'Context', icon: <FileText /> },
];

const SIZES: CompanySize[] = ['enterprise', 'mkb+', 'mkb', 'startup'];
const PLANS: { id: N8nPlan; label: string }[] = [
  { id: 'community', label: 'Community' },
  { id: 'pro', label: 'Pro' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'partner', label: 'Partner instance' },
];
const TIERS: { id: SupportTier; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'priority', label: 'Priority' },
  { id: 'enterprise', label: 'Enterprise, 24/7' },
];

export function Select<T extends string>({ value, onChange, options, disabled, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; disabled?: boolean; label?: string }) {
  return (
    <span className={s.select}>
      <select className={s.input} value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown />
    </span>
  );
}

function Row({ label, hint, locked, children }: { label: string; hint?: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className={s.row}>
      <div>
        <div className={s.rowLabel}>
          {label}
          {locked && (
            <span className={s.locked}>
              <Lock /> locked
            </span>
          )}
        </div>
        {hint && <div className={s.rowHint}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function ProjectSettingsDialog() {
  const projectId = useStore($settingsDialog);
  const overrides = useStore($projectSettings);
  const newProjects = useStore($newProjects);
  const { persona, can, grants } = useSession();
  const [tab, setTab] = useState<Tab>('profile');
  const [draft, setDraft] = useState<ProjectSettings | null>(null);

  const stored = useMemo(() => (projectId ? settingsFor(projectId, overrides, newProjects) : null), [projectId, overrides, newProjects]);
  useEffect(() => {
    setDraft(stored);
    setTab(persona.org === 'vendor' ? 'profile' : 'sensitivity');
  }, [projectId, persona.org]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId || !draft) return null;
  const company = COMPANIES.find((c) => c.id === projectId);
  const newProject = newProjects.find((p) => p.id === projectId);
  const editable = can('manage-access') || persona.id === 'partner-dev';
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const seats = company ? usersWithAccess({ kind: 'company', companyId: company.id }, grants) : [];
  const set = <K extends SettingKey>(key: K, value: ProjectSettings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const toggle = (key: SettingKey, label: string, hint?: string) => (
    <Row key={key} label={label} hint={hint} locked={isLocked(draft, key)}>
      <Switch checked={Boolean(draft[key])} locked={isLocked(draft, key)} disabled={!editable} label={label} onChange={(v) => set(key, v as never)} />
    </Row>
  );
  const dis = !editable;

  return (
    <Modal
      open
      onClose={closeProjectSettings}
      width={880}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {draft.name || 'New project'} <span style={{ color: 'var(--text-subtle)', fontWeight: 450 }}>· settings</span>
        </span>
      }
    >
      <div className={s.layout}>
        <div className={s.rail}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={s.railItem} aria-current={tab === t.id ? 'true' : undefined} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className={s.railFoot}>
            {editable ? 'Changes apply to this project only.' : `Read only for ${persona.label}.`}
            {draft.sensitivity === 'hyper' && ' Hyper-sensitive locks the strict values.'}
          </div>
        </div>
        <div className={s.body}>
          {tab === 'profile' && (
            <>
              <div className={s.section}>
                <div className={s.sectionTitle}>Profile</div>
                <div className={s.profileStrip}>
                  <div className={s.profileCell}>
                    <small>Size</small>
                    <b title={SIZE_HINT[draft.size]}>{SIZE_LABEL[draft.size]}</b>
                  </div>
                  <div className={s.profileCell}>
                    <small>People</small>
                    <b>{fmtInt(draft.employees)}</b>
                  </div>
                  <div className={s.profileCell}>
                    <small>Route</small>
                    <b>{ROUTE_LABEL[draft.route]}</b>
                  </div>
                  <div className={s.profileCell}>
                    <small>Sensitivity</small>
                    <b>
                      {draft.sensitivity === 'hyper' && <Lock size={12} />}
                      {SENSITIVITY_LABEL[draft.sensitivity]}
                    </b>
                  </div>
                </div>
              </div>
              <div className={s.fields}>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Name</span>
                  <input className={s.input} value={draft.name} disabled={dis} onChange={(e) => set('name', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Industry</span>
                  <input className={s.input} value={draft.industry} disabled={dis} onChange={(e) => set('industry', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Size</span>
                  <Select value={draft.size} disabled={dis} options={SIZES.map((id) => ({ id, label: `${SIZE_LABEL[id]} · ${SIZE_HINT[id].split('.')[0]}` }))} onChange={(v) => set('size', v)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>People</span>
                  <input className={s.input} type="number" min={1} value={draft.employees} disabled={dis} onChange={(e) => set('employees', Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Country</span>
                  <input className={s.input} value={draft.country} disabled={dis} onChange={(e) => set('country', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Language</span>
                  <input className={s.input} value={draft.language} disabled={dis} onChange={(e) => set('language', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Route</span>
                  <Select<HostingRoute> value={draft.route} disabled={dis} options={[{ id: 'partner', label: 'Partner route · hosted by Viralistic' }, { id: 'self-hosted', label: 'Local host · own servers' }]} onChange={(v) => set('route', v)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>n8n plan</span>
                  <Select value={draft.plan} disabled={dis} options={PLANS} onChange={(v) => set('plan', v)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Support tier</span>
                  <Select value={draft.supportTier} disabled={dis} options={TIERS} onChange={(v) => set('supportTier', v)} />
                </label>
                {company && (
                  <div className={s.field}>
                    <span className={s.fieldLabel}>Seats</span>
                    <div className={s.input} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}>
                      <span style={{ display: 'inline-flex' }}>
                        {seats.slice(0, 6).map((e) => (
                          <span key={e.user.id} style={{ marginRight: -6 }}>
                            <Avatar user={e.user} size={18} interactive={false} />
                          </span>
                        ))}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {seats.length} people with access · contract since {relTime(company.contractSince)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'sensitivity' && (
            <>
              <div className={s.section}>
                <div className={s.sectionTitle}>Information sensitivity</div>
                <div className={s.master}>
                  <div>
                    <b>
                      <ShieldAlert /> Hyper-sensitive
                    </b>
                    <p>{SENSITIVITY_HINT.hyper}</p>
                  </div>
                  <Switch checked={draft.sensitivity === 'hyper'} disabled={dis} label="Hyper-sensitive" onChange={(v) => setDraft((d) => (d ? applySensitivity(d, v ? 'hyper' : 'high') : d))} />
                </div>
                <div className={s.levels}>
                  {(['standard', 'high', 'hyper'] as Sensitivity[]).map((level) => (
                    <button key={level} type="button" className={s.level} aria-pressed={draft.sensitivity === level} disabled={dis} onClick={() => setDraft((d) => (d ? applySensitivity(d, level) : d))}>
                      <span className={s.levelName}>
                        {level === 'hyper' ? <Lock /> : level === 'high' ? <ShieldCheck /> : <Building2 />}
                        {SENSITIVITY_LABEL[level]}
                      </span>
                      <span className={s.levelHint}>{SENSITIVITY_HINT[level]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.section}>
                <div className={s.sectionTitle}>Data</div>
                <Row label="Data residency" hint="Where executions and logs are stored." locked={isLocked(draft, 'dataResidency')}>
                  <Select<'eu' | 'any'> value={draft.dataResidency} disabled={dis || isLocked(draft, 'dataResidency')} options={[{ id: 'eu', label: 'EU only' }, { id: 'any', label: 'Any region' }]} onChange={(v) => set('dataResidency', v)} />
                </Row>
                {toggle('piiMasking', 'Mask personal data in logs', 'Names, emails and phone numbers never reach a log.')}
                <Row label="Log retention" hint="Kept for debugging." locked={isLocked(draft, 'logRetentionDays')}>
                  <Select<'7' | '30' | '90'> value={String(draft.logRetentionDays) as '7' | '30' | '90'} disabled={dis || isLocked(draft, 'logRetentionDays')} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} onChange={(v) => set('logRetentionDays', Number(v) as 7 | 30 | 90)} />
                </Row>
                {toggle('euModelsOnly', 'EU-hosted models only')}
                <Row label="Token budget per month" hint="0 means no cap.">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>€</span>
                    <input className={s.input} style={{ width: 96 }} type="number" min={0} step={50} value={draft.tokenBudgetEur} disabled={dis} onChange={(e) => set('tokenBudgetEur', Math.max(0, Number(e.target.value) || 0))} />
                  </span>
                </Row>
              </div>
              <div className={s.section}>
                <div className={s.sectionTitle}>Sharing</div>
                {toggle('allowShareLinks', 'Share links')}
                {toggle('allowExternalDevelopers', 'External developers')}
                {toggle('allowN8nAccess', 'n8n may see and signal', 'Incidents and profile only.')}
              </div>
            </>
          )}

          {tab === 'approvals' && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Approvals</div>
              {toggle('reviewBeforeOutbound', 'Review before anything reaches a customer', 'Outbound messages wait for a review.')}
              {toggle('approvalForGoLive', 'Approval before go-live')}
              {toggle('autoApplySimpleUpdates', 'Auto-implement simple n8n updates', 'Staged, tested, then promoted.')}
              <Row label="Smart fix" locked={isLocked(draft, 'smartFixAutoAccept')}>
                <Select<'never' | 'minor' | 'all'> value={draft.smartFixAutoAccept} disabled={dis || isLocked(draft, 'smartFixAutoAccept')} options={[{ id: 'never', label: 'Always ask the engineer' }, { id: 'minor', label: 'Minor tips only' }, { id: 'all', label: 'Everything' }]} onChange={(v) => set('smartFixAutoAccept', v)} />
              </Row>
            </div>
          )}

          {tab === 'alerts' && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Alerts</div>
              <Row label="Alert hours" hint="Breaking errors always reach the partner.">
                <Select<'office' | 'always'> value={draft.alertHours} disabled={dis} options={[{ id: 'office', label: 'Office hours' }, { id: 'always', label: 'Always, 24/7' }]} onChange={(v) => set('alertHours', v)} />
              </Row>
              {toggle('alertSlack', 'Slack')}
              {toggle('alertEmail', 'Email')}
              {toggle('alertSms', 'SMS for breaking errors')}
              {toggle('weeklyReport', 'Weekly report to the client', 'Every Monday.')}
            </div>
          )}

          {tab === 'people' && (
            <div className={s.section}>
              <div className={s.sectionTitle}>People & culture</div>
              {toggle('leaderboards', 'Team leaderboards')}
              {toggle('crossVerticalLeaderboard', 'Verticals compete')}
              {company && (
                <>
                  <div className={s.sectionTitle} style={{ marginTop: 8, fontSize: 'var(--fs-sm)' }}>Who has access</div>
                  <div className={s.chips}>
                    {seats.map((e) => (
                      <span key={e.user.id} className={s.chip}>
                        <Avatar user={e.user} size={14} interactive={false} /> {e.user.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'context' && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Context</div>
              <textarea className={s.input} value={draft.notes} disabled={dis} placeholder="Paste notes from a call, an email thread or the workshop. Nothing here leaves the project." onChange={(e) => set('notes', e.target.value)} />
              {newProject && (
                <p className={s.sectionSub}>
                  Created {relTime(newProject.createdAt)} by {USERS.find((u) => u.id === newProject.createdById)?.name ?? 'someone'}.
                </p>
              )}
            </div>
          )}

          <div className={s.footer}>
            <span className={s.readOnly}>
              {!editable ? (
                <>
                  <Lock /> Read only for {persona.label}
                </>
              ) : newProject ? (
                <Button size="sm" variant="ghost" onClick={() => { removeProject(newProject.id); closeProjectSettings(); }}>
                  <Trash2 /> Remove project
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => resetSettings(projectId)}>
                  Reset to defaults
                </Button>
              )}
            </span>
            <span className={s.right}>
              <Button variant="secondary" onClick={closeProjectSettings}>
                {editable ? 'Cancel' : 'Close'}
              </Button>
              {editable && (
                <Button variant="primary" disabled={!dirty} onClick={() => { saveSettings(projectId, draft); closeProjectSettings(); }}>
                  Save changes
                </Button>
              )}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
