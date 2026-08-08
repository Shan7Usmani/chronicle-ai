# Shared Contracts — Chronicle AI

Single source of truth for interfaces. All agents code against these signatures. Do not rename or re-export; import exactly as specified.

## Import alias
`@/*` → `src/*`. Always import from the modules below.

## Types (already written)
`src/lib/types.ts` — read it. It exports:
`PersonaConfig`, `SourceStory`, `EditorialDecision`, `RejectedTopic`, `Post`, `PublishSlot`, `AgentRecord`, `TickResult`, `AgentStatus`, `SourceKind`, `EditorialRule`.

`src/lib/persona.ts` — exports `DEFAULT_PERSONA: PersonaConfig`.
`src/lib/config.ts` — exports `env` (validated env object) and `isLlmConfigured()`.
`src/lib/schedule.ts` — exports `buildSchedule(agentId, fromMs?)`, `getNextPendingSlot(schedule, nowMs)`, `isDueSlot(schedule, nowMs)`.

## DB layer — src/lib/db.ts (written by DB agent)
```ts
import type { PersonaConfig, AgentRecord, Post, RejectedTopic, AgentStatus, SourceStory } from "@/lib/types";

export function getClient(): import("@supabase/supabase-js").SupabaseClient;

export async function ensureAgent(persona: PersonaConfig): Promise<AgentRecord>;
// Idempotent: if an agent with the same persona.name exists, return it (same id). Else create, seed schedule via buildSchedule(id).

export async function getAgent(agentId: string): Promise<AgentRecord | null>;

export async function updateAgentRun(
  agentId: string,
  run: { lastRunAt: string; nextRunAt: string | null; totalRuns: number },
): Promise<void>;

export async function insertTopic(agentId: string, story: SourceStory): Promise<void>;
// Idempotent on (agent_id, url). Story.id is NOT the DB key.

export async function insertEvaluation(
  agentId: string,
  e: {
    topicId: string | null;
    title: string;
    url: string;
    score: number;
    accepted: boolean;
    reasons: string[];
    selectedWhy: string | null;
    selectedWhyNow: string | null;
    evaluatedAt: string;
  },
): Promise<void>;

export async function insertPost(agentId: string, post: Post): Promise<void>;

export async function listPosts(agentId: string): Promise<Post[]>;
// Newest first.

export async function listRejections(agentId: string, limit?: number): Promise<RejectedTopic[]>;
// Newest first.

export async function getSeenKeys(agentId: string): Promise<Set<string>>;
// Union of: all evaluation urls + all post source urls. Lowercased, trimmed.

export async function markSlotPublished(agentId: string, slotAt: string, postId: string): Promise<void>;
// Flip the matching schedule slot (by `at` ISO string) to published + set postId.

export async function getStatus(agentId: string): Promise<AgentStatus | null>;

export async function resetAgent(agentId: string): Promise<void>;
// Delete posts, evaluations, topics for the agent; keep agent row + schedule.
```

## Sources layer — src/lib/sources/index.ts (written by Sources agent)
```ts
import type { SourceStory } from "@/lib/types";

export async function discoverStories(opts?: {
  limitPerSource?: number; // default 15
  maxTotal?: number;      // default 40
}): Promise<SourceStory[]>;
// Aggregates all sources, dedupes by normalized URL (prefer highest points/oldest source), newest first.
// A failing source must be skipped silently (try/catch), never throw the whole call.
// Every story gets: id (stable hash of url), source, sourceName, tags, publishedAt ISO.
```

Sources to implement (server-side only, plain `fetch`, no SDKs):
1. `hn` — Hacker News Algolia: `https://hn.algolia.com/api/v1/search?query=AI&tags=story&hitsPerPage=20` (plus a second query `query=AI+OR+LLM+OR+agent`). Points → `points`. Summary = story_text truncated or URL domain.
2. `lobsters` — `https://lobste.rs/newest.json` (or `hottest.json`). Summary = description or empty.
3. `google-news` — RSS: `https://news.google.com/rss/search?q=AI+OR+LLM+OR+agent+OR+OpenAI&hl=en-US&gl=US&ceid=US:en`. Parse RSS XML with `rss-parser` (already installed). Source name = feed source, summary = item `contentSnippet`.
4. `thn` — The Hacker News: `https://feeds.feedburner.com/TheHackersNews`. `rss-parser`. Tags should include `security` if title/summary mentions vuln/breach/CVE/attack.

Tags: derive 3-6 lowercase tags from title + summary by matching the persona interests vocabulary (model releases, benchmarks, security, vector db, RAG, agents, open-source, etc.) — hardcoded keyword map is fine.

## LLM layer — src/lib/llm.ts (written by Sources agent)
```ts
export type Draft = { title: string; text: string; rationale: string };

export async function draftPost(args: {
  persona: PersonaConfig;
  topic: { title: string; summary: string; url: string; sourceName: string; publishedAt: string };
}): Promise<Draft>;
```
Dispatch on `env.LLM_PROVIDER`:
- `gemini` → POST to `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, body `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } }`. Ask the model to return STRICT JSON `{"title":..., "text":..., "rationale":...}`. Parse defensively (extract first {...} if needed). If anything fails → throw (caller decides fallback).
- `groq` → POST `https://api.groq.com/openai/v1/chat/completions`, Authorization Bearer, model env.GROQ_MODEL, `response_format: { type: "json_object" }`.
- `simulation` → template writer (no network): title = cleaned original title; text = 3-paragraph template grounded in the summary (what happened / why it matters / what to watch); rationale = persona mission + why relevant now + source. Never throws.

Include the persona mission/voice/rules in every prompt. Keep output ~180 words. `rationale` must explain: why the topic was selected, why it is relevant now, why it was chosen over other candidates.

## Pipeline layer — src/lib/agents/ (written by Pipeline agent)
`src/lib/agents/scoring.ts`:
```ts
import type { SourceStory, PersonaConfig, EditorialDecision } from "@/lib/types";
export function scoreTopic(story: SourceStory, persona: PersonaConfig): EditorialDecision;
// PURE, deterministic, no network. Uses: keyword affinity vs persona.interests + story.tags, source credibility map
// (hn 0.8, lobsters 0.9, google-news 0.7, thn 0.85), summary richness, recency (penalize >5 days), clickbait/rumor keywords.
// Threshold: accepted = score >= 55. reasons: 1-3 human-readable strings like
// "Off-domain: no overlap with AI product analysis interests", "Too stale (4 days old)", "Thin source material", "Hype/clickbait wording".
```

`src/lib/agents/memory.ts`:
```ts
export function isDuplicate(story: SourceStory, seenKeys: Set<string>): { duplicate: boolean; reason: string | null };
// duplicate if story.url (normalized) in seenKeys, OR token-overlap of normalized title > 0.7 against any seen title prefix.
```

`src/lib/agents/writer.ts`:
```ts
import { draftPost } from "@/lib/llm";
export async function writePost(args: {
  persona: PersonaConfig;
  topic: SourceStory;
  editorial: EditorialDecision;
}): Promise<Post>;
// Builds Post: id = `p${Date.now()}`... actually id = `p-${crypto.randomUUID().slice(0,8)}`,
// title/text/rationale from draftPost, sources = [story.url], topicIds = [story.id],
// editorialScore = editorial.score, createdAt ISO. If draftPost throws (LLM down),
// falls back to a local template post (never throws).
```

`src/lib/agents/pipeline.ts`:
```ts
import type { TickResult } from "@/lib/types";
export async function runAgentTick(agentId?: string): Promise<TickResult>;
// If agentId omitted, use the most recently created agent (getClient().from("agents").select(...).order("created_at", descending).limit(1)).
// Steps: load agent → if none, create DEFAULT_PERSONA agent → discoverStories → for each story:
//   insertTopic, scoreTopic; if rejected → insertEvaluation(accepted=false)+collect as rejection;
//   if accepted → isDuplicate(seenKeys) → if dup → insertEvaluation(rejected, reason "Already covered") + skip;
//   else insertEvaluation(accepted=true, selectedWhy/selectedWhyNow) and add to shortlist.
// Pick top `env.MAX_POSTS_PER_TICK` accepted by score → writePost each → insertPost → markSlotPublished(next due slot, postId).
// If no due slot and it's before window end, pick the earliest pending slot.
// updateAgentRun: lastRunAt=now, nextRunAt=next pending slot `at`, totalRuns+1.
// Always update agent run state (finally). Never throw.
```

## API layer — src/app/api/agent/... (written by API agent)
`POST /api/agent/init`:
- Body (optional): `{ persona?: { name?: string; domain?: string } }`.
- Validate: name 1-30 chars, domain 1-60 chars. Invalid → 400 `{ error: "..." }`.
- If body persona provided, merge over DEFAULT_PERSONA (override name+domain only, keep mission/interests/rules/voice).
- Call `ensureAgent(persona)`. Always returns `{ agentId }` (idempotent). Status 200.
- Do NOT run any generation here (10s function cap). Fast, DB-only.

`GET /api/agent/feed?agentId=<id>`:
- `agentId` optional. If omitted → resolves to the **primary agent** (most recently created), so the public landing feed always shows the active creator.
- Unknown agent → `{ posts: [] }`.
- Returns `{ agentId, posts: Post[] }` with ONLY the fields the brief requires on each post: `{ id, createdAt, text, rationale, sources }` (order the full Post to that subset). Newest first. Empty → `{ posts: [] }`.
- Headers: `Access-Control-Allow-Origin: *`, `Cache-Control: no-store`.
- If the agent's next schedule slot is due, the GET self-triggers one publish cycle (F5) before reading posts.
- Storage read only.

`POST /api/agent/tick`:
- Guard: header `x-agent-secret` === `env.AGENT_SECRET` else 401 `{ error: "Unauthorized" }`.
- Body optional `{ agentId?: string }`.
- Calls `runAgentTick(agentId)`, returns 200 TickResult.
- `export const maxDuration = 60;`

`GET /api/agent/status?agentId=<id>`:
- `agentId` optional. If omitted → resolves to the **primary agent** (most recently created).
- Returns `{ status: AgentStatus, recentPosts: Post[], recentRejections: RejectedTopic[] }`. For dashboard.
- CORS `*`. No LLM.

`GET /api/health`: `{ ok: true, time: ISO }` — trivial.

## Files you must NOT touch
- `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/persona.ts`, `src/lib/schedule.ts` (already written)
- `package.json`, `next.config.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css` (UI agent owns the pages)
- Do NOT run `npm install`. Do NOT modify existing files unless the contract requires the file (only your own new files).
