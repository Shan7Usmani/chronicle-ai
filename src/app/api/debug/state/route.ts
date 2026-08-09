import { NextResponse } from "next/server";
import { getClient, isSupabaseConfigured } from "@/lib/db";
import type { PublishSlot } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AgentSummary = {
  id: string;
  createdAt: string;
  totalRuns: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  scheduleSlots: number;
  publishedSlots: number;
  pendingSlots: number;
  slots: PublishSlot[];
};

type PostSummary = {
  id: string;
  agentId: string;
  createdAt: string;
  title: string;
  sources: string[];
  editorialScore: number | null;
};

export async function GET() {
  const db = isSupabaseConfigured() ? getClient() : null;

  if (!db) {
    return NextResponse.json({
      supabaseConfigured: false,
      note: "Running in-memory fallback (Supabase env missing)",
      agents: [],
      posts: [],
      counts: {},
    });
  }

  const [agentsRes, postsRes, evalsRes] = await Promise.all([
    db.from("agents").select("id, created_at, total_runs, last_run_at, next_run_at, schedule"),
    db.from("posts").select("id, agent_id, created_at, title, sources, editorial_score"),
    db
      .from("evaluations")
      .select("accepted", { count: "exact", head: false })
      .limit(10000),
  ]);

  if (agentsRes.error) throw new Error(`agents query failed: ${agentsRes.error.message}`);
  if (postsRes.error) throw new Error(`posts query failed: ${postsRes.error.message}`);
  if (evalsRes.error) throw new Error(`evals query failed: ${evalsRes.error.message}`);

  const agents: AgentSummary[] = (agentsRes.data ?? []).map((a) => {
    const schedule = (a.schedule ?? []) as PublishSlot[];
    return {
      id: a.id,
      createdAt: a.created_at,
      totalRuns: a.total_runs,
      lastRunAt: a.last_run_at,
      nextRunAt: a.next_run_at,
      scheduleSlots: schedule.length,
      publishedSlots: schedule.filter((s) => s.state === "published").length,
      pendingSlots: schedule.filter((s) => s.state === "pending").length,
      slots: schedule,
    };
  });

  const posts: PostSummary[] = (postsRes.data ?? []).map((p) => ({
    id: p.id,
    agentId: p.agent_id,
    createdAt: p.created_at,
    title: p.title,
    sources: Array.isArray(p.sources) ? p.sources : [],
    editorialScore: p.editorial_score,
  }));

  const acceptedCount = (evalsRes.data ?? []).filter((e) => e.accepted === true).length;
  const rejectedCount = (evalsRes.data ?? []).filter((e) => e.accepted === false).length;

  return NextResponse.json({
    supabaseConfigured: true,
    agents,
    posts,
    counts: { agents: agents.length, posts: posts.length, accepted: acceptedCount, rejected: rejectedCount },
  });
}
