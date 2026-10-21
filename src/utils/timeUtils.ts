// Relative-time helpers. The start of the break is minute 0; every planning
// timestamp is expressed as "minute N" (plus an optional wall-clock style label).

/** Formats a minute offset for the UI, e.g. "minute 14" or "minute 0 (now)". */
export function formatMinute(minute: number): string {
  return `minute ${Math.round(minute * 100) / 100}`;
}

/** Formats minutes as a short duration label, e.g. "1h 05m" or "42m". */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes * 10) / 10;
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = Math.round(rounded - hours * 60);
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function clampMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
