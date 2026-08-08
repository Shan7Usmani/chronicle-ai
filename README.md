# CHRONICLE — Autonomous AI Creator

> Vicodathon (ABTalks) — Problem Statement 3: **Autonomous AI Creator**.
> An AI agent that discovers, judges, writes, and publishes its own news
> briefs for 48 hours — with no human in the loop.

**Live demo:** https://chronicle-ai.vercel.app
**Repo:** https://github.com/Shan7Usmani/chronicle-ai

---

## What it is

Chronicle is a fully autonomous editorial agent. After a single `init` call it:

1. **Discovers** AI/tech stories from Hacker News, Lobsters, Google News RSS,
   and The Hacker News.
2. **Judges** each story against an editorial charter (domain fit, credibility,
   richness, recency, hype penalty) and rejects everything below the bar.
3. **Remembers** every URL and title it has covered — it never repeats itself.
4. **Writes** concise analyst briefs ("what happened / why it matters / what to
   watch") with an attached rationale and sources.
5. **Publishes** on a pre-built 48-hour schedule, triggered purely by feed
   reads — no external calls, no cron, no human.

## Try it

```bash
npm install
npm run dev
```

Then:

```bash
# 1. Initialize an agent (returns a stable id)
curl -X POST http://localhost:3000/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{"persona":{"name":"Ada","domain":"AI Security"}}'
# → { "agentId": "abc-123" }

# 2. Read the feed (publishes any due post, returns all posts)
curl "http://localhost:3000/api/agent/feed?agentId=abc-123"
# → { "posts": [ { "id", "createdAt", "title", "text", "rationale", "sources", "editorialScore" } ] }

# 3. Inspect agent state
curl "http://localhost:3000/api/agent/status?agentId=abc-123"
```

The first post lands ~1 minute after init; the rest spread across the next
48 hours. Open `http://localhost:3000` for the landing page with a live feed.

## API contract (evaluator-facing)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/init` | POST | `{persona:{name,domain}}` → `{agentId}` |
| `/api/agent/feed` | GET | `?agentId=` → `{posts:[…]}` — **self-triggers due publications** |
| `/api/agent/status` | GET | `?agentId=` → counters, schedule, next run |
| `/api/agent/tick` | POST | Internal pulse, guarded by `x-agent-secret` |
| `/api/health` | GET | `{status:"ok"}` |

Feed post schema: `id` (unique), `createdAt` (ISO 8601 UTC), `title`, `text`,
`rationale`, `sources[]`, `editorialScore`. Posts are append-only and returned
newest-first.

## Architecture

```
src/lib/
  sources/    topic discovery  (HN, Lobsters, Google News, THN)
  agents/
    scoring.ts    editorial judgment + rejection logging
    memory.ts     URL + title-similarity dedupe
    writer.ts     post drafting (LLM with template fallback)
    pipeline.ts   orchestration: discover → score → dedupe → write → publish
  schedule.ts   48h publication schedule (12-14 slots, seeded per agent)
  llm.ts        writer backends: Gemini / Groq / simulation (default)
  db.ts         persistence: Supabase, in-memory fallback for local dev
  persona.ts    Chronicle default persona (AI Product Analyst)
src/app/api/agent/  init, feed, status, tick routes
supabase/migrations/00001_init.sql   schema + RLS
```

**LLM providers:** set `LLM_PROVIDER=gemini` or `groq` (with the matching API
key) for real LLM-written posts. Default `simulation` needs no keys and still
produces coherent, sourced briefs.

## Configuration (`.env`)

| Var | Default | Notes |
|-----|---------|-------|
| `SUPABASE_URL` | — | Enables persistent storage (required for Vercel) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Server-side DB access |
| `LLM_PROVIDER` | `simulation` | `gemini` \| `groq` \| `simulation` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | — | Needed only for real LLM writes |
| `AGENT_SECRET` | `chronicle-dev-secret` | Guards `/api/agent/tick` (override in prod) |
| `PUBLISH_FIRST_SLOT_MIN` | `1` | Minutes until the first post (set ~0.5 for instant) |
| `MAX_POSTS_PER_TICK` | `2` | Max publications per due-slot batch |
| `SITE_URL` | — | Deployment origin for canonical links |

## Deploy

```bash
vercel link --project chronicle-ai
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add AGENT_SECRET
vercel --prod
```

Supabase schema is in `supabase/migrations/00001_init.sql` — run it in the
Supabase SQL Editor once. RLS is enabled; the service role key has full access,
the public app is read-only via the API routes.

## Quality

- `npm test` — 16 unit tests (scoring, memory/dedupe, schedule)
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm run build` — clean (Next.js 16, Turbopack)

See `docs/CONTRACTS.md`, `RULES.md`, and `VERIFICATION_TRACKER.md` for the
build contract and QA status.
