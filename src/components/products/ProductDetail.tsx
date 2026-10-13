import { useMemo, useState } from 'react';
import { ArrowUpRight, Box, Building2, Check, Lock, RefreshCw, Rocket, Waypoints } from 'lucide-react';
import { productById, productCategory } from '../../data/products';
import { companyById } from '../../data/companies';
import { WORKFLOWS } from '../../data/workflows';
import { userById } from '../../data/users';
import { nodeType } from '../../data/nodeTypes';
import type { ProductInstance } from '../../data/types';
import { canSeeCompany } from '../../lib/access';
import { relTime } from '../../lib/format';
import { toast, useSession } from '../../stores/session';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { CompanyMark } from '../ui/CompanyMark';
import { Modal } from '../ui/Modal';
import { ProductTag } from '../ui/ProductTag';
import { PageHeader } from '../pages/shared';
import { LiveGraph } from './LiveGraph';
import s from './products.module.css';

export function ProductDetail({ productId }: { productId: string }) {
  const product = productById(productId)!;
  const category = productCategory(product.category);
  const { userId, grants, visibleCompanies } = useSession();
  const updater = userById(product.updatedById);

  // instance versions are local demo state: "Update" moves them to the product version
  const [versions, setVersions] = useState<Record<string, number>>(() => Object.fromEntries(product.instances.map((i) => [i.workflowId, i.version])));
  const [deployOpen, setDeployOpen] = useState(false);

  const visibleInstances = useMemo(() => product.instances.filter((i) => canSeeCompany(userId, i.companyId, grants)), [product, userId, grants]);
  const hiddenCount = product.instances.length - visibleInstances.length;
  const isCurrent = (i: ProductInstance) => (versions[i.workflowId] ?? i.version) >= product.version;
  const outdated = visibleInstances.filter((i) => !isCurrent(i));

  const updateOne = (i: ProductInstance) => {
    setVersions((v) => ({ ...v, [i.workflowId]: product.version }));
    const wf = WORKFLOWS.find((w) => w.id === i.workflowId);
    toast(`Updated ${wf?.name ?? 'instance'} to v${product.version} (demo)`);
  };
  const updateAll = () => {
    if (!outdated.length) return;
    setVersions((v) => {
      const next = { ...v };
      for (const i of outdated) next[i.workflowId] = product.version;
      return next;
    });
    toast(`Updated ${outdated.length} ${outdated.length === 1 ? 'instance' : 'instances'} to v${product.version} (demo)`);
  };
  const deploy = (companyId: string) => {
    toast(`Deployed ${product.name} to ${companyById(companyId).shortName} (demo)`);
    setDeployOpen(false);
  };

  const triggerDef = nodeType(product.trigger.nodeTypeId);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ProductTag />
            <span>·</span>
            <span>{category.label}</span>
          </>
        }
        title={product.name}
        lede={
          <>
            {product.tagline}
            <span className={s.meta}>
              <span className={s.version}>
                <Box />v{product.version}
              </span>
              <span className={s.metaDot}>·</span>
              <span className={s.metaBy}>
                updated {relTime(product.updatedAt)} by <Avatar user={updater} size={18} /> {updater.name.split(' ')[0]}
              </span>
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeployOpen(true)}>
              <Rocket /> Deploy to project
            </Button>
            <Button variant="primary" disabled={outdated.length === 0} onClick={updateAll} title={outdated.length ? `${outdated.length} outdated` : 'Every instance runs the current version'}>
              <RefreshCw /> Update all instances
            </Button>
          </>
        }
      />

      <div className={s.stack}>
        <Card>
          <CardHeader title="Flow" sub={`${triggerDef.label} · ${product.trigger.label} · ${product.nodes.length} nodes`} icon={<Waypoints />} />
          <CardBody flush>
            <div className={s.stage}>
              <LiveGraph nodes={product.nodes} connections={product.connections} variant="large" />
            </div>
          </CardBody>
        </Card>

        <div className={s.detailGrid}>
          <div className={s.stack}>
            <Card>
              <CardHeader title="About" />
              <CardBody>
                <p className={s.description}>{product.description}</p>
                {product.tags.length > 0 && (
                  <div className={s.tags}>
                    {product.tags.map((t) => (
                      <span key={t} className={s.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Used in"
                sub={
                  product.instances.length === 0
                    ? 'No instances yet'
                    : `${product.instances.length} ${product.instances.length === 1 ? 'instance' : 'instances'}${outdated.length ? ` · ${outdated.length} outdated` : ' · all current'}`
                }
                icon={<Building2 />}
                action={
                  outdated.length > 0 ? (
                    <Button size="sm" variant="secondary" onClick={updateAll}>
                      <RefreshCw /> Update all
                    </Button>
                  ) : undefined
                }
              />
              <CardBody flush>
                {visibleInstances.map((i) => {
                  const company = companyById(i.companyId);
                  const wf = WORKFLOWS.find((w) => w.id === i.workflowId);
                  const v = versions[i.workflowId] ?? i.version;
                  const current = isCurrent(i);
                  return (
                    <div key={i.workflowId} className={s.inst}>
                      <CompanyMark company={company} size={26} />
                      <div className={s.instMain}>
                        <div className={s.instCompany}>{company.shortName}</div>
                        <a href={`/workflows/canvas?focus=${i.workflowId}`} className={s.instWf} title="Open on the canvas">
                          {wf?.name ?? i.workflowId}
                          <ArrowUpRight />
                        </a>
                      </div>
                      {current ? (
                        <span className={s.pillCurrent}>
                          <Check /> Up to date
                        </span>
                      ) : (
                        <span className={s.pillOutdated}>
                          Outdated · v{v} → v{product.version}
                        </span>
                      )}
                      <div className={s.instAction}>
                        {!current && (
                          <Button size="sm" variant="secondary" onClick={() => updateOne(i)}>
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className={s.instHidden}>
                    <Lock /> {hiddenCount} more {hiddenCount === 1 ? 'instance' : 'instances'} in {hiddenCount === 1 ? 'a project' : 'projects'} you cannot see
                  </div>
                )}
                {product.instances.length === 0 && (
                  <div className={s.instEmpty}>
                    <span>Not deployed yet. The first deploy creates an instance that stays linked to this product.</span>
                    <Button size="sm" variant="secondary" onClick={() => setDeployOpen(true)}>
                      <Rocket /> Deploy to project
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className={s.stack}>
            <div className={s.note}>
              <span className={s.noteIcon}>
                <Lock />
              </span>
              <div>
                <b>Source of truth</b>
                Changes to this product are pushed to every instance. Instances can override nothing.
              </div>
            </div>

            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <dl className={s.facts}>
                  <dt>Category</dt>
                  <dd>{category.label}</dd>
                  <dt>Version</dt>
                  <dd>v{product.version}</dd>
                  <dt>Trigger</dt>
                  <dd>
                    {triggerDef.label} <span className={s.factSub}>{product.trigger.label}</span>
                  </dd>
                  <dt>Nodes</dt>
                  <dd>{product.nodes.length}</dd>
                  <dt>Updated</dt>
                  <dd>
                    {relTime(product.updatedAt)} <span className={s.factSub}>by {updater.name}</span>
                  </dd>
                  <dt>Instances</dt>
                  <dd>{product.instances.length}</dd>
                </dl>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={deployOpen} onClose={() => setDeployOpen(false)} title="Deploy to project" width={460}>
        <p className={s.modalLede}>
          Creates an instance of <b>{product.name}</b> v{product.version} in the project. The instance stays linked to this product and receives every update.
        </p>
        <div className={s.deployList}>
          {visibleCompanies.map((c) => {
            const inst = product.instances.find((i) => i.companyId === c.id);
            return (
              <div key={c.id} className={s.deployRow}>
                <CompanyMark company={c} size={28} />
                <div className={s.instMain}>
                  <div className={s.instCompany}>{c.shortName}</div>
                  <div className={s.deploySub}>{inst ? `Running v${versions[inst.workflowId] ?? inst.version}` : c.industry}</div>
                </div>
                {inst ? (
                  <span className={s.pillCurrent}>
                    <Check /> Deployed
                  </span>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => deploy(c.id)}>
                    Deploy
                  </Button>
                )}
              </div>
            );
          })}
          {visibleCompanies.length === 0 && <div className={s.instEmpty}>You do not have access to any project.</div>}
        </div>
      </Modal>
    </>
  );
}
