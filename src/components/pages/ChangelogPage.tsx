import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Container, Play, Rocket, Sparkles } from 'lucide-react';
import { COMPANIES, EFFORT_LABEL, KIND_LABEL, UPDATES, impactedWorkflows, type N8nUpdate } from '../../data';
import { useSession, toast } from '../../stores/session';
import { relTime } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { NodeIcon } from '../ui/NodeIcon';
import { PageHeader } from './shared';
import s from './pages.module.css';

type Stage = 'container' | 'apply' | 'test' | 'compare' | 'ready';
const STAGES: { id: Stage; label: string }[] = [
  { id: 'container', label: 'Create staging container' },
  { id: 'apply', label: 'Apply changes' },
  { id: 'test', label: 'Run test executions' },
  { id: 'compare', label: 'Compare with live' },
  { id: 'ready', label: 'Ready to go live' },
];

/** n8n updates, what they touch, and a staging container that applies the simple ones. */
export function ChangelogPage() {
  const { visibleWorkflows } = useSession();
  const [open, setOpen] = useState<string | null>(UPDATES[0]!.id);
  const [applied, setApplied] = useState<Record<string, 'staged' | 'live'>>({});
  const [run, setRun] = useState<{ updates: N8nUpdate[]; stage: number; done: boolean } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lv.changelog');
      if (raw) setApplied(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persist = (next: Record<string, 'staged' | 'live'>) => {
    setApplied(next);
    try {
      localStorage.setItem('lv.changelog', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const impacts = useMemo(() => Object.fromEntries(UPDATES.map((u) => [u.id, impactedWorkflows(u).filter((w) => visibleWorkflows.some((v) => v.id === w.id))])), [visibleWorkflows]);
  const simple = UPDATES.filter((u) => u.effort === 'auto' && !applied[u.id] && impacts[u.id]!.length > 0);

  useEffect(() => {
    if (!run || run.done) return;
    const t = setTimeout(() => {
      if (run.stage >= STAGES.length - 1) {
        setRun({ ...run, done: true });
        const next = { ...applied };
        for (const u of run.updates) next[u.id] = 'staged';
        persist(next);
      } else setRun({ ...run, stage: run.stage + 1 });
    }, 1100);
    return () => clearTimeout(t);
  }, [run]);

  const goLive = (id: string) => {
    persist({ ...applied, [id]: 'live' });
    toast('Promoted to live');
  };

  return (
    <>
      <PageHeader
        title="Changelog"
        actions={
          <Button variant="primary" disabled={simple.length === 0} onClick={() => setRun({ updates: simple, stage: 0, done: false })}>
            <Sparkles /> Auto-implement {simple.length ? `${simple.length} simple` : 'all simple'}
          </Button>
        }
      />

      <Card>
        <CardBody flush>
          {UPDATES.map((u) => {
            const wfs = impacts[u.id]!;
            const state = applied[u.id];
            const isOpen = open === u.id;
            return (
              <div key={u.id} className={s.update}>
                <button type="button" className={s.updateHead} onClick={() => setOpen(isOpen ? null : u.id)} aria-expanded={isOpen}>
                  <span className={s.version}>{u.version}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={s.actionTitle}>{u.title}</div>
                    <div className={s.actionSub}>
                      {relTime(u.date)} · {KIND_LABEL[u.kind]} · {wfs.length ? `${wfs.length} of your workflows` : 'none of your workflows'}
                    </div>
                  </div>
                  {state === 'live' ? (
                    <Badge tone="success" dot>
                      Live
                    </Badge>
                  ) : state === 'staged' ? (
                    <Badge tone="brand" dot>
                      In staging
                    </Badge>
                  ) : (
                    <Badge tone={u.effort === 'auto' ? 'outline' : u.effort === 'manual' ? 'danger' : 'neutral'}>{EFFORT_LABEL[u.effort]}</Badge>
                  )}
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {isOpen && (
                  <div className={s.updateBody}>
                    <p className={s.updateText}>{u.summary}</p>
                    <div className={s.aiNote}>
                      <Sparkles size={13} />
                      <span>{u.aiNote}</span>
                    </div>
                    {wfs.length > 0 && (
                      <div className={s.impactList}>
                        {wfs.map((w) => (
                          <a key={w.id} href={`/workflows/canvas?focus=${w.id}`} className={s.impactRow}>
                            <NodeIcon type={w.nodes.find((n) => u.affectedNodeTypes.includes(n.type))?.type ?? w.trigger.nodeTypeId} size={24} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span className={s.wfName}>{w.name}</span>
                              <span className={s.actionSub}>
                                {COMPANIES.find((c) => c.id === w.companyId)?.shortName} · {u.migration}
                              </span>
                            </span>
                            {state === 'live' && <Check size={14} style={{ color: 'var(--health-full)' }} />}
                          </a>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {!state && u.effort === 'auto' && wfs.length > 0 && (
                        <Button size="sm" variant="primary" onClick={() => setRun({ updates: [u], stage: 0, done: false })}>
                          <Container /> Apply in staging
                        </Button>
                      )}
                      {state === 'staged' && (
                        <Button size="sm" variant="primary" onClick={() => goLive(u.id)}>
                          <Rocket /> Promote to live
                        </Button>
                      )}
                      {!state && u.effort !== 'auto' && wfs.length > 0 && (
                        <Button size="sm" variant="secondary" href="/planner">
                          Plan it
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Modal open={!!run} onClose={() => setRun(null)} title="Staging container" width={520}>
        {run && (
          <div>
            <p className={s.updateText} style={{ marginBottom: 14 }}>
              {run.updates.length === 1 ? run.updates[0]!.title : `${run.updates.length} updates`} · {run.updates.reduce((a, u) => a + impacts[u.id]!.length, 0)} workflows.</p>
            <ol className={s.stages}>
              {STAGES.map((st, i) => {
                const state = run.done || i < run.stage ? 'done' : i === run.stage ? 'active' : 'todo';
                return (
                  <li key={st.id} data-state={state}>
                    <span className={s.stageDot}>{state === 'done' ? <Check /> : state === 'active' ? <Play /> : null}</span>
                    {st.label}
                  </li>
                );
              })}
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              {run.done ? (
                <>
                  <Button variant="secondary" onClick={() => setRun(null)}>
                    Keep in staging
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      const next = { ...applied };
                      for (const u of run.updates) next[u.id] = 'live';
                      persist(next);
                      setRun(null);
                      toast('Promoted to live');
                    }}
                  >
                    <Rocket /> Promote all to live
                  </Button>
                </>
              ) : (
                <span className={s.muted} style={{ fontSize: 'var(--fs-xs)' }}>Working…</span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
