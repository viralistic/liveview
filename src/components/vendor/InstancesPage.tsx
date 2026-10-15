import { useEffect, useState } from 'react';
import { Server, Siren } from 'lucide-react';
import { useSession } from '../../stores/session';
import { useSignals } from '../../stores/signals';
import { NoAccess } from '../shell/NoAccess';
import { Button } from '../ui/Button';
import { PageHeader } from '../pages/shared';
import { InstanceCard } from './InstanceCard';
import { LATEST_VERSION, isBehind } from './incidents';
import v from './vendor.module.css';

/**
 * Every n8n instance the viewer is involved in: n8n sees all of them, the
 * partner sees the ones it runs, a client sees its own. `#<companyId>` in the
 * URL scrolls to and highlights that instance (the sidebar links there).
 */
export function InstancesPage() {
  const { visibleCompanies: companies, org } = useSession();
  const signals = useSignals();
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!id) return;
      setFocus(id);
      // wait for the island to paint, then scroll the card into view
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => setFocus(null), 4000);
    return () => clearTimeout(t);
  }, [focus]);

  if (companies.length === 0) return <NoAccess cap="respond-incidents" />;

  const behind = companies.filter(isBehind).length;
  const lede =
    org.kind === 'vendor'
      ? `Every instance n8n is involved in, through the partner program or an enterprise agreement. Route, plan, version, health and the people allocated to it. ${behind ? `${behind} of ${companies.length} run an older release than ${LATEST_VERSION}.` : `All run ${LATEST_VERSION}.`}`
      : org.kind === 'partner'
        ? `The instances you run or support, the way n8n sees them: route, plan, version and health. ${behind ? `${behind} of ${companies.length} can be upgraded to ${LATEST_VERSION}.` : `All run ${LATEST_VERSION}.`}`
        : 'Your n8n instance: how it runs, how it is doing and who is allocated to it.';

  return (
    <>
      <PageHeader
        title={companies.length === 1 ? 'Your instance' : 'Instances'}
        lede={lede}
        actions={
          <Button href="/incidents" variant="secondary">
            <Siren /> Incidents
          </Button>
        }
      />
      <div className={v.instanceGrid}>
        {companies.map((c) => (
          <InstanceCard key={c.id} company={c} signals={signals} focus={focus === c.id} />
        ))}
      </div>
      <p style={{ marginTop: 16, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Server size={12} /> Partner route: hosted and operated by the partner. Local host: the client's own servers, supported by n8n directly.
      </p>
    </>
  );
}
