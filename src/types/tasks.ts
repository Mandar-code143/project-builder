// Domain types for campus errand tasks.
export type TaskPriority = "high" | "medium" | "low";

export interface CampusTask {
  id: string;
  title: string;
  description: string;
  /** CampusNode id where this task is performed. */
  locationId: string;
  /** Minutes spent being served at the counter. */
  serviceMinutes: number;
  /** Estimated minutes spent waiting in the queue before service. */
  queueMinutes: number;
  priority: TaskPriority;
  /** Completion deadline relative to the start of the break (minute 0), or null. */
  deadlineMinute: number | null;
  /** Task ids that must be completed before this task. */
  prerequisiteTaskIds: string[];
  /** Whether the counter serving this task is currently available. */
  available: boolean;
  /** Whether the student has already completed this task. */
  completed: boolean;
}

export type TaskDraft = Omit<CampusTask, "id" | "completed"> & { id?: string };
