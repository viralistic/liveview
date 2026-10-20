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

  return (
    <>
      <PageHeader
        title={companies.length === 1 ? 'Your instance' : 'Instances'}
        lede={companies.length === 1 ? 'How your n8n runs, what it costs and who looks after it.' : 'Every instance n8n is involved in: how it runs, its size and who is allocated.'}
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
    </>
  );
}
