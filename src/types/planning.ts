// Domain types for planning inputs and outputs.
import type { CampusEdge } from "./campus";

export type SearchStrategy = "astar" | "greedy";

export interface RouteResult {
  success: boolean;
  /** Node ids from start to goal (inclusive). Empty when no route exists. */
  path: string[];
  /** Actual walking minutes along the returned path, derived from edge weights. */
  costMinutes: number;
  /** Nodes removed from the frontier and expanded during the run. */
  expandedNodes: number;
  /** Times a node was inserted into the frontier. */
  frontierInsertions: number;
  reachedGoal: boolean;
  explanation: string;
  strategy: SearchStrategy;
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  /** Full node path walked for this leg, including intermediate nodes. */
  path: string[];
  travelMinutes: number;
}

export interface ScheduledTask {
  taskId: string;
  order: number;
  locationId: string;
  /** Travel leg that brought the student to this task's location. */
  leg: RouteLeg;
  /** Minute at which the student arrives at the location. */
  arrivalMinute: number;
  queueMinutes: number;
  /** Minute at which service starts (arrival + queue). */
  serviceStartMinute: number;
  serviceMinutes: number;
  /** Minute at which the task is fully completed. */
  completionMinute: number;
  deadlineMinute: number | null;
  deadlineMet: boolean;
  prerequisitesSatisfied: boolean;
}

export interface TimeBreakdown {
  walkingMinutes: number;
  serviceMinutes: number;
  waitingMinutes: number;
  totalElapsedMinutes: number;
  remainingMinutes: number;
  budgetUtilizationPercent: number;
}

export type FeasibilityStatus = "feasible" | "partial" | "none";

export interface PlanExplanation {
  /** Which agent or algorithm produced this explanation. */
  source: string;
  message: string;
}

export interface StateSpaceStats {
  expandedStates: number;
  frontierPeak: number;
  exploredSamples: {
    locationId: string;
    completedTaskIds: string[];
    elapsedMinutes: number;
    priority: number;
  }[];
}

export interface PlanningResult {
  status: FeasibilityStatus;
  scheduledTasks: ScheduledTask[];
  /** Selected tasks that could not be placed, with the reason. */
  unplacedTasks: { taskId: string; reason: string }[];
  breakdown: TimeBreakdown;
  warnings: string[];
  explanations: PlanExplanation[];
  searchStats: StateSpaceStats;
  /** Union of campus edges used by the recommended route, for map highlighting. */
  routeEdges: { from: string; to: string; minutes: number }[];
  /** Node ids of tasks in the recommended order, for map numbering. */
  taskOrderNodeIds: string[];
  infeasibilityReason: string | null;
}

/** Result of the CSP/Min-Conflicts scheduler. */
export interface MinConflictsResult {
  success: boolean;
  assignment: Record<string, number>;
  conflictsBefore: number;
  conflictsAfter: number;
  iterations: number;
  restarts: number;
  remainingConflicts: string[];
  /** Task ids in the proposed order. */
  order: string[];
  scheduleTotalMinutes: number;
  completionMinutes: Record<string, number>;
}

export interface EdgeRef {
  from: string;
  to: string;
}

export type { CampusEdge };
