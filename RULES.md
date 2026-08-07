# RULES.md — Build Rules Contract

> Single source of truth for how this project must be built, verified, and
> submitted for the **Vicodathon (ABTalks)** hackathon, Problem Statement 3
> (Autonomous AI Creator). The build agent MUST follow these rules. The QA agent
> verifies them at every milestone.
>
> **Deadline:** Sunday, 9 Aug 2026, 8:00 PM IST.
> **Submission:** public repo URL + live demo URL + `PROMPTS.md` (AI usage log).

---

## 1. Eligibility (Stage 1 — automated, fail = no judging)

| # | Rule | Status |
|---|------|--------|
| E1 | Repository must be public and accessible | ⬜ |
| E2 | Repository URL valid (must be created, `gh repo create` with `--public`) | ⬜ |
| E3 | Live demo URL must be functional and return a **working application** (not a README-only page) | ⬜ |
| E4 | AI Usage Log (`PROMPTS.md`) present and accessible in the repo | ⬜ |
| E5 | Submission belongs to a registered team | ⬜ (user) |
| E6 | Submitted before the deadline | ⬜ |

## 2. Authenticity (Stage 2 — automated + manual; violations risk disqualification)

| # | Rule | Status |
|---|------|--------|
| A1 | Repo created **during** the hackathon (kickoff ~Aug 7) — not before | ✅ repo scaffolded Aug 7 |
| A2 | **First commit is a near-empty scaffold** — no imported codebase | ✅ `a6e697e` = bare create-next-app |
| A3 | Commit history shows steady development across the hackathon — **no single giant final commit** | ⬜ build agent must commit incrementally |
| A4 | `PROMPTS.md` reasonably corresponds to implemented features | ⬜ must log build agent's prompts |
| A5 | Prompt history complete and project-specific (not generic) | ⬜ |
| A6 | No secrets committed: `.env*` gitignored; `SUPABASE_SERVICE_ROLE_KEY` never in repo | ⬜ verify at submit |

## 3. Problem Statement 3 — Functional Requirements

| # | Requirement | Status |
|---|-------------|--------|
| F1 | **Topic discovery** — agent discovers AI/tech topics from web/live sources (HN, Lobsters, Google News RSS, The Hacker News) | ✅ built |
| F2 | **Editorial judgment** — rejects topics below the editorial bar (scored, logged) | ✅ built |
| F3 | **Consistent persona** — coherent voice/interests/opinions (Chronicle — AI Product Analyst) | ✅ built |
| F4 | **Memory** — remembers published content, avoids repetition (URL + title-similarity dedupe) | ⚠️ title-dedupe currently dead code (see findings) |
| F5 | **Autonomous publishing over time** — posts appear across ~48h **without any extra calls/prompts** | ⚠️ **NOT met yet**: nothing publishes unless someone POSTs `/api/agent/tick`; feed GET must self-trigger due posts |
| F6 | **Publishing rationale** — every post includes why selected, why relevant now, sources | ✅ built |

## 4. API Contract (must match exactly)

### `POST /api/agent/init`
- Request: `{ "persona": { "name": "Ada", "domain": "AI Security" } }`
- Response: `{ "agentId": "abc-123" }`
- Called exactly once by the evaluator. Return stable id.

### `GET /api/agent/feed?agentId=<id>`
- Response: `{ "posts": [ { "id", "createdAt", "text", "rationale", "sources" } ] }`
- Rules:
  - Reverse chronological (newest first).
  - Unique `id` per post.
  - `createdAt` is ISO 8601 UTC.
  - Previously returned posts remain available (append-only).
  - If no posts exist → `{ "posts": [] }`.
- After init this is the **only** endpoint the evaluator calls → it MUST
  materialize any due posts internally.

## 5. Quality Gates (run by QA at every milestone)

- `npx tsc --noEmit` — no type errors
- `npm run lint` — no lint errors
- `npm run build` — production build succeeds
- Unit tests on core logic (scoring, dedupe, schedule) — must pass
- Contract smoke test: init once → feed polls show posts appearing over time,
  schema/order/ISO compliance

## 6. Live Demo

- Deployed on Vercel (or equivalent always-reachable host).
- Env vars set on the host: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `AGENT_SECRET` (override the dev default), `LLM_PROVIDER` (default `simulation`).
- Landing page renders a working app: initialize an agent + view its live feed.

## 7. Submission Checklist (before Sun Aug 9 ~7:30 PM IST)

- [ ] Repo public: `gh repo view --json isPrivate`
- [ ] `PROMPTS.md` at repo root, all sessions logged, feature-mapped
- [ ] Live URL returns 200 and a working app
- [ ] Feed shows new posts across repeated queries (autonomous)
- [ ] Commit history shows incremental development
- [ ] No secrets in repo (grep for keys)
- [ ] Deadline buffer: freeze features by ~6 PM, submit by ~7:30 PM

## 8. Live Steer Challenge prep (top-6 final)

- Code must be navigable by a stranger in 20 minutes: clear module split,
  README quickstart, no mega-files.
- Repo must build in one command (`npm install && npm run build`).
