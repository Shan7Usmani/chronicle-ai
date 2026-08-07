import { NextResponse } from "next/server";
import { getAgent, getStatus, listPosts, listRejections } from "@/lib/db";

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
