import NodeID3 from "node-id3";

type Part = { title: string; seconds: number; empty: boolean };

// Prepends an ID3v2 tag with one chapter per part and a table of contents.
// Apple Podcasts and most other apps read chapters from the file itself, so
// this works even when the feed's chapter JSON is never fetched.
export function withChapterTags(audio: Buffer, episode: { title: string; parts: Part[] }): Buffer {
  const chapters: { elementID: string; startTimeMs: number; endTimeMs: number; tags: { title: string } }[] = [];
  let at = 0;
  episode.parts.forEach((part, i) => {
    const start = at;
    at += part.seconds;
    // Empty parts never made it into the audio, so they get no chapter.
    if (part.empty || part.seconds <= 0) return;
    chapters.push({
      elementID: `ch${i}`,
      startTimeMs: Math.round(start * 1000),
      endTimeMs: Math.round(at * 1000),
      tags: { title: part.title },
    });
  });
  if (chapters.length === 0) return audio;

  const tag = NodeID3.create({
    title: episode.title,
    artist: "Article to Podcast",
    chapter: chapters,
    tableOfContents: [
      { elementID: "toc", isOrdered: true, elements: chapters.map((c) => c.elementID) },
    ],
  });
  return Buffer.concat([tag, audio]);
}
