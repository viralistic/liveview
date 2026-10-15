/**
 * "Fork": name the variant and pick which nodes get another tool. Every
 * swappable node of the base flow is listed with its alternatives (CRM,
 * messaging, mail, storage, AI). Creates a fork owned by the current person.
 */
import { useEffect, useMemo, useState } from 'react';
import { GitFork, Lock } from 'lucide-react';
import { forkFlow, isSwappable, swapAlternatives, swapGroupOf } from '../../data/forks';
import { nodeType } from '../../data/nodeTypes';
import type { Fork, NodeSwap, Product } from '../../data/types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { NodeIcon } from '../ui/NodeIcon';
import s from './products.module.css';

export interface ForkDraft {
  name: string;
  description: string;
  swaps: NodeSwap[];
}

export function ForkDialog({ open, onClose, product, parent, all, version, onCreate }: { open: boolean; onClose: () => void; product: Product; parent: Fork | null; all: Fork[]; version: number; onCreate: (draft: ForkDraft) => void }) {
  const base = useMemo(() => (parent ? forkFlow(parent, all) : { nodes: product.nodes, connections: product.connections }), [parent, all, product]);
  const swappable = useMemo(() => base.nodes.filter((n) => isSwappable(n.type)), [base]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [description, setDescription] = useState('');

  // reset when (re)opened for another base
  useEffect(() => {
    if (!open) return;
    setChosen({});
    setName('');
    setTouched(false);
    setDescription('');
  }, [open, parent?.id, product.id]);

  const baseName = parent ? parent.name : product.name;
  const picks = Object.entries(chosen).filter(([, to]) => to);
  const suggested = picks.length === 0 ? `${baseName} · variant` : `${baseName} · ${picks.map(([, to]) => nodeType(to).label).join(' + ')}${picks.length === 1 ? ' variant' : ''}`;
  const finalName = touched ? name : suggested;

  const create = () => {
    const swaps: NodeSwap[] = picks.map(([nodeId, to]) => {
      const n = base.nodes.find((x) => x.id === nodeId)!;
      return { nodeId, nodeName: n.name, from: n.type, to };
    });
    onCreate({ name: finalName.trim(), description, swaps });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Fork ${baseName}`} width={640}>
      <p className={s.modalLede}>
        From <b>{baseName}</b>{parent ? '' : ` v${version}`}. Swap nodes, then open a pull request when the product should have it.
      </p>

      <label className={s.field}>
        <span className={s.fieldLabel}>Name</span>
        <input
          className={s.input}
          value={finalName}
          onChange={(e) => {
            setTouched(true);
            setName(e.target.value);
          }}
          placeholder={suggested}
        />
      </label>

      <div className={s.fieldLabel}>Swap nodes</div>
      <div className={s.swapList}>
        {swappable.map((n) => {
          const def = nodeType(n.type);
          const group = swapGroupOf(n.type);
          const alts = swapAlternatives(n.type);
          const cur = chosen[n.id] ?? '';
          return (
            <div key={n.id} className={s.swapRowD} data-changed={!!cur}>
              <div className={s.swapNode}>
                <NodeIcon type={cur || n.type} size={30} />
                <div className={s.swapNodeText}>
                  <b>{n.name}</b>
                  <small>
                    {def.label}
                    {group ? ` · ${group.label}` : ''}
                  </small>
                </div>
              </div>
              <div className={s.altChips} role="radiogroup" aria-label={`Tool for ${n.name}`}>
                <button type="button" role="radio" aria-checked={!cur} className={s.altChip} data-on={!cur} onClick={() => setChosen((c) => ({ ...c, [n.id]: '' }))}>
                  Keep {def.label}
                </button>
                {alts.map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={cur === t} className={s.altChip} data-on={cur === t} onClick={() => setChosen((c) => ({ ...c, [n.id]: t }))}>
                    <NodeIcon type={t} size={16} />
                    {nodeType(t).label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {swappable.length === 0 && <div className={s.diffEmpty}>This flow has no swappable tools. The fork starts identical and diverges with your commits.</div>}
      </div>

      <label className={s.field}>
        <span className={s.fieldLabel}>Description (optional)</span>
        <textarea className={s.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this variant exists, for the people who find it later" />
      </label>

      <div className={s.dialogFoot}>
        <div className={s.dialogBtns}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!finalName.trim()} onClick={create}>
            <GitFork /> Create fork
          </Button>
        </div>
      </div>
    </Modal>
  );
}
