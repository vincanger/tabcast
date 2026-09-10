// Chapter markers derived from where each article's narration starts. Shared
// by the episode page and the podcast feed so both list the same chapters.
export type Chapter = { startSeconds: number; title: string; url?: string };

export function chaptersFor(
  articles: { title: string; url: string; startSeconds: number | null }[],
): Chapter[] {
  const marked = articles
    .flatMap((a) =>
      a.startSeconds === null ? [] : [{ startSeconds: a.startSeconds, title: a.title, url: a.url }],
    )
    .sort((a, b) => a.startSeconds - b.startSeconds);
  if (marked.length === 0) return [];
  // The intro is a chapter of its own unless the first article starts at zero.
  return marked[0].startSeconds > 0
    ? [{ startSeconds: 0, title: "Introduction" }, ...marked]
    : marked;
}
