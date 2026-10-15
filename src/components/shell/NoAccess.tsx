import { Lock } from 'lucide-react';
import { CAPABILITY_LABEL, type Capability } from '../../data/personas';
import { useSession } from '../../stores/session';
import { Button } from '../ui/Button';
import s from './shell.module.css';

/** Shown instead of a page when the persona has no capability for it. */
export function NoAccess({ cap, children }: { cap: Capability; children?: React.ReactNode }) {
  const { persona, org } = useSession();
  return (
    <div className={s.noAccess}>
      <span className={s.noAccessIcon}>
        <Lock />
      </span>
      <h2>Not part of your role</h2>
      <p>
        <b>{CAPABILITY_LABEL[cap]}</b> is not available for <b>{persona.label}</b> at {org.shortName}. {persona.reach}
      </p>
      {children}
      <Button href="/" variant="secondary">
        Back to overview
      </Button>
    </div>
  );
}
