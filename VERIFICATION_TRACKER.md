# VERIFICATION_TRACKER.md — Acceptance Matrix & QA Findings

> Live QA tracker. Updated by the QA agent after every audit. Rules live in
> `RULES.md`; this file records *whether* each rule is currently met.

---

## Requirement status

| # | Requirement | Verdict | Evidence / notes |
|---|-------------|---------|------------------|
| E1 | Public repo | ✅ | `Shan7Usmani/chronicle-ai` — PUBLIC (`gh repo view`) |
| E2 | Valid repo URL | ✅ | https://github.com/Shan7Usmani/chronicle-ai |
| E3 | Working live app | ✅ | **Deployed** https://chronicle-ai-one.vercel.app — 200, landing + all 4 API routes live (verified 2026-08-09) |
| E4 | PROMPTS.md in repo | ✅ CREATED | `PROMPTS.md` present; build-agent prompts still to be appended |
| E5 | Registered team | ⬜ (user) | |
| E6 | Pre-deadline | ✅ | ~19h remain (deadline Sun Aug 9 20:00 IST) |
| A1 | Repo created during hackathon | ✅ | Scaffold committed Aug 7 (`a6e697e`) |
| A2 | First commit = bare scaffold | ✅ | `a6e697e` contains only create-next-app files |
| A3 | Incremental commits | ✅ | 7 commits, each meaningful: scaffold → core engine → db → tests → QA docs → smoke ignore → UI |
| A4 | PROMPTS.md ↔ features | ⚠️ | Build-agent prompts not yet logged |
| A5 | Complete prompt history | ⚠️ | Same |
| A6 | No secrets committed | ✅ | `.env*` gitignored; no keys in tree (verify at end) |
| F1 | Live topic discovery | ✅ BUILT | `src/lib/sources/index.ts` — HN, Lobsters, Google News, THN; 8s timeouts; graceful per-source failure |
| F2 | Editorial judgment | ✅ BUILT | `scoring.ts` — affinity, credibility, richness, recency, hype penalty; threshold 55; rejections persisted |
| F3 | Consistent persona | ✅ BUILT | `persona.ts` (Chronicle — AI Product Analyst) |
| F4 | Memory / no repetition | ✅ FIXED | `getSeenKeys()` (memory + Supabase) now returns normalized titles of published posts → title-similarity dedupe live (was dead code) |
| F5 | Autonomous publishing | ✅ FIXED | Feed GET self-triggers tick when a schedule slot is due (`feed/route.ts` → `isDueSlot` → `runAgentTick`); first slot ~15 min after init |
| F6 | Rationale + sources on every post | ✅ BUILT | Feed maps `rationale` + `sources` |
| C1 | init contract | ✅ | POST → `{agentId}`; validates persona |
| C2 | feed contract (schema/order/ISO/append-only) | ✅ | `listPosts` sorts desc, ISO 8601, append-only table |
| C3 | feed empty-state | ⚠️ | Unknown `agentId` → 404 `{error}`; spec prefers `{posts:[]}` when no posts — decide & document |
| C4 | Autonomous feed self-trigger | ✅ | Covered by F5 |
| Q1 | `tsc --noEmit` | ✅ PASS | clean (2026-08-09) |
| Q2 | `npm run lint` | ✅ PASS | 0 errors (2026-08-09) |
| Q3 | `npm run build` | ✅ PASS | Next 16.3.0 Turbopack; all 4 API routes + `/` compile |
| Q4 | Unit tests on core logic | ✅ PASS | 16/16 (scoring, memory, schedule) via vitest |
| Q5 | Contract smoke test | ✅ PASS (live) | 2026-08-09 on prod: init → `{agentId}` → post auto-published ~90s later via feed GET → idempotent (append-only, 1 post) → schema/order/ISO verified; tick auth (401/200), unknown agent → `{posts:[]}`, missing agentId → 400 |

---

## Open findings (for the build agent to fix)

### F5-FIX (CRITICAL) — no autonomous trigger
**VERIFIED FIXED 2026-08-09.** `src/app/api/agent/feed/route.ts` now runs
`runAgentTick` when `isDueSlot(agent.schedule, now)` — publish only happens when a
schedule slot is due, then the (possibly updated) posts are returned. First slot
lands ~15 min after init (`PUBLISH_FIRST_SLOT_MIN`, default 15). `/api/agent/tick`
remains as secondary pulse.

### F4-FIX (MEDIUM) — title-dedupe is dead code
**VERIFIED FIXED 2026-08-09.** Both memory + Supabase `getSeenKeys()` now add
`normalizeTitle(post.title)` from published posts, so `isDuplicate()`'s
title-similarity branch is reachable (Jaccard > 0.7).

### F3-FIX (MEDIUM) — topic_id FK mismatch (publishing may fail on Supabase)
**VERIFIED FIXED 2026-08-09.** `insertTopic()` (Supabase) does `upsert(...).select("id")`
and returns the real row id; `insertEvaluation` receives that id. Memory path already
returned a UUID.

### C3 (LOW) — feed 404 vs empty posts
**RESOLVED 2026-08-09.** `GET /api/agent/feed?agentId=<unknown>` now returns
`{posts:[]}` (200) — the feed treats an unknown agent as having no posts yet,
matching the spec's empty-state shape. Live-verified on prod.

### E3 (MEDIUM) — no live deployment
**RESOLVED 2026-08-09.** Deployed to https://chronicle-ai-one.vercel.app with
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (publishable key, anon role) and
`AGENT_SECRET` set. Landing + all 4 API routes live. Auto-deploys from `master`.

### A4/A5 (HIGH) — build-agent prompts not yet logged in PROMPTS.md
The QA session (Aug 7) is logged. Every prompt from the **build agent** session that
wrote `src/lib/**`, `src/app/api/agent/*`, `supabase/migrations/00001_init.sql`,
`docs/CONTRACTS.md`, `.env.example`, the UI (`page.tsx`, `live-feed.tsx`) must be
appended with tool + produced-files + feature mapping. Stage 2 cross-checks this.
**Still TODO — needs the build-agent prompt history.**

### Q5 (HIGH) — contract smoke test not yet run
**DONE 2026-08-09 (live on prod).** init → auto-published first post ~90s later via
feed GET; append-only + idempotent (1 post, totalRuns=1); schema/order/ISO verified;
tick auth 401/200; unknown agent `{posts:[]}`; missing agentId 400. Full details in
Q5 table row.

### AGENT_SECRET default (LOW)
`.env.example` and `config.ts` default `AGENT_SECRET=chronicle-dev-secret`.
Fine for dev; must be overridden in the deployed environment. **DONE — Vercel prod
has a random override (`0AiG4ad1gFTsH6BL8NvKhYoSIPXmx2CV`).**

---

## Environment / hygiene notes

- `dev.log`, `dev.err` → already gitignored (`*.log`, `dev.log`, `dev.err`).
- `package-lock.json` → committed (reproducible deploys). ✅
- `docs/CONTRACTS.md` exists — reviewed for alignment with `RULES.md`; matches
  the implemented API contract.
- `BASE_URL` config var was renamed to `SITE_URL` (2026-08-09) because Vite/Vitest
  injects its own `BASE_URL="/"` which failed the zod URL schema in tests.
