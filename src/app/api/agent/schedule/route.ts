import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getPrimaryAgent, rebuildSchedule } from "@/lib/db";

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

  try {
    const target = body?.agentId ?? (await getPrimaryAgent())?.id;
    if (!target) return NextResponse.json({ error: "No agent found" }, { status: 404 });
    const schedule = await rebuildSchedule(target);
    return NextResponse.json({ rebuilt: true, agentId: target, count: schedule.length, schedule });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
