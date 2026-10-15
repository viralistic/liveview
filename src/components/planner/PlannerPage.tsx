import { NoAccess } from '../shell/NoAccess';
import { useMemo, useState } from 'react';
import { Check, Inbox, Plus, Sparkles } from 'lucide-react';
import { COMPANIES, IMPORTANCE_LABEL, PROJECTS, USERS, WORKFLOWS, type Task } from '../../data';
import { useSession, useStore } from '../../stores/session';
import { $tasks, completeTask, openAsk, planTask } from '../../stores/planner';
import { isOrgAdmin } from '../../lib/access';
import { NOW, relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { renderMentions } from '../ui/Mention';
import { PageHeader } from '../pages/shared';
import s from './planner.module.css';

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 08:00 – 18:00
const PX_PER_HOUR = 48;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

interface CalEvent {
  id: string;
  kind: 'task' | 'call';
  title: string;
  sub: string;
  at: Date;
  minutes: number;
  importance?: Task['importance'];
  done?: boolean;
  taskId?: string;
}

/** Your week: client calls from the project log and tasks that were planned for you. Low-importance asks wait in the inbox. */
/** Gate first, so the inner component keeps a stable hook order. */
export function PlannerPage() {
  const { can } = useSession();
  if (!can('plan')) return <NoAccess cap="plan" />;
  return <PlannerPageInner />;
}

function PlannerPageInner() {
  const { user: me, grants } = useSession();
  const tasks = useStore($tasks);
  const [personId, setPersonId] = useState(me.id);
  const admin = isOrgAdmin(me.id, grants);
  const person = USERS.find((u) => u.id === personId) ?? me;
  const week = useMemo(() => startOfWeek(NOW), []);
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(week);
    d.setDate(week.getDate() + i);
    return d;
  });

  const events: CalEvent[] = useMemo(() => {
    const out: CalEvent[] = [];
    for (const t of tasks) if (t.assigneeId === person.id && t.plannedAt && t.status !== 'inbox') {
      out.push({ id: t.id, kind: 'task', title: t.title, sub: t.companyId ? COMPANIES.find((c) => c.id === t.companyId)?.shortName ?? '' : '', at: new Date(t.plannedAt), minutes: t.durationMin, importance: t.importance, done: t.status === 'done', taskId: t.id });
    }
    for (const p of PROJECTS) for (const c of p.communications) if ((c.type === 'call' || c.type === 'meeting') && c.participantIds.includes(person.id)) {
      out.push({ id: c.id, kind: 'call', title: c.title, sub: COMPANIES.find((x) => x.id === c.companyId)?.shortName ?? '', at: new Date(c.at), minutes: 60 });
    }
    return out;
  }, [tasks, person.id]);

  const inbox = tasks.filter((t) => t.assigneeId === person.id && t.status === 'inbox');
  const upcoming = events.filter((e) => e.at.getTime() >= NOW.getTime() - 60 * 60_000).sort((a, b) => a.at.getTime() - b.at.getTime());
  const people = admin ? USERS.filter((u) => u.companyId === 'viralistic') : [me];

  return (
    <>
      <PageHeader
        title="Planner"
        lede={<>Client calls and the things people asked {person.id === me.id ? 'you' : person.name.split(' ')[0]} for. Tag someone and the planner decides whether it goes on the calendar or in the inbox.</>}
        actions={
          <Button variant="primary" onClick={() => openAsk({})}>
            <Plus /> Ask someone
          </Button>
        }
      />

      {people.length > 1 && (
        <div className={s.people} style={{ marginBottom: 16 }}>
          {people.map((u) => (
            <button key={u.id} type="button" className={s.person} aria-pressed={u.id === person.id} onClick={() => setPersonId(u.id)}>
              <Avatar user={u} size={24} />
              {u.id === me.id ? 'You' : u.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      <div className={s.layout}>
        <Card>
          <CardHeader
            title={`Week of ${days[0]!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
            action={
              <div className={s.legend}>
                <span>
                  <i style={{ background: 'var(--product-soft)', border: '1px solid var(--product-border)' }} /> Client call
                </span>
                <span>
                  <i style={{ background: 'var(--accent)' }} /> High
                </span>
                <span>
                  <i style={{ background: 'var(--track-strong)' }} /> Medium
                </span>
              </div>
            }
          />
          <CardBody flush>
            <div className={s.week}>
              <div />
              {days.map((d) => (
                <div key={d.toISOString()} className={s.dayHead} data-today={d.toDateString() === NOW.toDateString()}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                  <b>{d.getDate()}</b>
                </div>
              ))}
              <div className={s.hourCol}>
                {HOURS.map((h) => (
                  <div key={h} className={s.hour}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const isToday = d.toDateString() === NOW.toDateString();
                const dayEvents = events.filter((e) => e.at.toDateString() === d.toDateString());
                return (
                  <div key={d.toISOString()} className={s.dayCol} data-today={isToday} style={{ height: HOURS.length * PX_PER_HOUR }}>
                    {isToday && <div className={s.nowLine} style={{ top: (NOW.getHours() + NOW.getMinutes() / 60 - 8) * PX_PER_HOUR }} />}
                    {dayEvents.map((e) => {
                      const top = (e.at.getHours() + e.at.getMinutes() / 60 - 8) * PX_PER_HOUR;
                      const height = Math.max(26, (e.minutes / 60) * PX_PER_HOUR - 2);
                      return (
                        <div key={e.id} className={s.event} data-kind={e.kind} data-importance={e.importance} data-done={e.done} style={{ top, height }} title={`${e.title} · ${e.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}>
                          <b>{e.title}</b>
                          <span>
                            {e.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {e.sub ? ` · ${e.sub}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardHeader title="Inbox" icon={<Inbox />} sub={inbox.length ? 'Low importance. Pick these up when there is time.' : undefined} />
            <CardBody flush>
              {inbox.length === 0 && <div className={s.empty}>Nothing waiting.</div>}
              {inbox.map((t) => (
                <div key={t.id} className={s.inboxItem}>
                  <Avatar user={USERS.find((u) => u.id === t.createdById)!} size={26} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={s.inboxTitle}>{t.title}</div>
                    <div className={s.inboxBody}>{renderMentions(t.body)}</div>
                    <div className={s.inboxMeta}>
                      {USERS.find((u) => u.id === t.createdById)?.name.split(' ')[0]} · {relTime(t.createdAt)} · {IMPORTANCE_LABEL[t.importance]}: {t.reason}
                    </div>
                    <div className={s.inboxActions}>
                      <Button size="sm" variant="secondary" onClick={() => planTask(t.id, 'medium')}>
                        Plan
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => completeTask(t.id)}>
                        <Check /> Done
                      </Button>
                      {t.workflowId && (
                        <Button size="sm" variant="ghost" href={`/workflows/canvas?focus=${t.workflowId}`}>
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Up next" icon={<Sparkles />} />
            <CardBody flush>
              {upcoming.length === 0 && <div className={s.empty}>Nothing planned.</div>}
              {upcoming.slice(0, 6).map((e) => (
                <div key={e.id} className={s.inboxItem}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={s.inboxTitle}>{e.title}</div>
                    <div className={s.inboxMeta}>
                      {e.at.toLocaleDateString('en-GB', { weekday: 'short' })} {e.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {e.sub ? ` · ${e.sub}` : ''}
                      {e.kind === 'call' ? ' · client call' : e.importance ? ` · ${IMPORTANCE_LABEL[e.importance]}` : ''}
                    </div>
                    {e.taskId && !e.done && (
                      <div className={s.inboxActions}>
                        <Button size="sm" variant="ghost" onClick={() => completeTask(e.taskId!)}>
                          <Check /> Done
                        </Button>
                        {tasks.find((t) => t.id === e.taskId)?.workflowId && (
                          <Button size="sm" variant="ghost" href={`/workflows/canvas?focus=${tasks.find((t) => t.id === e.taskId)?.workflowId}`}>
                            Open
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
      <span className="sr-only">{WORKFLOWS.length}</span>
    </>
  );
}
