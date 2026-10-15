import { Fragment } from 'react';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import { CAPABILITIES, CAPABILITY_LABEL, PERSONAS, type Capability, type Persona } from '../../data/personas';
import type { User } from '../../data/types';
import { useSession } from '../../stores/session';
import { AvatarGroup } from '../ui/Avatar';
import { Card, CardBody, CardHeader } from '../ui/Card';
import s from './pages.module.css';

/** Short column heads; the full label sits in the title attribute. */
const SHORT: Record<Capability, string> = {
  'view-canvas': 'Canvas',
  'edit-workflows': 'Edit',
  'manage-credentials': 'Credentials',
  'see-business-value': 'Money & ROI',
  'see-tokens': 'Tokens',
  'respond-incidents': 'Incidents',
  'signal-partner': 'Signal partner',
  'accept-fixes': 'Smart fixes',
  'apply-updates': 'Updates',
  'fork-products': 'Fork',
  'publish-products': 'Publish',
  'manage-access': 'Access',
  'see-leaderboards': 'Leaderboards',
  'ai-scan': 'AI scan',
  plan: 'Planner',
};

const GROUPS: { label: string; match: (p: Persona) => boolean }[] = [
  { label: 'n8n', match: (p) => p.org === 'vendor' },
  { label: 'Partner', match: (p) => p.org === 'partner' && p.id !== 'external-dev' },
  { label: 'Client', match: (p) => p.org === 'client' },
  { label: 'External', match: (p) => p.id === 'external-dev' },
];

/**
 * The ten personas against every capability. A persona says what someone is
 * here to do; the grants matrix below says which companies they may touch.
 */
export function RolesMatrix({ users }: { users: User[] }) {
  const { persona: mine } = useSession();
  const cols = CAPABILITIES.length + 3;
  return (
    <Card>
      <CardHeader title="Roles & access levels" icon={<ShieldCheck />} />
      <CardBody flush>
        <div className={s.rmWrap}>
          <table className={s.rmTable}>
            <thead>
              <tr>
                <th>Persona</th>
                <th className={s.rmPeople}>People</th>
                {CAPABILITIES.map((c) => (
                  <th key={c} title={CAPABILITY_LABEL[c]}>
                    <span className={s.rmHead}>{SHORT[c]}</span>
                  </th>
                ))}
                <th className={s.rmReach}>Reach</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <Fragment key={g.label}>
                  <tr className={s.rmGroup}>
                    <td colSpan={cols}>{g.label}</td>
                  </tr>
                  {PERSONAS.filter(g.match).map((p) => {
                    const holders = users.filter((u) => u.persona === p.id);
                    return (
                      <tr key={p.id} data-you={p.id === mine.id}>
                        <td>
                          <div className={s.rmPersona}>
                            <b>
                              {p.label}
                              {p.id === mine.id && <span className={s.rmYou}>you</span>}
                            </b>
                          </div>
                        </td>
                        <td className={s.rmPeople}>{holders.length ? <AvatarGroup users={holders} size={20} max={4} /> : <span className={s.subtle}>none here</span>}</td>
                        {CAPABILITIES.map((c) => {
                          const on = p.capabilities.includes(c);
                          return (
                            <td key={c} aria-label={`${p.label}: ${CAPABILITY_LABEL[c]} ${on ? 'yes' : 'no'}`}>
                              {on ? (
                                <span className={s.rmCheck}>
                                  <Check strokeWidth={2.5} />
                                </span>
                              ) : (
                                <span className={s.rmDash}>
                                  <Minus />
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className={s.rmReach}>{p.reach}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.rmLegend}>
          <span>
            <i>
              <Check strokeWidth={2.5} />
            </i>
            part of the persona
          </span>
          <span>
            <i style={{ color: 'var(--track-strong)' }}>
              <Minus />
            </i>
            not part of the persona
          </span>
          <span>
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
