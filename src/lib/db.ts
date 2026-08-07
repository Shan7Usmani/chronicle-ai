import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  PersonaConfig,
  AgentRecord,
  Post,
  RejectedTopic,
  AgentStatus,
  SourceStory,
  SourceKind,
  PublishSlot,
} from "@/lib/types";
import { env } from "@/lib/config";
import { buildSchedule } from "@/lib/schedule";
import { normalizeTitle, normalizeUrl } from "@/lib/agents/memory";

type AgentRow = {
  id: string;
  persona: PersonaConfig;
  created_at: string;
  schedule: PublishSlot[];
  last_run_at: string | null;
  next_run_at: string | null;
  total_runs: number;
};

type TopicRow = {
  id: string;
  agent_id: string;
  title: string;
  url: string;
  source: SourceKind;
  source_name: string;
};

type EvalRow = {
  id: string;
  agent_id: string;
  topic_id: string | null;
  title: string;
  url: string;
  score: number;
  accepted: boolean;
  reasons: string[];
  selected_why: string | null;
  selected_why_now: string | null;
  evaluated_at: string;
};

type PostRow = {
  id: string;
  agent_id: string;
  title: string;
  text: string;
  rationale: string;
  sources: string[];
  topic_ids: string[];
  editorial_score: number;
  created_at: string;
};

function rowToAgent(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    persona: row.persona,
    createdAt: row.created_at,
    schedule: Array.isArray(row.schedule) ? row.schedule : [],
    lastRunAt: row.last_run_at ?? null,
    nextRunAt: row.next_run_at ?? null,
    totalRuns: row.total_runs ?? 0,
  };
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    text: row.text,
    rationale: row.rationale,
    sources: Array.isArray(row.sources) ? row.sources : [],
    topicIds: Array.isArray(row.topic_ids) ? row.topic_ids : [],
    createdAt: row.created_at,
    editorialScore: row.editorial_score,
  };
}

function rowToRejected(row: EvalRow, topic?: { source: SourceKind; source_name: string } | null): RejectedTopic {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: topic?.source ?? "custom",
    sourceName: topic?.source_name ?? "Unknown",
    score: row.score,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    rejectedAt: row.evaluated_at,
  };
}

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (client) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured: missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in the environment or rely on the in-memory fallback.",
    );
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function supabaseConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export class MemoryStore {
  private agents = new Map<string, AgentRow>();
  private topics = new Map<string, TopicRow>();
  private evaluations = new Map<string, EvalRow>();
  private posts = new Map<string, PostRow>();

  async ensureAgent(persona: PersonaConfig): Promise<AgentRecord> {
    for (const a of this.agents.values()) {
      if (a.persona.name === persona.name) return rowToAgent(a);
    }
    const id = crypto.randomUUID();
    const row: AgentRow = {
      id,
      persona,
      created_at: new Date().toISOString(),
      schedule: buildSchedule(id),
      last_run_at: null,
      next_run_at: null,
      total_runs: 0,
    };
    this.agents.set(id, row);
    return rowToAgent(row);
  }

  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const row = this.agents.get(agentId);
    return row ? rowToAgent(row) : null;
  }

  async updateAgentRun(
    agentId: string,
    run: { lastRunAt: string; nextRunAt: string | null; totalRuns: number },
  ): Promise<void> {
    const row = this.agents.get(agentId);
    if (!row) throw new Error(`updateAgentRun: agent ${agentId} not found`);
    row.last_run_at = run.lastRunAt;
    row.next_run_at = run.nextRunAt;
    row.total_runs = run.totalRuns;
  }

  async insertTopic(agentId: string, story: SourceStory): Promise<string> {
    for (const t of this.topics.values()) {
      if (t.agent_id === agentId && t.url === story.url) return t.id;
    }
    const id = crypto.randomUUID();
    this.topics.set(id, {
      id,
      agent_id: agentId,
      title: story.title,
      url: story.url,
      source: story.source,
      source_name: story.sourceName,
    });
    return id;
  }

  async insertEvaluation(
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
  ): Promise<void> {
    const id = crypto.randomUUID();
    this.evaluations.set(id, {
      id,
      agent_id: agentId,
      topic_id: e.topicId,
      title: e.title,
      url: e.url,
      score: e.score,
      accepted: e.accepted,
      reasons: e.reasons,
      selected_why: e.selectedWhy,
      selected_why_now: e.selectedWhyNow,
      evaluated_at: e.evaluatedAt,
    });
  }

  async insertPost(agentId: string, post: Post): Promise<void> {
    this.posts.set(post.id, {
      id: post.id,
      agent_id: agentId,
      title: post.title,
      text: post.text,
      rationale: post.rationale,
      sources: post.sources,
      topic_ids: post.topicIds,
      editorial_score: post.editorialScore,
      created_at: post.createdAt,
    });
  }

  async listPosts(agentId: string): Promise<Post[]> {
    return Array.from(this.posts.values())
      .filter((p) => p.agent_id === agentId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(rowToPost);
  }

  async listRejections(agentId: string, limit?: number): Promise<RejectedTopic[]> {
    return Array.from(this.evaluations.values())
      .filter((e) => e.agent_id === agentId && !e.accepted)
      .sort((a, b) => (a.evaluated_at < b.evaluated_at ? 1 : -1))
      .slice(0, limit ?? 50)
      .map((e) => rowToRejected(e, this.topicByUrl(agentId, e.topic_id)));
  }

  private topicByUrl(agentId: string, topicId: string | null) {
    if (!topicId) return null;
    for (const t of this.topics.values()) {
      if (t.agent_id === agentId && t.id === topicId) {
        return { source: t.source, source_name: t.source_name };
      }
    }
    return null;
  }

  async getSeenKeys(agentId: string): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const e of this.evaluations.values()) {
      if (e.agent_id && e.url) {
        keys.add(e.url.trim().toLowerCase());
        keys.add(normalizeUrl(e.url));
      }
    }
    for (const p of this.posts.values()) {
      if (p.agent_id === agentId) {
        for (const s of p.sources ?? []) {
          if (s) {
            keys.add(s.trim().toLowerCase());
            keys.add(normalizeUrl(s));
          }
        }
        if (p.title) keys.add(normalizeTitle(p.title));
      }
    }
    return keys;
  }

  async markSlotPublished(agentId: string, slotAt: string, postId: string): Promise<void> {
    const row = this.agents.get(agentId);
    if (!row) throw new Error(`markSlotPublished: agent ${agentId} not found`);
    row.schedule = (row.schedule ?? []).map((s) =>
      s.at === slotAt ? { ...s, state: "published" as const, postId } : s,
    );
  }

  async getStatus(agentId: string): Promise<AgentStatus | null> {
    const row = this.agents.get(agentId);
    if (!row) return null;
    let publishedCount = 0;
    let rejectedCount = 0;
    for (const p of this.posts.values()) if (p.agent_id === agentId) publishedCount++;
    for (const e of this.evaluations.values()) if (e.agent_id === agentId && !e.accepted) rejectedCount++;
    const memorySize = (await this.getSeenKeys(agentId)).size;
    const rec = rowToAgent(row);
    return {
      agentId: rec.id,
      persona: rec.persona,
      createdAt: rec.createdAt,
      status: "initialized",
      publishedCount,
      rejectedCount,
      memorySize,
      lastRunAt: rec.lastRunAt,
      nextRunAt: rec.nextRunAt,
      totalRuns: rec.totalRuns,
      schedule: rec.schedule,
    };
  }

  async resetAgent(agentId: string): Promise<void> {
    for (const m of [this.posts, this.evaluations, this.topics]) {
      for (const key of Array.from(m.keys())) {
        if ((m.get(key) as { agent_id: string }).agent_id === agentId) m.delete(key);
      }
    }
  }
}

let memoryStore: MemoryStore | null = null;

export function getStore(): MemoryStore {
  if (!memoryStore) memoryStore = new MemoryStore();
  return memoryStore;
}

export async function ensureAgent(persona: PersonaConfig): Promise<AgentRecord> {
  if (!supabaseConfigured()) return getStore().ensureAgent(persona);
  const db = getClient();
  const { data, error } = await db
    .from("agents")
    .select("*")
    .eq("persona->>name", persona.name)
    .maybeSingle();
  if (error) throw new Error(`ensureAgent lookup failed: ${error.message}`);
  if (data) return rowToAgent(data as AgentRow);
  const id = crypto.randomUUID();
  const { data: inserted, error: insertError } = await db
    .from("agents")
    .insert({
      id,
      persona,
      schedule: buildSchedule(id),
      created_at: new Date().toISOString(),
      last_run_at: null,
      next_run_at: null,
      total_runs: 0,
    })
    .select()
    .single();
  if (insertError) throw new Error(`ensureAgent insert failed: ${insertError.message}`);
  return rowToAgent(inserted as AgentRow);
}

export async function getAgent(agentId: string): Promise<AgentRecord | null> {
  if (!supabaseConfigured()) return getStore().getAgent(agentId);
  const db = getClient();
  const { data, error } = await db.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (error) throw new Error(`getAgent failed: ${error.message}`);
  return data ? rowToAgent(data as AgentRow) : null;
}

export async function updateAgentRun(
  agentId: string,
  run: { lastRunAt: string; nextRunAt: string | null; totalRuns: number },
): Promise<void> {
  if (!supabaseConfigured()) return getStore().updateAgentRun(agentId, run);
  const db = getClient();
  const { error } = await db
    .from("agents")
    .update({ last_run_at: run.lastRunAt, next_run_at: run.nextRunAt, total_runs: run.totalRuns })
    .eq("id", agentId);
  if (error) throw new Error(`updateAgentRun failed: ${error.message}`);
}

export async function insertTopic(agentId: string, story: SourceStory): Promise<string> {
  if (!supabaseConfigured()) return getStore().insertTopic(agentId, story);
  const db = getClient();
  const { data, error } = await db
    .from("topics")
    .upsert(
      {
        agent_id: agentId,
        title: story.title,
        url: story.url,
        source: story.source,
        source_name: story.sourceName,
        summary: story.summary,
        tags: story.tags,
        published_at: story.publishedAt || null,
        discovered_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,url" },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`insertTopic failed: ${error.message}`);
  if (!data?.id) throw new Error(`insertTopic failed: no id returned for ${story.url}`);
  return String(data.id);
}

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
): Promise<void> {
  if (!supabaseConfigured()) return getStore().insertEvaluation(agentId, e);
  const db = getClient();
  const { error } = await db.from("evaluations").insert({
    agent_id: agentId,
    topic_id: e.topicId,
    title: e.title,
    url: e.url,
    score: e.score,
    accepted: e.accepted,
    reasons: e.reasons,
    selected_why: e.selectedWhy,
    selected_why_now: e.selectedWhyNow,
    evaluated_at: e.evaluatedAt,
  });
  if (error) throw new Error(`insertEvaluation failed: ${error.message}`);
}

export async function insertPost(agentId: string, post: Post): Promise<void> {
  if (!supabaseConfigured()) return getStore().insertPost(agentId, post);
  const db = getClient();
  const { error } = await db.from("posts").insert({
    id: post.id,
    agent_id: agentId,
    title: post.title,
    text: post.text,
    rationale: post.rationale,
    sources: post.sources,
    topic_ids: post.topicIds,
    editorial_score: post.editorialScore,
    created_at: post.createdAt,
  });
  if (error) throw new Error(`insertPost failed: ${error.message}`);
}

export async function listPosts(agentId: string): Promise<Post[]> {
  if (!supabaseConfigured()) return getStore().listPosts(agentId);
  const db = getClient();
  const { data, error } = await db
    .from("posts")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPosts failed: ${error.message}`);
  return (data ?? []).map((r) => rowToPost(r as PostRow));
}

export async function listRejections(agentId: string, limit?: number): Promise<RejectedTopic[]> {
  if (!supabaseConfigured()) return getStore().listRejections(agentId, limit);
  const db = getClient();
  const { data, error } = await db
    .from("evaluations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("accepted", false)
    .order("evaluated_at", { ascending: false })
    .limit(limit ?? 50);
  if (error) throw new Error(`listRejections failed: ${error.message}`);
  const rows = (data ?? []) as EvalRow[];
  const topicIds = Array.from(new Set(rows.map((r) => r.topic_id).filter((t): t is string => Boolean(t))));
  const topicMap = new Map<string, { source: SourceKind; source_name: string }>();
  if (topicIds.length > 0) {
    const { data: topics, error: topicError } = await db
      .from("topics")
      .select("id, source, source_name")
      .in("id", topicIds);
    if (topicError) throw new Error(`listRejections topic lookup failed: ${topicError.message}`);
    for (const t of topics ?? []) {
      topicMap.set(t.id, { source: t.source as SourceKind, source_name: t.source_name });
    }
  }
  return rows.map((r) => rowToRejected(r, topicMap.get(r.topic_id ?? "") ?? null));
}

export async function getSeenKeys(agentId: string): Promise<Set<string>> {
  if (!supabaseConfigured()) return getStore().getSeenKeys(agentId);
  const db = getClient();
  const keys = new Set<string>();
  const { data: evals, error: evalError } = await db
    .from("evaluations")
    .select("url")
    .eq("agent_id", agentId);
  if (evalError) throw new Error(`getSeenKeys evaluations failed: ${evalError.message}`);
  for (const r of evals ?? []) {
    if (r.url) {
      const u = String(r.url).trim().toLowerCase();
      keys.add(u);
      keys.add(normalizeUrl(u));
    }
  }
  const { data: posts, error: postError } = await db
    .from("posts")
    .select("sources, title")
    .eq("agent_id", agentId);
  if (postError) throw new Error(`getSeenKeys posts failed: ${postError.message}`);
  for (const r of posts ?? []) {
    for (const s of (r.sources ?? []) as string[]) {
      if (s) {
        const u = s.trim().toLowerCase();
        keys.add(u);
        keys.add(normalizeUrl(u));
      }
    }
    if (r.title) keys.add(normalizeTitle(String(r.title)));
  }
  return keys;
}

export async function markSlotPublished(agentId: string, slotAt: string, postId: string): Promise<void> {
  if (!supabaseConfigured()) return getStore().markSlotPublished(agentId, slotAt, postId);
  const db = getClient();
  const { data, error } = await db.from("agents").select("schedule").eq("id", agentId).maybeSingle();
  if (error) throw new Error(`markSlotPublished lookup failed: ${error.message}`);
  if (!data) throw new Error(`markSlotPublished: agent ${agentId} not found`);
  const schedule: PublishSlot[] = (data.schedule ?? []).map((s: PublishSlot) =>
    s.at === slotAt ? { ...s, state: "published" as const, postId } : s,
  );
  const { error: updateError } = await db.from("agents").update({ schedule }).eq("id", agentId);
  if (updateError) throw new Error(`markSlotPublished update failed: ${updateError.message}`);
}

export async function getStatus(agentId: string): Promise<AgentStatus | null> {
  if (!supabaseConfigured()) return getStore().getStatus(agentId);
  const db = getClient();
  const { data, error } = await db.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (error) throw new Error(`getStatus lookup failed: ${error.message}`);
  if (!data) return null;
  const rec = rowToAgent(data as AgentRow);
  const [postsRes, rejectedRes, seenKeys] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("agent_id", agentId),
    db
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("accepted", false),
    getSeenKeys(agentId),
  ]);
  if (postsRes.error) throw new Error(`getStatus posts count failed: ${postsRes.error.message}`);
  if (rejectedRes.error) throw new Error(`getStatus rejections count failed: ${rejectedRes.error.message}`);
  return {
    agentId: rec.id,
    persona: rec.persona,
    createdAt: rec.createdAt,
    status: "initialized",
    publishedCount: postsRes.count ?? 0,
    rejectedCount: rejectedRes.count ?? 0,
    memorySize: seenKeys.size,
    lastRunAt: rec.lastRunAt,
    nextRunAt: rec.nextRunAt,
    totalRuns: rec.totalRuns,
    schedule: rec.schedule,
  };
}

export async function resetAgent(agentId: string): Promise<void> {
  if (!supabaseConfigured()) return getStore().resetAgent(agentId);
  const db = getClient();
  for (const table of ["posts", "evaluations", "topics"]) {
    const { error } = await db.from(table).delete().eq("agent_id", agentId);
    if (error) throw new Error(`resetAgent ${table} failed: ${error.message}`);
  }
}
