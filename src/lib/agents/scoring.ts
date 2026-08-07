import type { SourceStory, PersonaConfig, EditorialDecision, SourceKind } from "@/lib/types";

const SOURCE_CREDIBILITY: Record<SourceKind, number> = {
  hn: 16,
  lobsters: 18,
  "google-news": 13,
  thn: 17,
  custom: 10,
};

const UNKNOWN_CREDIBILITY = 10;

const HYPE_PATTERN =
  /!!|clickbait|shocking|you won't believe|game.chang|revolutioniz|insane|mind.blow/i;

const DOMAIN_WORDS = [
  "ai",
  "llm",
  "gpt",
  "openai",
  "anthropic",
  "claude",
  "gemini",
  "deepseek",
  "llama",
  "mistral",
  "model",
  "models",
  "agent",
  "agents",
  "rag",
  "vector",
  "embedding",
  "embeddings",
  "benchmark",
  "benchmarks",
  "api",
  "gpu",
  "dataset",
  "datasets",
  "inference",
  "neural",
  "ml",
  "chatbot",
  "copilot",
  "token",
  "tokens",
  "sdk",
  "framework",
  "startup",
  "funding",
  "paper",
  "papers",
  "research",
  "training",
  "release",
  "releases",
  "launch",
  "launches",
  "pricing",
];

const DOMAIN_PHRASES = [
  "machine learning",
  "deep learning",
  "neural network",
  "vector database",
  "open source",
  "fine tuning",
  "language model",
  "prompt engineering",
  "agentic ai",
  "generative ai",
  "model release",
  "model benchmark",
];

const AFFINITY_CAP = 50;
const ACCEPT_THRESHOLD = 55;
const MAX_AFFINITY_HITS_CAP = 7;

function summaryRichnessScore(length: number): number {
  if (length >= 250) return 15;
  if (length >= 120) return 10;
  if (length >= 40) return 6;
  return 3;
}

function hoursOld(publishedAt: string, nowMs: number): number {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

function countDomainHits(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of DOMAIN_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) hits += 1;
  }
  for (const phrase of DOMAIN_PHRASES) {
    if (lower.includes(phrase)) hits += 1;
  }
  return hits;
}

export function scoreTopic(story: SourceStory, persona: PersonaConfig): EditorialDecision {
  const nowMs = Date.now();
  const reasons: string[] = [];

  const haystack = `${story.title} ${story.summary}`.toLowerCase();
  const hits = countDomainHits(haystack);
  const affinity = Math.min(AFFINITY_CAP, Math.min(MAX_AFFINITY_HITS_CAP, hits) * 8);

  let score = 0;
  if (affinity === 0) {
    reasons.push(`Off-domain: no overlap with ${persona.domain} interests`);
  }
  score += affinity;

  score += SOURCE_CREDIBILITY[story.source] ?? UNKNOWN_CREDIBILITY;

  const richness = summaryRichnessScore(story.summary.length);
  if (richness <= 6) {
    reasons.push("Thin source material");
  }
  score += richness;

  const ageHours = hoursOld(story.publishedAt, nowMs);
  let recency = 0;
  if (ageHours <= 24) recency = 15;
  else if (ageHours <= 48) recency = 12;
  else if (ageHours <= 96) recency = 8;
  else if (ageHours <= 120) recency = 4;
  else {
    const days = Math.floor(ageHours / 24);
    reasons.push(`Too stale (${days} days old)`);
  }
  score += recency;

  if (HYPE_PATTERN.test(story.title)) {
    score -= 25;
    reasons.push("Hype/clickbait wording");
  }

  const accepted = score >= ACCEPT_THRESHOLD;
  if (!accepted && reasons.length === 0) {
    reasons.push(`Below editorial threshold (score ${score}/100)`);
  }

  return {
    score,
    accepted,
    reasons: reasons.length > 0 ? reasons.slice(0, 3) : ["Meets editorial bar"],
    confidence: Math.min(0.99, Math.max(0, score / 100)),
  };
}
