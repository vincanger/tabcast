// Slot arithmetic for automatic generation. Everything is UTC; the dashboard
// converts to and from the user's local time.

export const TICK_MINUTES = [0, 30] as const;
export const EVERY_DAYS_OPTIONS = [1, 7] as const;

// The next occurrence of hour:minute strictly after now.
export function firstRun(hourUtc: number, minuteUtc: number, now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// Steps forward from the planned time, not from now, so a weekly schedule
// keeps its weekday after downtime. The loop skips any slots that were missed.
export function nextRun(from: Date, everyDays: number, now = new Date()): Date {
  const next = new Date(from);
  do next.setUTCDate(next.getUTCDate() + everyDays);
  while (next <= now);
  return next;
}
