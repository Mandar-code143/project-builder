// [P3 — GREEDY BEST-FIRST SEARCH] Selects frontier nodes using h(n), the estimated cost to the goal.
import type { CampusGraph } from "@/types/campus";
import type { RouteResult } from "@/types/planning";
import { PriorityQueue } from "@/utils/priorityQueue";
import {
  buildAdjacency,
  heuristic,
  heuristicScale,
  nodeName,
} from "@/utils/graphUtils";
import { reconstructPath, sumPathCost } from "./aStar";

/**
 * Greedy Best-First Search. The frontier priority is ONLY the heuristic h(n),
 * never g(n) + h(n). This makes the search fast and goal-directed, but on a
 * weighted graph it does NOT generally return the minimum-cost path — the UI
 * reports the actual measured cost so this can be compared against A*.
 */
export function greedyBestFirstSearch(
  graph: CampusGraph,
  startId: string,
  goalId: string,
): RouteResult {
  const base = {
    strategy: "greedy" as const,
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
  const frontier = new PriorityQueue<{ id: string }>();
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();
  let expanded = 0;
  let insertions = 1;

  frontier.push({ id: startId }, heuristic(graph, scale, startId, goalId));

  while (!frontier.isEmpty()) {
    const current = frontier.pop()!;
    if (closed.has(current.id)) continue;
    closed.add(current.id);
    expanded++;

    if (current.id === goalId) {
      const path = reconstructPath(cameFrom, startId, goalId);
      const cost = sumPathCost(adjacency, path);
      return {
        ...base,
        success: true,
        path,
        costMinutes: cost,
        reachedGoal: true,
        expandedNodes: expanded,
        frontierInsertions: insertions,
        explanation: `Greedy Best-First expanded ${expanded} node(s) choosing purely by h(n); actual route cost is ${cost} min (not guaranteed minimum).`,
      };
    }

    for (const neighbor of adjacency.neighbors.get(current.id) ?? []) {
      if (neighbor.blocked || closed.has(neighbor.to) || cameFrom.has(neighbor.to))
        continue;
      cameFrom.set(neighbor.to, current.id);
      frontier.push(
        { id: neighbor.to },
        heuristic(graph, scale, neighbor.to, goalId),
      );
      insertions++;
    }
  }

  return {
    ...base,
    success: false,
    expandedNodes: expanded,
    frontierInsertions: insertions,
    explanation: `No route found from ${nodeName(graph, startId)} to ${nodeName(graph, goalId)} (expanded ${expanded} nodes).`,
  };
}
