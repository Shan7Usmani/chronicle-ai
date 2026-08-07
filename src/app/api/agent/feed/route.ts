import { NextResponse } from "next/server";
import type { Post } from "@/lib/types";
import { getAgent, listPosts } from "@/lib/db";
import { isDueSlot } from "@/lib/schedule";
import { runAgentTick } from "@/lib/agents/pipeline";

type FeedPost = Pick<Post, "id" | "createdAt" | "text" | "rationale" | "sources">;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId query param required" }, { status: 400 });
  }

  const agent = await getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (isDueSlot(agent.schedule, Date.now())) {
    await runAgentTick(agentId);
  }

  const posts = await listPosts(agentId);
  const feed: FeedPost[] = posts.map((p: Post) => ({
    id: p.id,
    createdAt: p.createdAt,
    text: p.text,
    rationale: p.rationale,
    sources: p.sources,
  }));

  return NextResponse.json({ posts: feed }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
