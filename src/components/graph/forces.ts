/**
 * Custom d3-force: pulls every workflow toward a blend of its company's
 * live centroid and a fixed anchor, so companies form loose Obsidian-style
 * "groups" without collapsing into the middle.
 */
import type { Force } from 'd3-force';
import type { GraphNode } from './model';

export interface ClusterForce extends Force<GraphNode, undefined> {
  anchors(a: Map<string, { x: number; y: number }>): ClusterForce;
  strength(s: number): ClusterForce;
}

export function forceCluster(): ClusterForce {
  let nodes: GraphNode[] = [];
  let anchors = new Map<string, { x: number; y: number }>();
  let strength = 0.08;
  const sums = new Map<string, { x: number; y: number; n: number }>();

  const force = ((alpha: number) => {
    sums.clear();
    for (const n of nodes) {
      if (!n.companyId) continue;
      let s = sums.get(n.companyId);
      if (!s) sums.set(n.companyId, (s = { x: 0, y: 0, n: 0 }));
      s.x += n.x;
      s.y += n.y;
      s.n++;
    }
    const k = strength * alpha;
    for (const n of nodes) {
      if (!n.companyId) continue;
      const s = sums.get(n.companyId)!;
      const a = anchors.get(n.companyId);
      let tx = s.x / s.n;
      let ty = s.y / s.n;
      if (a) {
        tx = tx * 0.3 + a.x * 0.7;
        ty = ty * 0.3 + a.y * 0.7;
      }
      n.vx = (n.vx ?? 0) + (tx - n.x) * k;
      n.vy = (n.vy ?? 0) + (ty - n.y) * k;
    }
  }) as ClusterForce;

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns;
  };
  force.anchors = (a) => {
    anchors = a;
    return force;
  };
  force.strength = (s) => {
    strength = s;
    return force;
  };
  return force;
}
