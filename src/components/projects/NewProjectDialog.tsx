import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Check, ClipboardPaste, ListChecks, Lock, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { ROUTE_LABEL, SENSITIVITY_LABEL, SIZE_HINT, SIZE_LABEL, type CompanySize, type HostingRoute, type Sensitivity } from '../../data';
import { applySensitivity, autoConfigure, blankSettings, isLocked, SAMPLE_CONTEXT, SENSITIVITY_HINT, type AutoConfig, type ProjectSettings, type SettingKey } from '../../data/settings';
import { toast, useSession, useStore } from '../../stores/session';
import { $newProjectDialog, closeNewProject, createProject, openProjectSettings } from '../../stores/projects';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { Select } from './ProjectSettingsDialog';
import s from './projects.module.css';

type Mode = 'auto' | 'manual';
type Step = 'start' | 'context' | 'form' | 'done';
const SCAN_STEPS = ['Reading the notes', 'Finding size, systems and language', 'Judging information sensitivity', 'Proposing settings'];
const SIZES: CompanySize[] = ['enterprise', 'mkb+', 'mkb', 'startup'];

/** Onboarding a new project: auto-configure from pasted context, or fill the form. Demo: the project lives in this browser. */
export function NewProjectDialog() {
  const open = useStore($newProjectDialog);
  const { user: me } = useSession();
  const [mode, setMode] = useState<Mode>('auto');
  const [step, setStep] = useState<Step>('start');
  const [text, setText] = useState('');
  const [scanIdx, setScanIdx] = useState(-1);
  const [result, setResult] = useState<AutoConfig | null>(null);
  const [draft, setDraft] = useState<ProjectSettings>(() => blankSettings());

  useEffect(() => {
    if (open) {
      setMode('auto');
      setStep('start');
      setText('');
      setScanIdx(-1);
      setResult(null);
      setDraft(blankSettings());
    }
  }, [open]);

  // the scan: a few steps, then the reading
  useEffect(() => {
    if (scanIdx < 0 || scanIdx >= SCAN_STEPS.length) return;
    const t = setTimeout(() => setScanIdx((i) => i + 1), 520);
    return () => clearTimeout(t);
  }, [scanIdx]);
  useEffect(() => {
    if (scanIdx !== SCAN_STEPS.length) return;
    const r = autoConfigure(text);
    setResult(r);
    setDraft((d) => {
      const next = { ...d, ...r.patch, notes: text };
      return applySensitivity(next, r.patch.sensitivity ?? d.sensitivity);
    });
  }, [scanIdx, text]);

  const steps = useMemo(() => (mode === 'auto' ? ['Start', 'Context', 'Review', 'Done'] : ['Start', 'Form', 'Done']), [mode]);
  const stepIndex = step === 'start' ? 0 : step === 'context' ? 1 : step === 'form' ? (mode === 'auto' ? 2 : 1) : steps.length - 1;
  if (!open) return null;

  const set = <K extends SettingKey>(key: K, value: ProjectSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const scanning = scanIdx >= 0 && scanIdx < SCAN_STEPS.length;
  const canCreate = draft.name.trim().length > 1;

  const create = () => {
    const p = createProject({ ...draft, name: draft.name.trim() }, me.id);
    toast(`${p.settings.name} created. First step: introduction call.`);
    setStep('done');
    setTimeout(() => {
      closeNewProject();
      openProjectSettings(p.id);
    }, 900);
  };

  const toggle = (key: SettingKey, label: string) => (
    <div className={s.row} key={key}>
      <div className={s.rowLabel}>
        {label}
        {isLocked(draft, key) && (
          <span className={s.locked}>
            <Lock /> locked
          </span>
        )}
      </div>
      <Switch checked={Boolean(draft[key])} locked={isLocked(draft, key)} label={label} onChange={(v) => set(key, v as never)} />
    </div>
  );

  return (
    <Modal open onClose={closeNewProject} width={860} title="New project">
      <div className={s.wizard}>
        <div className={s.steps}>
          {steps.map((label, i) => (
            <span key={label} className={s.step} data-state={i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo'}>
              <span className={s.stepDot}>{i < stepIndex ? <Check /> : i + 1}</span>
              {label}
            </span>
          ))}
        </div>

        <div className={s.wizBody}>
          {step === 'start' && (
            <>
              <div className={s.choices}>
                <button type="button" className={s.choice} data-ai="true" onClick={() => { setMode('auto'); setStep('context'); }}>
                  <span className={s.choiceIcon}>
                    <Wand2 />
                  </span>
                  <span className={s.choiceTitle}>Auto-configure from context</span>
                  <span className={s.choiceHint}>Paste call notes or an email. The AI proposes the settings.</span>
                  <span className={s.choiceFoot}>
                    Paste context <ArrowRight />
                  </span>
                </button>
                <button type="button" className={s.choice} onClick={() => { setMode('manual'); setStep('form'); }}>
                  <span className={s.choiceIcon}>
                    <ListChecks />
                  </span>
                  <span className={s.choiceTitle}>Configure manually</span>
                  <span className={s.choiceHint}>Profile, route, sensitivity and toggles.</span>
                  <span className={s.choiceFoot}>
                    Open the form <ArrowRight />
                  </span>
                </button>
              </div>
            </>
          )}

          {step === 'context' && (
            <>
              <div className={s.section}>
                <div className={s.sectionTitle}>Context from calls</div>
                <textarea className={s.input} value={text} disabled={scanning} placeholder="Intro call with ... They have about 140 people ... run HubSpot and Exact ... want quotes within the hour ... nothing goes out without a review ..." onChange={(e) => setText(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button size="sm" variant="secondary" disabled={scanning} onClick={() => setText(SAMPLE_CONTEXT)}>
                    <ClipboardPaste /> Paste example
                  </Button>
                  <Button size="sm" variant="primary" disabled={scanning || text.trim().length < 20} onClick={() => { setResult(null); setScanIdx(0); }}>
                    <Sparkles /> {result ? 'Analyse again' : 'Analyse'}
                  </Button>
                </div>
              </div>
              {scanIdx >= 0 && (
                <div className={s.scan}>
                  {SCAN_STEPS.map((label, i) => (
                    <div key={label} className={s.scanLine} data-state={i < scanIdx ? 'done' : i === scanIdx ? 'active' : 'todo'}>
                      <span className={s.scanDot} />
                      {label}
                    </div>
                  ))}
                </div>
              )}
              {result && (
                <div className={s.section}>
                  <div className={s.sectionTitle}>What the AI found</div>
                  {result.detections.length === 0 ? (
                    <div className={s.detections}>
                      <div className={s.empty}>Nothing recognisable yet.</div>
                    </div>
                  ) : (
                    <div className={s.detections}>
                      {result.detections.map((d, i) => (
                        <div key={d.key + i} className={s.detection} style={{ animationDelay: `${i * 60}ms` }}>
                          <span className={s.detLabel}>{d.label}</span>
                          <span>
                            <span className={s.detValue}>{d.key === 'size' ? SIZE_LABEL[d.value as CompanySize] : d.value}</span>
                            <div className={s.detEvidence}>“{d.evidence}”</div>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.wants.length > 0 && (
                    <>
                      <div className={s.sectionTitle} style={{ fontSize: 'var(--fs-sm)' }}>What they want</div>
                      <div className={s.chips}>
                        {result.wants.map((w) => (
                          <span key={w} className={s.chip}>
                            {w.length > 80 ? w.slice(0, 78) + '…' : w}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'form' && (
            <>
              {mode === 'auto' && result && (
                <p className={s.sectionSub} style={{ marginTop: 0 }}>
                  Proposed from the notes. Adjust, then create.
                </p>
              )}
              <div className={s.fields}>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Project name</span>
                  <input className={s.input} value={draft.name} autoFocus placeholder="Company name" onChange={(e) => set('name', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Industry</span>
                  <input className={s.input} value={draft.industry} placeholder="Automotive, hosting, e-commerce…" onChange={(e) => set('industry', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Size</span>
                  <Select value={draft.size} options={SIZES.map((id) => ({ id, label: `${SIZE_LABEL[id]} · ${SIZE_HINT[id].split('.')[0]}` }))} onChange={(v) => set('size', v)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>People</span>
                  <input className={s.input} type="number" min={1} value={draft.employees} onChange={(e) => set('employees', Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Country</span>
                  <input className={s.input} value={draft.country} onChange={(e) => set('country', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Language</span>
                  <input className={s.input} value={draft.language} onChange={(e) => set('language', e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Route</span>
                  <Select<HostingRoute> value={draft.route} options={[{ id: 'partner', label: 'Partner route · hosted by Viralistic' }, { id: 'self-hosted', label: 'Local host · own servers' }]} onChange={(v) => set('route', v)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>Token budget per month (€)</span>
                  <input className={s.input} type="number" min={0} step={50} value={draft.tokenBudgetEur} onChange={(e) => set('tokenBudgetEur', Math.max(0, Number(e.target.value) || 0))} />
                </label>
              </div>
              <div className={s.section}>
                <div className={s.sectionTitle}>Information sensitivity</div>
                <div className={s.levels}>
                  {(['standard', 'high', 'hyper'] as Sensitivity[]).map((level) => (
                    <button key={level} type="button" className={s.level} aria-pressed={draft.sensitivity === level} onClick={() => setDraft((d) => applySensitivity(d, level))}>
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
                <div className={s.sectionTitle}>Settings</div>
                <div className={s.toggleGrid}>
                  {toggle('reviewBeforeOutbound', 'Review before anything reaches a customer')}
                  {toggle('approvalForGoLive', 'Approval before go-live')}
                  {toggle('piiMasking', 'Mask personal data in logs')}
                  {toggle('euModelsOnly', 'EU-hosted models only')}
                  {toggle('allowShareLinks', 'Share links')}
                  {toggle('allowExternalDevelopers', 'External developers')}
                  {toggle('allowN8nAccess', 'n8n may see and signal')}
                  {toggle('autoApplySimpleUpdates', 'Auto-implement simple n8n updates')}
                  {toggle('weeklyReport', 'Weekly report to the client')}
                  {toggle('leaderboards', 'Team leaderboards')}
                </div>
              </div>
              {mode === 'auto' && result && result.systems.length > 0 && (
                <div className={s.section}>
                  <div className={s.sectionTitle} style={{ fontSize: 'var(--fs-sm)' }}>Systems mentioned</div>
                  <div className={s.chips}>
                    {result.systems.map((x) => (
                      <span key={x} className={s.chip}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'done' && (
            <div className={s.section} style={{ alignItems: 'center', textAlign: 'center', padding: '40px 0' }}>
              <span className={s.choiceIcon} style={{ background: 'var(--health-full)', color: '#06381a' }}>
                <Check />
              </span>
              <div className={s.sectionTitle}>{draft.name} is onboarding</div>
              <p className={s.sectionSub}>
                {SIZE_LABEL[draft.size]} · {draft.employees} people · {ROUTE_LABEL[draft.route]} · {SENSITIVITY_LABEL[draft.sensitivity]}
              </p>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <div className={s.wizFooter}>
            <span className={s.readOnly}>Demo: the project lives in this browser only.</span>
            <span className={s.right}>
              {step !== 'start' && (
                <Button variant="secondary" onClick={() => setStep(step === 'form' && mode === 'auto' ? 'context' : 'start')}>
                  Back
                </Button>
              )}
              {step === 'context' && (
                <Button variant="primary" disabled={!result} onClick={() => setStep('form')}>
                  Review settings <ArrowRight />
                </Button>
              )}
              {step === 'form' && (
                <Button variant="primary" disabled={!canCreate} onClick={create}>
                  Create project
                </Button>
              )}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
