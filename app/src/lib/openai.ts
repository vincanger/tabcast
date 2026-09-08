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

export async function writeScript(
  sources: ScriptSource[],
  targetMinutes: number,
): Promise<GeneratedScript> {
  const targetWords = targetMinutes * WORDS_PER_MINUTE;
  const perArticleWords = Math.max(60, Math.floor((targetWords * 0.85) / sources.length));

  const articlesBlock = sources
    .map((s, i) => {
      const meta = [s.siteName, s.byline].filter(Boolean).join(", ");
      return [
        `### Article ${i + 1}: ${s.title}`,
        meta ? `Source: ${meta}` : null,
        truncate(s.textContent, MAX_CHARS_PER_ARTICLE),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const instructions = [
    "You write scripts for a short, single narrator podcast that summarizes articles the listener saved.",
    `The whole script must be about ${targetWords} words, which is roughly ${targetMinutes} minutes read aloud.`,
    `Give each article about ${perArticleWords} words.`,
    "Structure: a one or two sentence intro that says how many articles are covered, then one segment per article in the order given, then a one sentence sign off.",
    "Each segment starts by naming the article title and source, then explains the key points and why they matter. Speak in plain, conversational English.",
    "Write only what the narrator says. No headings, no bullet points, no markdown, no stage directions, no music cues.",
    "Do not mention that you are an AI.",
    "Return JSON with two string fields: \"title\", a short episode title of at most eight words, and \"script\", the full narration.",
  ].join(" ");

  const response = await client.responses.create({
    model: env.OPENAI_SCRIPT_MODEL,
    instructions,
    input: articlesBlock,
    text: { format: { type: "json_object" } },
  });

  const parsed = parseScriptJson(response.output_text);
  if (!parsed.script.trim()) throw new Error("The model returned an empty script.");
  return parsed;
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
