// [P4 — A* SEARCH] Uses f(n) = g(n) + h(n) to find a minimum-cost route with an admissible heuristic.
import type { CampusGraph } from "@/types/campus";
import type { RouteResult } from "@/types/planning";
import { PriorityQueue } from "@/utils/priorityQueue";
import {
  buildAdjacency,
  edgeKey,
  heuristic,
  heuristicScale,
  nodeName,
} from "@/utils/graphUtils";

/**
 * A* over the weighted campus graph.
 * g(n) is the accumulated walking cost; h(n) is a straight-line estimate
 * scaled so it can never overestimate the true remaining cost (admissible),
 * which guarantees the returned route is minimum-cost when one exists.
 */
export function aStarSearch(
  graph: CampusGraph,
  startId: string,
  goalId: string,
): RouteResult {
  const base = {
    strategy: "astar" as const,
    path: [],
    costMinutes: 0,
    frontierInsertions: 0,
    reachedGoal: false,
  };

  if (!graph.nodes.some((n) => n.id === startId)) {
    return { ...base, success: false, expandedNodes: 0, explanation: `Unknown starting location "${startId}".` };
  }
  if (!graph.nodes.some((n) => n.id === goalId)) {
    return { ...base, success: false, expandedNodes: 0, explanation: `Unknown destination "${goalId}".` };
  }
  if (startId === goalId) {
    return {
      ...base,
      success: true,
      path: [startId],
      reachedGoal: true,
      expandedNodes: 0,
      explanation: "Start and destination are the same location; no walking needed.",
    };
  }

  const adjacency = buildAdjacency(graph);
  const scale = heuristicScale(graph);
  const frontier = new PriorityQueue<{ id: string; g: number }>();
  const bestG = new Map<string, number>([[startId, 0]]);
  const parent = new Map<string, string>();
  const closed = new Set<string>();
  let expanded = 0;

  frontier.push({ id: startId, g: 0 }, heuristic(graph, scale, startId, goalId));
  let insertions = 1;

  while (!frontier.isEmpty()) {
    const current = frontier.pop()!;
    if (closed.has(current.id)) continue;
    closed.add(current.id);
    expanded++;

    if (current.id === goalId) {
      const path = reconstructPath(parent, startId, goalId);
      const cost = sumPathCost(adjacency, path);
      return {
        ...base,
        success: true,
        path,
        costMinutes: cost,
        reachedGoal: true,
        expandedNodes: expanded,
        frontierInsertions: insertions,
        explanation: `A* expanded ${expanded} node(s) and found the minimum-cost route of ${cost} min using f(n) = g(n) + h(n).`,
      };
    }

    for (const neighbor of adjacency.neighbors.get(current.id) ?? []) {
      if (neighbor.blocked || closed.has(neighbor.to)) continue;
      const tentativeG = current.g + neighbor.minutes;
      const known = bestG.get(neighbor.to);
      if (known === undefined || tentativeG < known) {
        bestG.set(neighbor.to, tentativeG);
        parent.set(neighbor.to, current.id);
        frontier.push(
          { id: neighbor.to, g: tentativeG },
          tentativeG + heuristic(graph, scale, neighbor.to, goalId),
        );
        insertions++;
      }
    }
  }

  return {
    ...base,
    success: false,
    expandedNodes: expanded,
    frontierInsertions: insertions,
    explanation: `No route exists from ${nodeName(graph, startId)} to ${nodeName(graph, goalId)} with the current connections (expanded ${expanded} nodes).`,
  };
}

export function reconstructPath(
  parent: Map<string, string>,
  startId: string,
  goalId: string,
): string[] {
  const path = [goalId];
  let node = goalId;
  while (node !== startId) {
    const prev = parent.get(node);
    if (!prev) return [];
    path.unshift(prev);
    node = prev;
  }
  return path;
}

/** Sums the real edge minutes along a path, so the reported cost is exact. */
export function sumPathCost(
  adjacency: ReturnType<typeof buildAdjacency>,
  path: string[],
): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = adjacency.edges.get(edgeKey(path[i], path[i + 1]));
    if (!edge) return Number.POSITIVE_INFINITY;
    total += edge.minutes;
  }
  return total;
}
