// [P9 — FORWARD STATE-SPACE SEARCH] Expands states from the initial campus/task state
// through valid actions toward a goal state.
import type { CampusGraph } from "@/types/campus";
import type { CampusTask } from "@/types/tasks";
import { PriorityQueue } from "@/utils/priorityQueue";
import {
  buildAdjacency,
  heuristic,
  heuristicScale,
} from "@/utils/graphUtils";

export interface StateSpaceInput {
  graph: CampusGraph;
  tasks: CampusTask[];
  selectedTaskIds: string[];
  startLocationId: string;
  breakMinutes: number;
}

export type PlannerAction =
  | { type: "move"; fromId: string; toId: string; minutes: number }
  | {
      type: "complete";
      taskId: string;
      queueMinutes: number;
      serviceMinutes: number;
      minutes: number;
    };

export interface StateSpaceResult {
  /** True when every plannable task fits inside the break budget. */
  goalReached: boolean;
  /** Action sequence of the best plan found (full or partial). */
  actions: PlannerAction[];
  completedTaskIds: string[];
  elapsedMinutes: number;
  expandedStates: number;
  frontierPeak: number;
  exploredSamples: {
    locationId: string;
    completedTaskIds: string[];
    elapsedMinutes: number;
    priority: number;
  }[];
  /** Selected tasks excluded before searching, with the reason. */
  excludedTasks: { taskId: string; reason: string }[];
  failureReason: string | null;
}

interface SearchState {
  locationId: string;
  mask: number;
  elapsed: number;
  parent: SearchState | null;
  action: PlannerAction | null;
}

/**
 * Forward search over combined movement + task-completion states.
 * State = (current location, bitmask of completed plannable tasks); the elapsed
 * time acts as the path cost g(n). Because finishing earlier is never worse
 * (all later actions simply shift earlier), the search keeps only the minimum
 * elapsed time per (location, mask) key — a safe dominance pruning.
 */
export function forwardStateSpaceSearch(input: StateSpaceInput): StateSpaceResult {
  const { graph, tasks, selectedTaskIds, startLocationId, breakMinutes } = input;

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const alreadyCompleted = tasks.filter((t) => t.completed).map((t) => t.id);
  const completedSet = new Set(alreadyCompleted);

  const selected = selectedTaskIds
    .map((id) => taskById.get(id))
    .filter((t): t is CampusTask => t !== undefined && !t.completed);

  // Exclude tasks that can never be executed under current conditions, and
  // propagate exclusions to dependents (their prerequisite can never complete).
  const excluded: { taskId: string; reason: string }[] = [];
  const excludedIds = new Set<string>();
  let changed = true;
  const openCheck = (t: CampusTask) =>
    t.available && (graph.nodes.find((n) => n.id === t.locationId)?.open ?? false);

  while (changed) {
    changed = false;
    for (const task of selected) {
      if (excludedIds.has(task.id)) continue;
      if (!openCheck(task)) {
        excludedIds.add(task.id);
        excluded.push({
          taskId: task.id,
          reason: `The counter at "${graph.nodes.find((n) => n.id === task.locationId)?.name ?? task.locationId}" is closed, so this task cannot be completed now.`,
        });
        changed = true;
        continue;
      }
      for (const prereqId of task.prerequisiteTaskIds) {
        const prereq = taskById.get(prereqId);
        if (!prereq) {
          excludedIds.add(task.id);
          excluded.push({ taskId: task.id, reason: `Prerequisite "${prereqId}" does not exist.` });
          changed = true;
          break;
        }
        if (completedSet.has(prereqId)) continue;
        if (!selectedTaskIds.includes(prereqId) || excludedIds.has(prereqId)) {
          excludedIds.add(task.id);
          excluded.push({
            taskId: task.id,
            reason: `Its prerequisite "${prereq.title}" is not completable in this break, so this task cannot be reached either.`,
          });
          changed = true;
          break;
        }
      }
    }
  }

  const plannable = selected.filter((t) => !excludedIds.has(t.id));
  const plannableIds = plannable.map((t) => t.id);
  const indexOf = new Map(plannableIds.map((id, i) => [id, i]));
  const fullMask = plannableIds.length === 0 ? 0 : (1 << plannableIds.length) - 1;

  const result: StateSpaceResult = {
    goalReached: plannable.length === 0,
    actions: [],
    completedTaskIds: [...alreadyCompleted],
    elapsedMinutes: 0,
    expandedStates: 0,
    frontierPeak: 0,
    exploredSamples: [],
    excludedTasks: excluded,
    failureReason: null,
  };

  if (plannable.length === 0) {
    result.failureReason =
      excluded.length > 0
        ? "None of the selected tasks can currently be executed."
        : "There are no incomplete selected tasks to plan.";
    return result;
  }

  const adjacency = buildAdjacency(graph);
  const scale = heuristicScale(graph);
  const serviceAndQueue = new Map(
    plannable.map((t) => [t.id, t.serviceMinutes + t.queueMinutes]),
  );

  // Admissible lower bound: every remaining task costs its service+queue time,
  // and the student must at least walk to the nearest remaining task location.
  const lowerBound = (locationId: string, mask: number): number => {
    let serviceSum = 0;
    let nearest = Number.POSITIVE_INFINITY;
    for (const task of plannable) {
      const bit = 1 << indexOf.get(task.id)!;
      if (mask & bit) continue;
      serviceSum += serviceAndQueue.get(task.id)!;
      nearest = Math.min(
        nearest,
        heuristic(graph, scale, locationId, task.locationId),
      );
    }
    if (!Number.isFinite(nearest)) nearest = 0;
    return serviceSum + nearest;
  };

  const prereqSatisfied = (task: CampusTask, mask: number): boolean => {
    for (const prereqId of task.prerequisiteTaskIds) {
      if (completedSet.has(prereqId)) continue;
      const bit = indexOf.get(prereqId);
      if (bit === undefined || !(mask & (1 << bit))) return false;
    }
    return true;
  };

  const startState: SearchState = {
    locationId: startLocationId,
    mask: 0,
    elapsed: 0,
    parent: null,
    action: null,
  };

  const frontier = new PriorityQueue<{ state: SearchState }>();
  const bestElapsed = new Map<string, number>();
  const stateKey = (s: { locationId: string; mask: number }) =>
    `${s.locationId}#${s.mask}`;

  bestElapsed.set(stateKey(startState), 0);
  frontier.push({ state: startState }, lowerBound(startLocationId, 0));

  let expanded = 0;
  let bestGoal: SearchState | null = null;
  let bestGoalElapsed = Number.POSITIVE_INFINITY;
  let bestPartial: SearchState | null = startState;
  let bestPartialScore = { count: 0, elapsed: 0 };
  const popcount = (m: number) => m.toString(2).split("1").length - 1;

  while (!frontier.isEmpty()) {
    const { state } = frontier.pop()!;
    const key = stateKey(state);
    if ((bestElapsed.get(key) ?? Infinity) < state.elapsed) continue;
    expanded++;
    if (result.exploredSamples.length < 12) {
      result.exploredSamples.push({
        locationId: state.locationId,
        completedTaskIds: plannableIds.filter((_, i) => state.mask & (1 << i)),
        elapsedMinutes: state.elapsed,
        priority: state.elapsed + lowerBound(state.locationId, state.mask),
      });
    }

    const count = popcount(state.mask);
    if (
      count > bestPartialScore.count ||
      (count === bestPartialScore.count && state.elapsed < bestPartialScore.elapsed)
    ) {
      bestPartial = state;
      bestPartialScore = { count, elapsed: state.elapsed };
    }
    if (state.mask === fullMask && state.elapsed < bestGoalElapsed) {
      bestGoal = state;
      bestGoalElapsed = state.elapsed;
    }

    // Action 1: walk along any unblocked campus edge.
    for (const neighbor of adjacency.neighbors.get(state.locationId) ?? []) {
      if (neighbor.blocked) continue;
      const nextElapsed = state.elapsed + neighbor.minutes;
      if (nextElapsed > breakMinutes) continue;
      const next: SearchState = {
        locationId: neighbor.to,
        mask: state.mask,
        elapsed: nextElapsed,
        parent: state,
        action: {
          type: "move",
          fromId: state.locationId,
          toId: neighbor.to,
          minutes: neighbor.minutes,
        },
      };
      const nextKey = stateKey(next);
      if (nextElapsed < (bestElapsed.get(nextKey) ?? Infinity)) {
        bestElapsed.set(nextKey, nextElapsed);
        frontier.push({ state: next }, nextElapsed + lowerBound(next.locationId, next.mask));
      }
    }

    // Action 2: complete an eligible task at the current location.
    for (const task of plannable) {
      const bit = 1 << indexOf.get(task.id)!;
      if (state.mask & bit) continue;
      if (task.locationId !== state.locationId) continue;
      if (!prereqSatisfied(task, state.mask)) continue;
      if (!openCheck(task)) continue;
      const completion = state.elapsed + task.queueMinutes + task.serviceMinutes;
      if (completion > breakMinutes) continue;
      if (task.deadlineMinute !== null && completion > task.deadlineMinute) continue;

      const next: SearchState = {
        locationId: state.locationId,
        mask: state.mask | bit,
        elapsed: completion,
        parent: state,
        action: {
          type: "complete",
          taskId: task.id,
          queueMinutes: task.queueMinutes,
          serviceMinutes: task.serviceMinutes,
          minutes: task.queueMinutes + task.serviceMinutes,
        },
      };
      const nextKey = stateKey(next);
      if (next.elapsed < (bestElapsed.get(nextKey) ?? Infinity)) {
        bestElapsed.set(nextKey, next.elapsed);
        frontier.push({ state: next }, next.elapsed + lowerBound(next.locationId, next.mask));
      }
    }
  }

  result.expandedStates = expanded;
  result.frontierPeak = frontier.peakSize;

  const chosen = bestGoal ?? bestPartial;
  if (!chosen) {
    result.failureReason = "No feasible action sequence exists within the time budget.";
    return result;
  }

  // Reconstruct the action chain from the goal back to the start.
  const actions: PlannerAction[] = [];
  for (let s: SearchState | null = chosen; s !== null; s = s.parent) {
    if (s.action) actions.unshift(s.action);
  }

  result.goalReached = bestGoal !== null;
  result.actions = actions;
  result.elapsedMinutes = chosen.elapsed;
  result.completedTaskIds = [
    ...alreadyCompleted,
    ...plannableIds.filter((_, i) => chosen.mask & (1 << i)),
  ];
  if (!bestGoal) {
    const missed = plannableIds.filter(
      (id) => !result.completedTaskIds.includes(id),
    );
    result.failureReason = `Not every task fits the ${breakMinutes}-minute break; the plan above is the best feasible subset.`;
    result.excludedTasks = [
      ...excluded,
      ...missed.map((id) => ({
        taskId: id,
        reason: "Could not be reached and completed within the remaining time budget.",
      })),
    ];
  }
  return result;
}
