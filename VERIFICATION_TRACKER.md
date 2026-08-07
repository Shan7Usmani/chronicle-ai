# VERIFICATION_TRACKER.md — Acceptance Matrix & QA Findings

> Live QA tracker. Updated by the QA agent after every audit. Rules live in
> `RULES.md`; this file records *whether* each rule is currently met.

---

## Requirement status

| # | Requirement | Verdict | Evidence / notes |
|---|-------------|---------|------------------|
| E1 | Public repo | ⬜ PENDING | No repo created yet (`git remote -v` empty) |
| E2 | Valid repo URL | ⬜ PENDING | |
| E3 | Working live app | ⬜ PENDING | No deploy yet; UI is stock create-next-app page |
| E4 | PROMPTS.md in repo | ✅ CREATED | `PROMPTS.md` present; build-agent prompts still to be appended |
| E5 | Registered team | ⬜ (user) | |
| E6 | Pre-deadline | ✅ | 2 days remain |
| A1 | Repo created during hackathon | ✅ | Scaffold committed Aug 7 (`a6e697e`) |
| A2 | First commit = bare scaffold | ✅ | `a6e697e` contains only create-next-app files |
| A3 | Incremental commits | ⚠️ AT RISK | Build agent's whole engine is uncommitted working tree (`src/lib`, `src/app/api`, `supabase/`, `docs/`) — must be committed in meaningful increments, not one blob |
| A4 | PROMPTS.md ↔ features | ⚠️ | Build-agent prompts not yet logged |
| A5 | Complete prompt history | ⚠️ | Same |
| A6 | No secrets committed | ✅ | `.env*` gitignored; no keys in tree (verify at end) |
| F1 | Live topic discovery | ✅ BUILT | `src/lib/sources/index.ts` — HN, Lobsters, Google News, THN; 8s timeouts; graceful per-source failure |
| F2 | Editorial judgment | ✅ BUILT | `scoring.ts` — affinity, credibility, richness, recency, hype penalty; threshold 55; rejections persisted |
| F3 | Consistent persona | ✅ BUILT | `persona.ts` (Chronicle — AI Product Analyst) |
| F4 | Memory / no repetition | ⚠️ BUG | `memory.ts` title-similarity branch is dead code — `getSeenKeys()` only returns URLs, never titles, so `looksLikeTitle()` never matches (see F4-FIX) |
| F5 | Autonomous publishing | ❌ **FAILING** | No trigger publishes posts: `/api/agent/feed` just reads; `/api/agent/tick` requires an external POST with secret. Evaluator only calls feed. **Must fix** (see F5-FIX) |
| F6 | Rationale + sources on every post | ✅ BUILT | Feed maps `rationale` + `sources` |
| C1 | init contract | ✅ | POST → `{agentId}`; validates persona |
| C2 | feed contract (schema/order/ISO/append-only) | ✅ | `listPosts` sorts desc, ISO 8601, append-only table |
| C3 | feed empty-state | ⚠️ | Unknown `agentId` → 404 `{error}`; spec prefers `{posts:[]}` when no posts — decide & document |
| C4 | Autonomous feed self-trigger | ❌ **FAILING** | Covered by F5 |
| Q1 | `tsc --noEmit` | ✅ PASS | clean (2026-08-07) |
| Q2 | `npm run lint` | ⚠️ 0 errors / 2 warnings | `health/route.ts:3` `_req` unused; `schedule.ts:5` `MAX_POSTS` unused |
| Q3 | `npm run build` | ✅ PASS | Next 16.3.0 Turbopack, all 4 routes compiled |
| Q4 | Unit tests on core logic | ⬜ MISSING | No tests, no test script in package.json |
| Q5 | Contract smoke test | ⬜ MISSING | |

---

## Open findings (for the build agent to fix)

### F5-FIX (CRITICAL) — no autonomous trigger
Nothing publishes without an external `POST /api/agent/tick`. The evaluator only
calls `GET /api/agent/feed` after init. **Fix:** on feed GET, run the tick for
that agent — publish *only when a schedule slot is due* (respect `getNextPendingSlot`
timing), then return the (possibly updated) posts. Keep `/api/agent/tick` as a
secondary internal pulse (Vercel cron / manual). Ensure a post appears within
~20 min of init (first slot) so evaluators see autonomous behavior quickly.

### F4-FIX (MEDIUM) — title-dedupe is dead code
`getSeenKeys()` (both memory + Supabase paths) returns only URLs. `isDuplicate()`
never sees title keys, so near-identical topics with different URLs are not caught.
**Fix:** also store/return normalized titles (or the agent's published post titles)
in the seen-keys set.

### F3-FIX (MEDIUM) — topic_id FK mismatch (publishing may fail on Supabase)
`pipeline.ts` passes `story.id` (a sha256 URL hash) as `topicId` into
`insertEvaluation`, but the `topics` table uses `gen_random_uuid()` ids. On
Supabase this is an FK violation → evaluations for that story are skipped silently
(caught + logged) → accepted stories can drop out of the shortlist → possibly zero
posts published. **Fix:** make `insertTopic` return/store the topic row id and pass
that id into `insertEvaluation` (both memory + Supabase paths).

### C3 (LOW) — feed 404 vs empty posts
`GET /api/agent/feed?agentId=<unknown>` returns 404. Spec only shows
`{posts:[]}` when none exist. Recommend returning `{posts:[]}` for unknown
agents too (or keep 404 but document the decision in README).

### F5 timing (MEDIUM) — slots vs tick coupling
A single tick currently publishes up to `MAX_POSTS_PER_TICK` winners regardless of
whether slots are due, and marks the next pending slots as published. With the F5
fix, publishing must be gated by the due slot so the 48h spread holds.

### AGENT_SECRET default (LOW)
`.env.example` and `config.ts` default `AGENT_SECRET=chronicle-dev-secret`.
Fine for dev; must be overridden in the deployed environment.

---

## Environment / hygiene notes

- `dev.log`, `dev.err` (running dev-server logs) → add to `.gitignore`.
- `package-lock.json` is untracked; should be committed for reproducible deploys.
- `docs/CONTRACTS.md` exists (build agent) — review for alignment with `RULES.md`.
