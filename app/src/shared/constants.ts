export const MIN_MINUTES = 2;
export const MAX_MINUTES = 30;
export const DEFAULT_MINUTES = 5;

// The slider's last stop. Not a length: the episode reads every article
// verbatim, so its length is whatever the inbox adds up to.
export const FULL_READ = MAX_MINUTES + 1;

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
