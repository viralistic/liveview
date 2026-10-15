import { useSession } from '../../stores/session';
import { OverviewPage } from './OverviewPage';
import { ExecutiveDashboard } from '../client/ExecutiveDashboard';
import { VerticalDashboard } from '../client/VerticalDashboard';
import { WorkerDashboard } from '../client/WorkerDashboard';
import { VendorOverview } from '../vendor/VendorOverview';

/** The home screen depends on who is looking (data/personas.ts). */
export function Home() {
  const { persona } = useSession();
  switch (persona.home) {
    case 'vendor':
      return <VendorOverview />;
    case 'executive':
      return <ExecutiveDashboard />;
    case 'vertical':
      return <VerticalDashboard />;
    case 'worker':
      return <WorkerDashboard />;
    default:
      return <OverviewPage />;
  }
}
