-- 00001_init.sql — Chronicle AI initial schema
-- Hackathon-friendly: permissive RLS for anon (publishable key), service_role, authenticated.
-- Idempotent: safe to re-run in the SQL editor (uses IF NOT EXISTS / OR REPLACE).

create extension if not exists pgcrypto;

create table if not exists public.agents (
  id text primary key,
  persona jsonb not null,
  created_at timestamptz not null default now(),
  schedule jsonb not null default '[]'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  total_runs int not null default 0
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  title text,
  url text not null,
  source text,
  source_name text,
  summary text,
  tags jsonb,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  unique (agent_id, url)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  title text,
  url text,
  score int,
  accepted boolean,
  reasons jsonb,
  selected_why text,
  selected_why_now text,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id text primary key,
  agent_id text not null references public.agents(id) on delete cascade,
  title text,
  text text,
  rationale text,
  sources jsonb,
  topic_ids jsonb,
  editorial_score int,
  created_at timestamptz not null default now()
);

create index if not exists idx_agents_created_at on public.agents (created_at desc);
create index if not exists idx_posts_agent_created on public.posts (agent_id, created_at desc);
create index if not exists idx_evaluations_agent_evaluated on public.evaluations (agent_id, evaluated_at desc);
create index if not exists idx_topics_agent_url on public.topics (agent_id, url);

alter table public.agents enable row level security;
alter table public.topics enable row level security;
alter table public.evaluations enable row level security;
alter table public.posts enable row level security;

drop policy if exists "agents_all" on public.agents;
create policy "agents_all" on public.agents
  for all to anon, service_role, authenticated
  using (true) with check (true);

drop policy if exists "topics_all" on public.topics;
create policy "topics_all" on public.topics
  for all to anon, service_role, authenticated
  using (true) with check (true);

drop policy if exists "evaluations_all" on public.evaluations;
create policy "evaluations_all" on public.evaluations
  for all to anon, service_role, authenticated
  using (true) with check (true);

drop policy if exists "posts_all" on public.posts;
create policy "posts_all" on public.posts
  for all to anon, service_role, authenticated
  using (true) with check (true);
