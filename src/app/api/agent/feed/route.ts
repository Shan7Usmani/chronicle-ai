import { NextResponse } from "next/server";
import type { Post } from "@/lib/types";
import { getAgent, getPrimaryAgent, listPosts } from "@/lib/db";
import { isDueSlot } from "@/lib/schedule";
import { runAgentTick } from "@/lib/agents/pipeline";

type FeedPost = Pick<
  Post,
  "id" | "createdAt" | "text" | "rationale" | "sources" | "title" | "editorialScore"
>;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedAgentId = searchParams.get("agentId");

  const agent = requestedAgentId
    ? await getAgent(requestedAgentId)
    : await getPrimaryAgent();
  const agentId = agent?.id ?? requestedAgentId;

  if (!agentId) {
    return NextResponse.json({ posts: [] }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  }

  if (agent && isDueSlot(agent.schedule, Date.now())) {
    await runAgentTick(agentId);
  }

  const posts = await listPosts(agentId);
  const feed: FeedPost[] = posts.map((p: Post) => ({
    id: p.id,
    createdAt: p.createdAt,
    text: p.text,
    rationale: p.rationale,
    sources: p.sources,
    title: p.title,
    editorialScore: p.editorialScore,
  }));

  return NextResponse.json({ agentId, posts: feed }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
