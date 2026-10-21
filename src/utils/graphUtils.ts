// Shared graph helpers used by every search algorithm. All algorithms read
// the campus graph through these utilities so edge semantics stay consistent.
import type { CampusEdge, CampusGraph, CampusNode } from "@/types/campus";

export interface Adjacency {
  neighbors: Map<string, { to: string; minutes: number; blocked: boolean }[]>;
  nodes: Map<string, CampusNode>;
  /** Undirected edge lookup keyed as "a|b" with sorted ids. */
  edges: Map<string, CampusEdge>;
}

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Builds an undirected adjacency list; blocked edges are retained but flagged. */
export function buildAdjacency(graph: CampusGraph): Adjacency {
  const neighbors = new Map<
    string,
    { to: string; minutes: number; blocked: boolean }[]
  >();
  for (const node of graph.nodes) neighbors.set(node.id, []);
  const edges = new Map<string, CampusEdge>();
  for (const edge of graph.edges) {
    if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) continue;
    edges.set(edgeKey(edge.from, edge.to), edge);
    neighbors.get(edge.from)!.push({
      to: edge.to,
      minutes: edge.minutes,
      blocked: edge.blocked,
    });
    neighbors.get(edge.to)!.push({
      to: edge.from,
      minutes: edge.minutes,
      blocked: edge.blocked,
    });
  }
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  return { neighbors, nodes, edges };
}

export function euclideanDistance(
  graph: CampusGraph,
  aId: string,
  bId: string,
): number {
  const a = graph.nodes.find((n) => n.id === aId);
  const b = graph.nodes.find((n) => n.id === bId);
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Conservative scale factor making h(n) = scale * euclid(n, goal) admissible.
 * scale = min over all edges of (edge minutes / edge length). By the triangle
 * inequality every path costs at least scale * straight-line distance, so the
 * heuristic never overestimates the true shortest walking cost.
 */
export function heuristicScale(graph: CampusGraph): number {
  let scale = Number.POSITIVE_INFINITY;
  for (const edge of graph.edges) {
    const dist = euclideanDistance(graph, edge.from, edge.to);
    if (dist <= 0) continue;
    scale = Math.min(scale, edge.minutes / dist);
  }
  return Number.isFinite(scale) ? scale : 0;
}

/** Admissible straight-line walking-time estimate between two nodes. */
export function heuristic(
  graph: CampusGraph,
  scale: number,
  fromId: string,
  toId: string,
): number {
  return scale * euclideanDistance(graph, fromId, toId);
}

/** Actual walking cost of a path; returns Infinity when any hop is missing/blocked. */
export function pathCost(
  adjacency: Adjacency,
  path: string[],
): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = adjacency.edges.get(edgeKey(path[i], path[i + 1]));
    if (!edge || edge.blocked) return Number.POSITIVE_INFINITY;
    total += edge.minutes;
  }
  return total;
}

/**
 * Breadth-first reachability over unblocked edges.
 * Used by the logic agent to report whether a destination can be reached at all.
 */
export function isReachable(
  graph: CampusGraph,
  fromId: string,
  toId: string,
): boolean {
  if (fromId === toId) return graph.nodes.some((n) => n.id === fromId);
  const adjacency = buildAdjacency(graph);
  if (!adjacency.nodes.has(fromId) || !adjacency.nodes.has(toId)) return false;
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.neighbors.get(current) ?? []) {
      if (neighbor.blocked || visited.has(neighbor.to)) continue;
      if (neighbor.to === toId) return true;
      visited.add(neighbor.to);
      queue.push(neighbor.to);
    }
  }
  return false;
}

/** Node lookup with a friendly fallback name for unknown ids. */
export function nodeName(graph: CampusGraph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.name ?? `Unknown (${id})`;
}
