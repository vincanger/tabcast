// The one order articles are ever listed in: the inbox, the episode page,
// the feed's chapters and the narration itself all use it, so what the user
// sees in the inbox is what they hear. Ranked articles first, by position;
// then the rest as they were saved.
export const ARTICLE_ORDER = [
  { position: { sort: "asc" as const, nulls: "last" as const } },
  { savedAt: "asc" as const },
];
