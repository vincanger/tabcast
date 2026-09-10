import OpenAI from "openai";
import { env } from "wasp/server";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Narration pace used to size the script and estimate duration.
export const WORDS_PER_MINUTE = 150;

// Roughly 2,000 words per article keeps 15 articles inside a small context window.
const MAX_CHARS_PER_ARTICLE = 12_000;

export type ScriptSource = {
  title: string;
  siteName: string | null;
  byline: string | null;
  url: string;
  textContent: string;
};

// The script is written and kept in parts. Each article's segment is its own
// model call, which does two things: a small model reliably hits a few hundred
// words where it undershoots a fifteen hundred word script, and every segment
// maps to exactly one article, which is what the chapter marks need.
export type GeneratedScript = {
  title: string;
  intro: string;
  // One entry per source, in the order given.
  segments: string[];
  outro: string;
};

export function scriptText(script: GeneratedScript): string {
  return [script.intro, ...script.segments, script.outro].filter((p) => p.trim()).join("\n\n");
}

// Structured outputs. The older `json_object` format additionally requires the
// word "json" inside the input messages, which `instructions` does not count as
// on the Responses API, and it does not guarantee the fields come back.
const FRAME_FORMAT = {
  type: "json_schema" as const,
  name: "episode_frame",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Episode title, at most eight words." },
      intro: { type: "string", description: "The opening narration, before the first article." },
      outro: { type: "string", description: "The closing narration, after the last article." },
    },
    required: ["title", "intro", "outro"],
    additionalProperties: false,
  },
};

const SEGMENT_FORMAT = {
  type: "json_schema" as const,
  name: "episode_segment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      narration: { type: "string", description: "The narration for this article, spoken word for word." },
    },
    required: ["narration"],
    additionalProperties: false,
  },
};

// A segment shorter than this fraction of its budget gets one expansion pass.
const MIN_FILL_RATIO = 0.85;

// Words reserved for the intro and sign off together.
const FRAME_WORDS = 60;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// How much room each article gets, and how heavily to quote it. Longer targets
// buy more and longer quotes rather than more padding around them.
function budget(targetMinutes: number, sourceCount: number) {
  const targetWords = targetMinutes * WORDS_PER_MINUTE;
  const perArticleWords = Math.max(90, Math.floor((targetWords - FRAME_WORDS) / sourceCount));
  const quotesPerArticle = Math.min(4, Math.max(1, Math.round(perArticleWords / 110)));
  const quoteLength = perArticleWords > 260 ? "two to four sentences" : "one or two sentences";
  return { perArticleWords, quotesPerArticle, quoteLength };
}

type Budget = ReturnType<typeof budget>;

function describeSource(s: ScriptSource, index: number): string {
  const meta = [s.byline ? `By ${s.byline}` : null, s.siteName ? `Published on ${s.siteName}` : null]
    .filter(Boolean)
    .join(". ");
  return [`### Article ${index + 1}: ${s.title}`, meta || null, truncate(s.textContent, MAX_CHARS_PER_ARTICLE)]
    .filter(Boolean)
    .join("\n");
}

const VOICE = [
  "Speak in plain, conversational English. Write only what the narrator says. No headings, no bullet points, no markdown, no stage directions, no music cues.",
  "Do not mention that you are an AI.",
];

export async function writeScript(
  sources: ScriptSource[],
  targetMinutes: number,
): Promise<GeneratedScript> {
  const b = budget(targetMinutes, sources.length);
  const [frame, ...segments] = await Promise.all([
    writeFrame(sources, targetMinutes),
    ...sources.map((source, i) => writeSegment(source, i, sources.length, b)),
  ]);
  if (segments.every((s) => !s.trim())) throw new Error("The model returned an empty script.");
  return { ...frame, segments };
}

// Title, intro and sign off, from the article list alone.
async function writeFrame(
  sources: ScriptSource[],
  targetMinutes: number,
): Promise<{ title: string; intro: string; outro: string }> {
  const list = sources
    .map((s, i) => {
      const who = s.byline ? ` by ${s.byline}` : s.siteName ? ` from ${s.siteName}` : "";
      return `${i + 1}. ${s.title}${who}`;
    })
    .join("\n");

  const instructions = [
    "You write the opening and closing of a short, single narrator podcast that summarizes articles the listener saved. The article segments themselves are written separately.",
    "The intro is one or two sentences that say how many articles are covered and preview them in a phrase or two. The sign off is one sentence.",
    "Give the episode a title of at most eight words.",
    ...VOICE,
  ].join(" ");

  const response = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions,
    input: `Articles in this ${targetMinutes} minute episode:\n${list}`,
    text: { format: FRAME_FORMAT },
  });
  return parseFrame(response.output_text);
}

// One article's segment, given only that article.
async function writeSegment(
  source: ScriptSource,
  index: number,
  count: number,
  { perArticleWords, quotesPerArticle, quoteLength }: Budget,
): Promise<string> {
  const article = describeSource(source, index);
  const instructions = [
    "You write one segment of a short, single narrator podcast that summarizes articles the listener saved.",
    `This is article ${index + 1} of ${count}. The segment is read aloud at about ${WORDS_PER_MINUTE} words per minute and should be about ${perArticleWords} words.`,
    `Write at least ${Math.round(perArticleWords * 0.9)} words. Keep going until you reach that length instead of wrapping up early.`,
    "Start by naming the article title and its author, or the publication when no author is given, then explain the key points and why they matter.",
    `Include at least ${quotesPerArticle} direct quote${quotesPerArticle === 1 ? "" : "s"} from the article, each ${quoteLength} long.`,
    "Copy every quote word for word from the article text. Never invent, trim or paraphrase a quote.",
    "Choose quotes that are surprising, opinionated, or memorable. Skip generic scene setting.",
    "Lead into each quote so the listener knows whose words they are, for example: as she puts it, or in his words.",
    "Write only this article's segment. No episode introduction, no sign off, no mention of the other articles.",
    ...VOICE,
  ].join(" ");

  const first = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions,
    input: article,
    text: { format: SEGMENT_FORMAT },
  });
  const draft = parseNarration(first.output_text);
  const words = wordCount(draft);
  if (words >= perArticleWords * MIN_FILL_RATIO) return draft;

  // Small models routinely stop early. Ask once for the rest.
  console.log(`[writeScript] Segment ${index + 1} was ${words} words, expanding toward ${perArticleWords}.`);
  const second = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions: [
      "You lengthen one segment of a podcast script without changing its voice or structure.",
      `The segment must reach about ${perArticleWords} words. It is currently ${words} words, which is too short.`,
      `Add depth: more of the article's reasoning and examples, and more direct quotes of ${quoteLength} each, copied word for word from the article. Never invent a quote.`,
      "Keep the opening that names the article. Do not repeat sentences to pad the length.",
      ...VOICE,
    ].join(" "),
    input: `# Current segment\n${draft}\n\n# Source article\n${article}`,
    text: { format: SEGMENT_FORMAT },
  });
  const expanded = parseNarration(second.output_text);
  console.log(`[writeScript] Segment ${index + 1} expanded to ${wordCount(expanded)} words.`);
  return wordCount(expanded) > words ? expanded : draft;
}

// OpenAI text to speech accepts at most 4096 characters per request.
const MAX_TTS_CHARS = 4000;

export async function narrate(script: string): Promise<Buffer> {
  const chunks = splitForTts(script, MAX_TTS_CHARS);
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await client.audio.speech.create({
      model: env.OPENAI_TTS_MODEL,
      voice: env.OPENAI_TTS_VOICE,
      input: chunk,
      response_format: "mp3",
    });
    buffers.push(Buffer.from(await response.arrayBuffer()));
  }
  // MP3 is a frame based format, so back to back files play as one stream.
  return Buffer.concat(buffers);
}

export function estimateDurationSeconds(script: string): number {
  const words = wordCount(script);
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

function parseFrame(raw: string): { title: string; intro: string; outro: string } {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      title: str(obj.title) || "Your saved articles",
      intro: str(obj.intro),
      outro: str(obj.outro),
    };
  } catch {
    return { title: "Your saved articles", intro: raw.trim(), outro: "" };
  }
}

function parseNarration(raw: string): string {
  try {
    return str((JSON.parse(raw) as Record<string, unknown>).narration);
  } catch {
    // Fall back to treating the whole output as the narration.
    return raw.trim();
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[article truncated]";
}

// Split on paragraph, then sentence boundaries so no chunk cuts a word.
function splitForTts(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const pieces = text
    .split(/\n\s*\n/)
    .flatMap((p) => p.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) ?? [p]);

  for (const piece of pieces) {
    if (piece.length > maxChars) {
      if (current) chunks.push(current);
      current = "";
      for (let i = 0; i < piece.length; i += maxChars) chunks.push(piece.slice(i, i + maxChars));
      continue;
    }
    if ((current + piece).length > maxChars) {
      chunks.push(current);
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks.map((c) => c.trim()).filter(Boolean);
}
