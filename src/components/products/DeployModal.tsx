import { Check } from 'lucide-react';
import type { Fork, Product } from '../../data/types';
import { useSession } from '../../stores/session';
import { Button } from '../ui/Button';
import { CompanyMark } from '../ui/CompanyMark';
import { Modal } from '../ui/Modal';
import s from './products.module.css';

/**
 * "Deploy to project": creates an instance of the product, or of a fork
 * (a variant) when one is given. Shared by the detail page and the fork drawer.
 */
export function DeployModal({ open, onClose, product, version, versions, variant, onDeploy }: { open: boolean; onClose: () => void; product: Product; version: number; versions: Record<string, number>; variant?: Fork | null; onDeploy: (companyId: string) => void }) {
  const { visibleCompanies } = useSession();
  return (
    <Modal open={open} onClose={onClose} title={variant ? 'Deploy variant to project' : 'Deploy to project'} width={460}>
      {variant ? (
        <p className={s.modalLede}>
          An instance of <b>{variant.name}</b> that follows the fork's versions.
        </p>
      ) : (
        <p className={s.modalLede}>
          An instance of <b>{product.name}</b> v{version} that receives every update.
        </p>
      )}
      <div className={s.deployList}>
        {visibleCompanies.map((c) => {
          const inst = product.instances.find((i) => i.companyId === c.id);
          const runsVariant = variant ? variant.usedByCompanyIds.includes(c.id) : false;
          return (
            <div key={c.id} className={s.deployRow}>
              <CompanyMark company={c} size={28} />
              <div className={s.instMain}>
                <div className={s.instCompany}>{c.shortName}</div>
                <div className={s.deploySub}>{runsVariant ? 'Runs this variant' : inst ? `Running ${product.name} v${versions[inst.workflowId] ?? inst.version}` : c.industry}</div>
              </div>
              {(variant ? runsVariant : !!inst) ? (
                <span className={s.pillCurrent}>
                  <Check /> Deployed
                </span>
              ) : (
                <Button size="sm" variant="primary" onClick={() => onDeploy(c.id)}>
                  {variant && inst ? 'Switch' : 'Deploy'}
                </Button>
              )}
            </div>
          );
        })}
        {visibleCompanies.length === 0 && <div className={s.instEmpty}>You do not have access to any project.</div>}
      </div>
    </Modal>
  );
}
