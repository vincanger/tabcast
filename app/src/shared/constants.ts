// Summary length is a budget, not a target: "up to 20 minutes". The steps
// grow with the number because 55 versus 60 is not a choice anyone makes.
export const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;
export const MIN_MINUTES = MINUTE_OPTIONS[0];
export const MAX_MINUTES = MINUTE_OPTIONS[MINUTE_OPTIONS.length - 1];
export const DEFAULT_MINUTES = 10;

// Below this the script has room for a mention of each article and not much
// else. A nudge, not a block.
export const MIN_MINUTES_PER_ARTICLE = 1;

// A full read longer than this is refused. Text to speech is priced per
// character, so a forgotten inbox must not quietly become a three hour bill.
export const FULL_READ_MAX_MINUTES = 90;

// Narration pace, used to size scripts and to estimate durations.
export const WORDS_PER_MINUTE = 150;

export type EpisodeMode = "summary" | "full";

export type EpisodeRequest =
  | { mode: "summary"; targetMinutes: number }
  | { mode: "full" };

export function estimateMinutes(words: number): number {
  return Math.ceil(words / WORDS_PER_MINUTE);
}

// What a summary will actually run to: the budget, unless the material is
// shorter than that. A summary longer than its source is padding.
export function summaryMinutes(budgetMinutes: number, words: number): number {
  return Math.max(1, Math.min(budgetMinutes, estimateMinutes(words)));
}
