import { NextResponse } from "next/server";
import { getAgent, getPrimaryAgent, getStatus, listPosts, listRejections } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedAgentId = searchParams.get("agentId");

  const agent = requestedAgentId
    ? await getAgent(requestedAgentId)
    : await getPrimaryAgent();
  const agentId = agent?.id ?? requestedAgentId;

  if (!agentId) {
    return NextResponse.json({ error: "No agent yet" }, { status: 404 });
  }

  const [status, posts, recentRejections] = await Promise.all([
    getStatus(agentId),
    listPosts(agentId),
    listRejections(agentId, 10),
  ]);

  return NextResponse.json(
    {
      status,
      recentPosts: posts.slice(0, 8),
      recentRejections,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
