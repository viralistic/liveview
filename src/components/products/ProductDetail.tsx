import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Box, Building2, Check, GitFork, Lock, RefreshCw, Rocket, Waypoints } from 'lucide-react';
import { productById, productCategory } from '../../data/products';
import { companyById } from '../../data/companies';
import { WORKFLOWS } from '../../data/workflows';
import { userById } from '../../data/users';
import { nodeType } from '../../data/nodeTypes';
import type { Fork, ProductInstance } from '../../data/types';
import { canSeeCompany } from '../../lib/access';
import { relTime } from '../../lib/format';
import { toast, useSession } from '../../stores/session';
import { createFork, starKey, toggleStar, useProductForks } from '../../stores/forks';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { CompanyMark } from '../ui/CompanyMark';
import { ProductTag } from '../ui/ProductTag';
import { Tooltip } from '../ui/Tooltip';
import { PageHeader } from '../pages/shared';
import { DeployModal } from './DeployModal';
import { ForkDialog, type ForkDraft } from './ForkDialog';
import { ForkDrawer } from './ForkDrawer';
import { ForkNetwork } from './ForkNetwork';
import { ForkRow } from './ForkCard';
import { LiveGraph } from './LiveGraph';
import { RepoBar } from './RepoBar';
import { VersionHistory } from './VersionHistory';
import s from './products.module.css';

export function ProductDetail({ productId }: { productId: string }) {
  const product = productById(productId)!;
  const category = productCategory(product.category);
  const { userId, grants, org, can } = useSession();
  const updater = userById(product.updatedById);
  const canFork = can('fork-products');

  // forks, stars, pull requests and merges: seeded data plus what the person did in the demo
  const { forks, all, version, commits, isStarred, starCount } = useProductForks(product);
  const productStar = starKey('product', product.id);

  // instance versions are local demo state: "Update" moves them to the product version
  const [versions, setVersions] = useState<Record<string, number>>(() => Object.fromEntries(product.instances.map((i) => [i.workflowId, i.version])));
  const [deploy, setDeploy] = useState<{ open: boolean; variant: Fork | null }>({ open: false, variant: null });
  const [openForkId, setOpenForkId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; parent: Fork | null }>({ open: false, parent: null });
  const openFork = openForkId ? (forks.find((f) => f.id === openForkId) ?? null) : null;

  // deep link: /products/lead-intake?fork=lead-sap opens that fork (after mount, so SSR and hydration agree)
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    const q = new URLSearchParams(window.location.search).get('fork');
    if (!q) {
      linked.current = true;
      return;
    }
    const f = forks.find((x) => x.slug === q || x.id === q);
    if (f) {
      linked.current = true;
      setOpenForkId(f.id);
    }
  }, [forks]);
  useEffect(() => {
    if (!linked.current) return;
    const url = new URL(window.location.href);
    if (openFork) url.searchParams.set('fork', openFork.slug);
    else url.searchParams.delete('fork');
    window.history.replaceState(null, '', url);
  }, [openFork]);

  const visibleInstances = useMemo(() => product.instances.filter((i) => canSeeCompany(userId, i.companyId, grants)), [product, userId, grants]);
  const hiddenCount = product.instances.length - visibleInstances.length;
  const isCurrent = (i: ProductInstance) => (versions[i.workflowId] ?? i.version) >= version;
  const outdated = visibleInstances.filter((i) => !isCurrent(i));

  const updateOne = (i: ProductInstance) => {
    setVersions((v) => ({ ...v, [i.workflowId]: version }));
    const wf = WORKFLOWS.find((w) => w.id === i.workflowId);
    toast(`Updated ${wf?.name ?? 'instance'} to v${version} (demo)`);
  };
  const updateAll = () => {
    if (!outdated.length) return;
    setVersions((v) => {
      const next = { ...v };
      for (const i of outdated) next[i.workflowId] = version;
      return next;
    });
    toast(`Updated ${outdated.length} ${outdated.length === 1 ? 'instance' : 'instances'} to v${version} (demo)`);
  };
  const deployTo = (companyId: string) => {
    const c = companyById(companyId);
    toast(deploy.variant ? `Deployed ${deploy.variant.name} to ${c.shortName} (demo)` : `Deployed ${product.name} to ${c.shortName} (demo)`);
    setDeploy({ open: false, variant: null });
    setOpenForkId(null);
  };

  const closeDrawer = useCallback(() => setOpenForkId(null), []);
  const openDrawer = (f: Fork) => setOpenForkId(f.id);
  const startFork = (parent: Fork | null) => {
    if (!canFork) {
      toast('Your role cannot fork products');
      return;
    }
    setDialog({ open: true, parent });
  };
  const onCreate = (draft: ForkDraft) => {
    const f = createFork({ productId: product.id, parentForkId: dialog.parent?.id, name: draft.name, description: draft.description, swaps: draft.swaps, authorId: userId, companyId: org.id });
    setDialog({ open: false, parent: null });
    setOpenForkId(f.id);
  };
  const applyVariant = (f: Fork) => {
    toast(`Using ${f.name}: pick a project`);
    setDeploy({ open: true, variant: f });
  };

  const triggerDef = nodeType(product.trigger.nodeTypeId);
  const authors = new Set(forks.map((f) => f.authorId)).size;
  const prs = forks.filter((f) => f.status === 'pr-open').length;
  const merged = forks.filter((f) => f.status === 'merged').length;
  const forkSub =
    forks.length === 0
      ? 'No forks yet'
      : [`${forks.length} ${forks.length === 1 ? 'fork' : 'forks'} by ${authors} ${authors === 1 ? 'person' : 'people'}`, prs ? `${prs} pull ${prs === 1 ? 'request' : 'requests'} open` : '', merged ? `${merged} merged` : ''].filter(Boolean).join(' · ');
  const forkBtn = (
    <Button size="sm" variant="secondary" onClick={() => startFork(null)} disabled={!canFork} style={!canFork ? { pointerEvents: 'none' } : undefined}>
      <GitFork /> Fork
    </Button>
  );

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
                <Box />v{version}
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
            <Button variant="secondary" onClick={() => setDeploy({ open: true, variant: null })}>
              <Rocket /> Deploy to project
            </Button>
            <Button variant="primary" disabled={outdated.length === 0} onClick={updateAll} title={outdated.length ? `${outdated.length} outdated` : 'Every instance runs the current version'}>
              <RefreshCw /> Update all instances
            </Button>
          </>
        }
      />

      <RepoBar product={product} version={version} commitCount={commits.length} forkCount={forks.length} starred={isStarred(productStar)} starCount={starCount(product.repo.stars, productStar)} onStar={() => toggleStar(productStar)} canFork={canFork} onFork={() => startFork(null)} />

      <div className={s.stack}>
        <Card>
          <CardHeader title="Flow" sub={`${triggerDef.label} · ${product.trigger.label} · ${product.nodes.length} nodes`} icon={<Waypoints />} />
          <CardBody flush>
            <div className={s.stage}>
              <LiveGraph nodes={product.nodes} connections={product.connections} variant="large" />
            </div>
          </CardBody>
        </Card>

        <Card id="forks">
          <CardHeader title="Forks & variants" sub={forkSub} icon={<GitFork />} action={canFork ? forkBtn : <Tooltip label="Your role cannot fork products">{forkBtn}</Tooltip>} />
          <CardBody flush>
            <ForkNetwork product={product} commits={commits} forks={forks} version={version} activeId={openForkId} onOpen={openDrawer} />
            <div className={s.forkList}>
              {forks.map((f) => {
                const key = starKey('fork', f.id);
                return <ForkRow key={f.id} fork={f} all={all} starred={isStarred(key)} starCount={starCount(f.stars, key)} onStar={() => toggleStar(key)} onOpen={() => openDrawer(f)} active={openForkId === f.id} />;
              })}
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
                          Outdated · v{v} → v{version}
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
                    <Button size="sm" variant="secondary" onClick={() => setDeploy({ open: true, variant: null })}>
                      <Rocket /> Deploy to project
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>

            <VersionHistory commits={commits} version={version} />
          </div>

          <div className={s.stack}>
            <div className={s.note}>
              <span className={s.noteIcon}>
                <Lock />
              </span>
              <div>
                <b>Source of truth</b>
                Changes to this product are pushed to every instance. Variants live in forks with their own versions; a merged fork becomes the next version of the product.
              </div>
            </div>

            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <dl className={s.facts}>
                  <dt>Category</dt>
                  <dd>{category.label}</dd>
                  <dt>Version</dt>
                  <dd>
                    v{version} <span className={s.factSub}>{commits.length} commits</span>
                  </dd>
                  <dt>Repository</dt>
                  <dd className={s.factMono}>
                    {product.repo.owner}/{product.repo.name}/{product.repo.path}
                  </dd>
                  <dt>Forks</dt>
                  <dd>
                    {forks.length} <span className={s.factSub}>{starCount(product.repo.stars, productStar)} stars</span>
                  </dd>
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

      <ForkDrawer fork={openFork} product={product} all={all} onClose={closeDrawer} onUse={applyVariant} onForkThis={(f) => startFork(f)} starred={openFork ? isStarred(starKey('fork', openFork.id)) : false} starCount={openFork ? starCount(openFork.stars, starKey('fork', openFork.id)) : 0} onStar={() => openFork && toggleStar(starKey('fork', openFork.id))} escapeDisabled={dialog.open || deploy.open} />
      <ForkDialog open={dialog.open} onClose={() => setDialog({ open: false, parent: null })} product={product} parent={dialog.parent} all={all} version={version} onCreate={onCreate} />
      <DeployModal open={deploy.open} onClose={() => setDeploy({ open: false, variant: null })} product={product} version={version} versions={versions} variant={deploy.variant} onDeploy={deployTo} />
    </>
  );
}
