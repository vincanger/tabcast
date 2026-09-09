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

export type GeneratedScript = { title: string; script: string };

// Structured outputs. The older `json_object` format additionally requires the
// word "json" inside the input messages, which `instructions` does not count as
// on the Responses API, and it does not guarantee the fields come back.
const SCRIPT_FORMAT = {
  type: "json_schema" as const,
  name: "episode_script",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Episode title, at most eight words." },
      script: { type: "string", description: "The full narration, spoken word for word." },
    },
    required: ["title", "script"],
    additionalProperties: false,
  },
};

// A draft shorter than this fraction of the target gets one expansion pass.
const MIN_FILL_RATIO = 0.85;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// How much room each article gets, and how heavily to quote it. Longer targets
// buy more and longer quotes rather than more padding around them.
function budget(targetMinutes: number, sourceCount: number) {
  const targetWords = targetMinutes * WORDS_PER_MINUTE;
  const perArticleWords = Math.max(90, Math.floor((targetWords * 0.85) / sourceCount));
  const quotesPerArticle = Math.min(4, Math.max(1, Math.round(perArticleWords / 110)));
  const quoteLength = perArticleWords > 260 ? "two to four sentences" : "one or two sentences";
  return { targetWords, perArticleWords, quotesPerArticle, quoteLength };
}

function describeSources(sources: ScriptSource[]): string {
  return sources
    .map((s, i) => {
      const meta = [
        s.byline ? `By ${s.byline}` : null,
        s.siteName ? `Published on ${s.siteName}` : null,
      ]
        .filter(Boolean)
        .join(". ");
      return [
        `### Article ${i + 1}: ${s.title}`,
        meta || null,
        truncate(s.textContent, MAX_CHARS_PER_ARTICLE),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export async function writeScript(
  sources: ScriptSource[],
  targetMinutes: number,
): Promise<GeneratedScript> {
  const { targetWords, perArticleWords, quotesPerArticle, quoteLength } = budget(
    targetMinutes,
    sources.length,
  );
  const articlesBlock = describeSources(sources);

  const instructions = [
    "You write scripts for a short, single narrator podcast that summarizes articles the listener saved.",
    `The script is read aloud at about ${WORDS_PER_MINUTE} words per minute, so a ${targetMinutes} minute episode needs about ${targetWords} words.`,
    `Write at least ${Math.round(targetWords * 0.9)} words. Keep going until you reach that length instead of wrapping up early.`,
    `Give each article about ${perArticleWords} words.`,
    "Structure: a one or two sentence intro that says how many articles are covered, then one segment per article in the order given, then a one sentence sign off.",
    "Each segment starts by naming the article title and its author, or the publication when no author is given, then explains the key points and why they matter.",
    `Quote the source in every segment. Include at least ${quotesPerArticle} direct quote${quotesPerArticle === 1 ? "" : "s"} from each article, each ${quoteLength} long.`,
    "Copy every quote word for word from the article text. Never invent, trim or paraphrase a quote.",
    "Choose quotes that are surprising, opinionated, or memorable. Skip generic scene setting.",
    "Lead into each quote so the listener knows whose words they are, for example: as she puts it, or in his words.",
    "Speak in plain, conversational English. Write only what the narrator says. No headings, no bullet points, no markdown, no stage directions, no music cues.",
    "Do not mention that you are an AI.",
    "Give the episode a title of at most eight words.",
  ].join(" ");

  const response = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions,
    input: articlesBlock,
    text: { format: SCRIPT_FORMAT },
  });

  const draft = parseScriptJson(response.output_text);
  if (!draft.script.trim()) throw new Error("The model returned an empty script.");

  const words = wordCount(draft.script);
  if (words >= targetWords * MIN_FILL_RATIO) return draft;

  // Models routinely undershoot a long target on the first pass, which is what
  // makes an eight minute episode come out at four. Ask once for the rest.
  console.log(`[writeScript] Draft was ${words} words, expanding toward ${targetWords}.`);
  const expanded = await expandScript(draft, articlesBlock, targetWords, quoteLength);
  return wordCount(expanded.script) > words
    ? { title: draft.title || expanded.title, script: expanded.script }
    : draft;
}

async function expandScript(
  draft: GeneratedScript,
  articlesBlock: string,
  targetWords: number,
  quoteLength: string,
): Promise<GeneratedScript> {
  const instructions = [
    "You lengthen an existing podcast script without changing its voice or structure.",
    `The script must reach about ${targetWords} words. It is currently ${wordCount(draft.script)} words, which is too short.`,
    `Add depth to each segment: more of the article's reasoning and examples, and more direct quotes of ${quoteLength} each.`,
    "Copy every quote word for word from the article text. Never invent a quote.",
    "Keep the existing intro, the order of the segments, and the sign off. Do not repeat sentences to pad the length.",
    "Keep the same episode title.",
  ].join(" ");

  const response = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions,
    input: `# Current script\n${draft.script}\n\n# Source articles\n${articlesBlock}`,
    text: { format: SCRIPT_FORMAT },
  });

  const expanded = parseScriptJson(response.output_text);
  return expanded.script.trim() ? expanded : draft;
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
  const words = script.split(/\s+/).filter(Boolean).length;
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

function parseScriptJson(raw: string): GeneratedScript {
  try {
    const obj = JSON.parse(raw) as { title?: unknown; script?: unknown };
    return {
      title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "Your saved articles",
      script: typeof obj.script === "string" ? obj.script.trim() : "",
    };
  } catch {
    // Fall back to treating the whole output as the script.
    return { title: "Your saved articles", script: raw.trim() };
  }
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
