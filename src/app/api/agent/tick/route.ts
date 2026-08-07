import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { runAgentTick } from "@/lib/agents/pipeline";

export async function POST(req: Request) {
  if (req.headers.get("x-agent-secret") !== env.AGENT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { agentId?: string } | undefined;
  if (req.body) {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const result = await runAgentTick(body?.agentId);
  return NextResponse.json(result);
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
