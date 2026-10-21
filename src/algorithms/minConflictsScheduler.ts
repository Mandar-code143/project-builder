// [P5 — CSP AND MIN-CONFLICTS] Variables represent task positions, domains represent
// candidate positions, and Min-Conflicts reduces violated constraints.
import type { CampusGraph } from "@/types/campus";
import type { CampusTask } from "@/types/tasks";
import type { MinConflictsResult } from "@/types/planning";
import { aStarSearch } from "./aStar";

export interface SchedulerInput {
  graph: CampusGraph;
  tasks: CampusTask[];
  selectedTaskIds: string[];
  breakMinutes: number;
}

interface ScheduleEvaluation {
  order: string[];
  totalMinutes: number;
  completionMinutes: Record<string, number>;
  conflicts: string[];
  conflictedVariables: Set<string>;
}

/** Deterministic seeded PRNG (mulberry32) so every demonstration is repeatable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Evaluates an ordering: walks the shortest route between consecutive task
 * locations, applies queue + service time, and counts every violated constraint.
 */
export function evaluateOrder(
  graph: CampusGraph,
  orderedTasks: CampusTask[],
  breakMinutes: number,
  assignment: Record<string, number>,
): ScheduleEvaluation {
  const conflicts: string[] = [];
  const conflictedVariables = new Set<string>();
  const completionMinutes: Record<string, number> = {};
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const taskById = new Map(orderedTasks.map((t) => [t.id, t]));

  // Constraint 1: distinct positions.
  const byPosition = new Map<number, string[]>();
  for (const task of orderedTasks) {
    const pos = assignment[task.id];
    byPosition.set(pos, [...(byPosition.get(pos) ?? []), task.id]);
  }
  for (const [pos, ids] of byPosition) {
    if (ids.length > 1) {
      conflicts.push(`Position ${pos} is claimed by ${ids.length} tasks (positions must be distinct).`);
      ids.forEach((id) => conflictedVariables.add(id));
    }
  }

  // Stable ordering: by position, tie-broken by task id.
  const order = [...orderedTasks]
    .sort((a, b) => (assignment[a.id] ?? 0) - (assignment[b.id] ?? 0) || a.id.localeCompare(b.id))
    .map((t) => t.id);

  // Constraint 2: prerequisite precedence.
  for (const task of orderedTasks) {
    for (const prereqId of task.prerequisiteTaskIds) {
      if (!taskById.has(prereqId)) continue; // prereq already completed or not selected
      if (assignment[prereqId] >= assignment[task.id]) {
        conflicts.push(
          `"${taskById.get(prereqId)!.title}" must be scheduled before "${task.title}".`,
        );
        conflictedVariables.add(task.id);
      }
    }
  }

  // Simulate the schedule with shortest walking times between stops.
  let elapsed = 0;
  let currentLocation: string | null = null;
  for (const id of order) {
    const task = taskById.get(id)!;
    const node = nodeById.get(task.locationId);
    if (currentLocation !== null && currentLocation !== task.locationId) {
      const leg = aStarSearch(graph, currentLocation, task.locationId);
      if (!leg.success) {
        conflicts.push(`No walking route to "${node?.name ?? task.locationId}" for "${task.title}".`);
        conflictedVariables.add(id);
        elapsed = Number.POSITIVE_INFINITY;
        break;
      }
      elapsed += leg.costMinutes;
    }
    currentLocation = task.locationId;
    const completion = elapsed + task.queueMinutes + task.serviceMinutes;
    completionMinutes[id] = completion;
    // Constraint 3: deadlines.
    if (task.deadlineMinute !== null && completion > task.deadlineMinute) {
      conflicts.push(
        `"${task.title}" would finish at minute ${completion}, past its deadline of minute ${task.deadlineMinute}.`,
      );
      conflictedVariables.add(id);
    }
    // Constraint 4: counter availability.
    if (!task.available || !node?.open) {
      conflicts.push(`"${task.title}" cannot be served because its counter is closed.`);
      conflictedVariables.add(id);
    }
    elapsed = completion;
  }

  // Constraint 5: total break-time budget.
  const totalMinutes = Number.isFinite(elapsed) ? elapsed : Number.POSITIVE_INFINITY;
  if (totalMinutes > breakMinutes) {
    conflicts.push(
      `The schedule needs ${Number.isFinite(totalMinutes) ? Math.round(totalMinutes) : "infinite"} min, beyond the ${breakMinutes}-min break.`,
    );
    orderedTasks.forEach((t) => conflictedVariables.add(t.id));
  }

  return { order, totalMinutes, completionMinutes, conflicts, conflictedVariables };
}

/**
 * Min-Conflicts local search. Variables = selected tasks, domains = positions
 * 0..n-1. Repeats: pick a conflicted variable, move it to the value that
 * minimizes total conflicts (ties broken toward the smaller position), until a
 * conflict-free assignment is found or the iteration limit is reached. Up to
 * three seeded restarts guard against unlucky local minima.
 */
export function minConflictsSchedule(
  input: SchedulerInput,
  maxIterations = 300,
): MinConflictsResult {
  const { graph, tasks, selectedTaskIds, breakMinutes } = input;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const selected = selectedTaskIds
    .map((id) => taskById.get(id))
    .filter((t): t is CampusTask => t !== undefined);

  const empty: MinConflictsResult = {
    success: false,
    assignment: {},
    conflictsBefore: 0,
    conflictsAfter: 0,
    iterations: 0,
    restarts: 0,
    remainingConflicts: [],
    order: [],
    scheduleTotalMinutes: 0,
    completionMinutes: {},
  };
  if (selected.length === 0) {
    return { ...empty, success: true, remainingConflicts: [], remainingConflictsMessage: undefined } as MinConflictsResult;
  }

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;

  // Initial assignment: prerequisite-aware order (topological where possible),
  // high-priority tasks first. Restart seeds shuffle this deterministically.
  const initialOrder = [...selected].sort((a, b) => {
    const aNeedsB = a.prerequisiteTaskIds.includes(b.id);
    const bNeedsA = b.prerequisiteTaskIds.includes(a.id);
    if (aNeedsB) return 1;
    if (bNeedsA) return -1;
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    return p !== 0 ? p : a.id.localeCompare(b.id);
  });

  const evaluateAssignment = (assignment: Record<string, number>) =>
    evaluateOrder(graph, selected, breakMinutes, assignment);

  let best: MinConflictsResult | null = null;
  const random = mulberry32(20260211);

  for (let restart = 0; restart < 3; restart++) {
    const order = [...initialOrder];
    if (restart > 0) {
      // Deterministic shuffle for the restart's initial assignment.
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    let assignment: Record<string, number> = {};
    order.forEach((t, i) => (assignment[t.id] = i));

    let evaluation = evaluateAssignment(assignment);
    const conflictsBefore = evaluation.conflicts.length;
    let iterations = 0;

    while (evaluation.conflicts.length > 0 && iterations < maxIterations) {
      const candidates = [...evaluation.conflictedVariables];
      if (candidates.length === 0) break;
      // Pick a conflicted variable (seeded choice keeps runs repeatable).
      const variable = candidates[Math.floor(random() * candidates.length)];
      let bestValue = assignment[variable];
      let bestConflictCount = evaluation.conflicts.length;
      for (let value = 0; value < selected.length; value++) {
        if (value === assignment[variable]) continue;
        const trial = { ...assignment, [variable]: value };
        const trialEval = evaluateAssignment(trial);
        if (
          trialEval.conflicts.length < bestConflictCount ||
          (trialEval.conflicts.length === bestConflictCount && value < bestValue)
        ) {
          bestConflictCount = trialEval.conflicts.length;
          bestValue = value;
        }
      }
      assignment = { ...assignment, [variable]: bestValue };
      evaluation = evaluateAssignment(assignment);
      iterations++;
    }

    const result: MinConflictsResult = {
      success: evaluation.conflicts.length === 0,
      assignment,
      conflictsBefore,
      conflictsAfter: evaluation.conflicts.length,
      iterations,
      restarts: restart + 1,
      remainingConflicts: evaluation.conflicts,
      order: evaluation.order,
      scheduleTotalMinutes: Number.isFinite(evaluation.totalMinutes)
        ? Math.round(evaluation.totalMinutes * 10) / 10
        : Number.POSITIVE_INFINITY,
      completionMinutes: evaluation.completionMinutes,
    };
    if (
      best === null ||
      result.conflictsAfter < best.conflictsAfter ||
      (result.conflictsAfter === best.conflictsAfter && result.iterations < best.iterations)
    ) {
      best = result;
    }
    if (best.success) break;
  }

  return best ?? empty;
}
