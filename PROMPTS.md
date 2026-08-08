# PROMPTS.md — AI Usage Log

> This is the official **AI Usage Log** for the Vicodathon (ABTalks) submission,
> Problem Statement 3 — Autonomous AI Creator.
>
> The hackathon requires this log to be complete and honest. It is verified in
> **Stage 1 (Eligibility)** and cross-checked against the implemented features in
> **Stage 2 (Authenticity Review)**: *"The AI Usage Log must reasonably correspond
> to the implemented features"* and *"Prompt history must appear complete"*.
>
> **Rule: log the prompt from every tool you used. Switching tools is normal —
> an incomplete log is what causes problems.**

---

## How to log

- One entry per prompt/instruction given to any AI tool, agent, or chat session
  that produced or changed project content.
- Include: **date/time**, **tool/session**, the **prompt** (verbatim where
  possible, otherwise a faithful summary), and **what it produced** (files,
  commands, commits).
- Append new entries at the end of the relevant section. Never delete old entries.
- If a prompt produced nothing useful or had to be retried, still log it —
  honest retries are normal and expected.
- Commands run in a plain shell (npm, git, robocopy, curl) are **build steps**,
  not AI prompts, but are logged for full transparency where they affected the
  build.

---

## Session Log

### 2026-08-07 — QA / Rules-enforcement agent (opencode, session "Vicodathon")

**Role in this project:** rules enforcement + quality assurance over the build
agent. Created `RULES.md`, `VERIFICATION_TRACKER.md`, and this log; ran QA gates;
recovered a scaffolding collision with the build agent's working tree.

| # | Time (IST) | Tool | Prompt (faithful) | Produced |
|---|-----------|------|-------------------|----------|
| 1 | ~21:30 | user → agent | "Your task is to ensure that rules are followed by the other agent working on the build and that the quality is maintained. (Vicodathon / ABTalks, Problem Statement 3: Autonomous AI Creator.)" | Defined QA role; problem statement analyzed |
| 2 | ~21:30 | agent → user | Plan: enforce hackathon eligibility + authenticity rules, P3 functional spec + API contract; milestone-gated build; acceptance matrix. | Plan accepted |
| 3 | ~21:32 | agent → user | Clarifying questions: build-agent supervision model, tech stack, persistence, persona. | Decisions: Next.js + TypeScript, Supabase persistence, I supervise/audit milestones |
| 4 | ~21:40 | agent → CLI | `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm` (failed: folder name "Vicodathon" violates npm naming) | — |
| 5 | ~21:42 | agent → CLI | `npx create-next-app@latest abtalks-ai-creator ... --use-npm` (scaffold into temp subfolder) | Scaffold created (later removed) |
| 6 | ~21:47 | agent → CLI | `robocopy abtalks-ai-creator . /E /MOVE` — **COLLISION**: build agent was concurrently working in this folder; this moved a duplicate scaffold over its working tree. | Collision discovered during audit |
| 7 | ~21:48–21:55 | agent → CLI | Diagnostics: `git status`, `git log`, `git fsck`, file listings, dep checks in `node_modules`. | Full state assessment; confirmed damage limited to `package.json`/lockfile + stray scaffold folder |
| 8 | ~21:55 | agent → CLI | `Remove-Item abtalks-ai-creator` (delete residue); `git checkout -- package.json` (restore build agent's manifest) | Working tree restored |
| 9 | ~21:55 | agent → CLI | `npm install zod@4.4.3 @supabase/supabase-js@2.112.2 rss-parser@3.13.0` (restore build agent's deps at installed versions) | package.json + package-lock.json restored |
| 10 | ~21:56 | agent → files | Wrote `PROMPTS.md` (this log), `RULES.md`, `VERIFICATION_TRACKER.md`; QA audit of build agent's `src/lib/**`, `src/app/api/**`, `supabase/migrations/00001_init.sql`. | Enforcement + QA artifacts; findings documented |

### 2026-08-09 — QA / Rules-enforcement agent (opencode, session "Vicodathon")

**Role in this project:** rules enforcement + quality assurance over the build
agent; made the app submission-ready (deploy path, spec compliance, gates).

| # | Time (IST) | Tool | Prompt (faithful) | Produced |
|---|-----------|------|-------------------|----------|
| 1 | ~00:30 | user → agent | "shall we continue what we were doing in this folder" | Reviewed git log, RULES.md, PROMPTS.md, VERIFICATION_TRACKER.md; assessed state |
| 2 | ~00:32 | user → agent | "yes make it completely functional so that i can win" | Full QA pass: tsc/lint/build/tests, identified remaining gaps (deploy, C3, prompts log) |
| 3 | ~00:36 | agent → CLI | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | All gates pass except schedule test failed: `BASE_URL` env collision |
| 4 | ~00:37 | agent → CLI | `node -e` env probe, vitest debug test, registry env checks | Root cause: Vite/Vitest injects built-in `BASE_URL="/"` which failed the zod `.url()` schema |
| 5 | ~00:40 | agent → files | Renamed config var `BASE_URL` → `SITE_URL` in `src/lib/config.ts` + `.env.example` | Env collision fixed |
| 6 | ~00:41 | agent → files | `!.env.example` added to `.gitignore` | `.env.example` now committed (was ignored by `.env*`) |
| 7 | ~00:42 | agent → files | Updated `VERIFICATION_TRACKER.md` (F3/F4/F5 fixed; E1/E2 verified; gates green) | Tracker reflects verified state |
| 8 | ~00:44 | agent → CLI | `git commit -m "qa: track F3/F4/F5 fixed; rename BASE_URL to SITE_URL..." && git push` | Commit `9e57330` pushed |
| 9 | ~00:50 | user → agent | "yes make it completely functional so that i can win" (continue) | Smoke test plan: run dev server, init → feed over time |
| 10 | ~00:52 | agent → CLI | Started `next dev` with `PUBLISH_FIRST_SLOT_MIN=0.5` + `LLM_PROVIDER=simulation` | Local server up |
| 11 | ~00:55 | agent → CLI | `POST /api/agent/init` → saved id; polled `/api/agent/feed` + `/api/agent/status` | Init OK; feed empty until slot due; schedule verified (12 slots / 48h) |
| 12 | ~01:00 | agent → CLI | Waited ~100s, polled feed again | **Auto-published post** with title/text/rationale/sources/editorialScore — F5 confirmed live |
| 13 | ~01:01 | agent → CLI | Re-polled feed + status | Append-only + idempotent (1 post, totalRuns=1) |
| 14 | ~01:03 | agent → files | Feed route: unknown agentId → `{posts:[]}` instead of 404 (spec-safe, C3 decision) | `src/app/api/agent/feed/route.ts` |
| 15 | ~01:04 | agent → files | `PUBLISH_FIRST_SLOT_MIN` default 15 → 1 (first post within ~1-2 min for demo) | `src/lib/config.ts`, `.env.example` |
| 16 | ~01:10 | agent → CLI | `vercel link --project chronicle-ai` | Repo linked to Vercel project + GitHub connection |
| 17 | ~01:12 | agent → files | Rewrote `README.md` (project-specific, quickstart, API contract, architecture, deploy) | README (was stock create-next-app) |
| 18 | ~01:15 | agent → user | Supabase setup instructions (create project, run SQL, get URL + service_role key) | Awaiting credentials from user |

**Prompts still to be logged (required before submission):**
- Every prompt used by the **build agent** (the session that wrote
  `src/lib/**`, `src/app/api/agent/*`, `supabase/migrations/00001_init.sql`,
  `docs/CONTRACTS.md`, `.env.example`).
- Every prompt used in any other AI tool consulted during the build
  (e.g., code-generation chats, debugging assistants, design tools).
- Each prompt logged with: tool, what it produced, and its feature mapping.

---

## Feature → Prompt Mapping (to be completed)

The Stage 2 review cross-checks the log against implemented features. Keep this
table updated so every shipped feature has at least one logged prompt:

| Feature | Files | Prompt entry # |
|---------|-------|----------------|
| API contract: `POST /api/agent/init`, `GET /api/agent/feed` | `src/app/api/agent/init/route.ts`, `feed/route.ts` | *(build agent session — to be logged)* |
| Topic discovery (HN, Lobsters, Google News, THN) | `src/lib/sources/index.ts` | *(to be logged)* |
| Editorial scoring + rejection | `src/lib/agents/scoring.ts` | *(to be logged)* |
| Persona (Chronicle — AI Product Analyst) | `src/lib/persona.ts` | *(to be logged)* |
| Memory / dedupe | `src/lib/agents/memory.ts` | *(to be logged)* |
| Autonomous schedule (48h) | `src/lib/schedule.ts` | *(to be logged)* |
| LLM writing (Gemini/Groq/simulation) | `src/lib/llm.ts`, `src/lib/agents/writer.ts` | *(to be logged)* |
| Persistence (Supabase + in-memory fallback) | `src/lib/db.ts`, `supabase/migrations/00001_init.sql` | *(to be logged)* |
| Env/config validation | `src/lib/config.ts`, `.env.example` | *(to be logged)* |
| Landing page + live feed UI | `src/app/page.tsx`, `src/components/live-feed.tsx` | *(to be logged)* |
| Feed self-trigger (F5 fix) | `src/app/api/agent/feed/route.ts`, `src/lib/agents/pipeline.ts` | #12, #14 |
| Env collision fix (BASE_URL→SITE_URL) | `src/lib/config.ts` | #4, #5 |
