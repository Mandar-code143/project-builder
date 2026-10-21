// Domain types for the intelligent agent pipeline.
import type { PlanningResult } from "./planning";

export type SessionEventKind =
  | "task"
  | "condition"
  | "plan"
  | "constraint"
  | "scenario";

export interface SessionEvent {
  id: string;
  /** ISO timestamp of when the event was recorded. */
  timestamp: string;
  kind: SessionEventKind;
  message: string;
}

/**
 * Internal state maintained by the model-based campus agent.
 * Distinguishes the latest observations (already applied to the graph/tasks)
 * from the stored internal model built across observations and actions.
 */
export interface AgentState {
  /** Where the student currently stands. */
  currentLocationId: string;
  completedTaskIds: string[];
  /** Latest queue-time observations keyed by task id. */
  queueObservations: Record<string, number>;
  /** Latest calculated plan snapshot, if any. */
  latestPlan: PlanningResult | null;
  /** Short history of meaningful observations and actions. */
  events: SessionEvent[];
}

export interface ReflexPercept {
  taskId: string;
  taskTitle: string;
  counterOpen: boolean;
  routeAvailable: boolean;
  taskCompleted: boolean;
  remainingMinutes: number;
  estimatedMinutes: number;
}

export type ReflexAction = "proceed" | "ineligible" | "warn" | "skip";

export interface ReflexDecision {
  taskId: string;
  rule: string;
  action: ReflexAction;
  message: string;
}
