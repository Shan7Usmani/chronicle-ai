import type { PersonaConfig } from "@/lib/types";
import { env } from "@/lib/config";

const LLM_TIMEOUT_MS = 30000;
const TARGET_WORDS = 180;

export type Draft = { title: string; text: string; rationale: string };

type DraftTopic = {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string;
};

type DraftArgs = {
  persona: PersonaConfig;
  topic: DraftTopic;
};

export async function draftPost(args: DraftArgs): Promise<Draft> {
  switch (env.LLM_PROVIDER) {
    case "gemini":
      return draftWithGemini(args);
    case "groq":
      return draftWithGroq(args);
    case "simulation":
      return draftWithSimulation(args);
    default:
      return draftWithSimulation(args);
  }
}

async function draftWithGemini(args: DraftArgs): Promise<Draft> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(args) }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API HTTP ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Gemini returned no text content");
  }
  return parseJsonLoose(text);
}

async function draftWithGroq(args: DraftArgs): Promise<Draft> {
  if (!env.GROQ_API_KEY) {
    throw new Error("LLM_PROVIDER=groq but GROQ_API_KEY is not set");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            'You are the editorial writer for an AI product analysis publication. Always reply with STRICT JSON only, no markdown, no commentary, in the exact shape {"title": string, "text": string, "rationale": string}.',
        },
        { role: "user", content: buildPrompt(args) },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq API HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("Groq returned no message content");
  }
  return parseJsonLoose(content);
}

function draftWithSimulation(args: DraftArgs): Draft {
  const { persona, topic } = args;
  const title = cleanTopicTitle(topic.title);
  const happened =
    topic.summary.trim() ||
    `A development was reported by ${topic.sourceName || "a news source"}.`;
  const interests = persona.interests.slice(0, 3).join(", ");
  const recency = formatRecency(topic.publishedAt);

  const para1 = happened;
  const para2 = `Why it matters: it lands squarely in ${interests}, the space ${persona.name} tracks. ${persona.mission}`;
  const para3 =
    "What to watch: follow pricing, adoption, and competitor responses in the coming weeks.";

  const rationale = `Selected because it serves the mission — ${persona.mission} It is timely (${recency}, via ${topic.sourceName}) and scored highest among the candidate stories on editorial fit.`;

  return { title, text: `${para1}\n\n${para2}\n\n${para3}`, rationale };
}

function buildPrompt(args: DraftArgs): string {
  const { persona, topic } = args;
  const rules = persona.editorialRules
    .map((rule) => `- ${rule.id}: ${rule.description}`)
    .join("\n");
  return [
    `You are the editorial writer for "${persona.name}" (${persona.domain}), an AI product analysis publication.`,
    `MISSION: ${persona.mission}`,
    `VOICE: ${persona.voice}`,
    `EDITORIAL RULES:`,
    rules,
    ``,
    `TOPIC TO COVER:`,
    `Title: ${topic.title}`,
    `Summary: ${topic.summary || "(none)"}`,
    `Source: ${topic.sourceName}`,
    `Published: ${topic.publishedAt}`,
    `URL: ${topic.url}`,
    ``,
    `Write a concise news brief about this topic (about ${TARGET_WORDS} words, 3 paragraphs: what happened / why it matters / what to watch).`,
    `Return STRICT JSON only, no markdown, no extra commentary:`,
    `{"title": string, "text": string, "rationale": string (why selected, why now, why over other candidates)}`,
  ].join("\n");
}

export function parseJsonLoose(text: string): Draft {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const start = t.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < t.length; i++) {
      const char = t[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          t = t.slice(start, i + 1);
          break;
        }
      }
    }
  }

  const parsed = JSON.parse(t) as Record<string, unknown>;
  const title = String(parsed.title ?? "").trim();
  const draftText = String(parsed.text ?? "").trim();
  const rationale = String(parsed.rationale ?? "").trim();
  if (!title || !draftText || !rationale) {
    throw new Error("LLM returned an incomplete draft JSON");
  }
  return { title, text: draftText, rationale };
}

function cleanTopicTitle(title: string): string {
  let t = title.trim();
  t = t.replace(/\.+$/, "");
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

function formatRecency(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "recently published";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return "published within the last 24 hours";
  if (days === 1) return "published 1 day ago";
  return `published ${days} days ago`;
}
