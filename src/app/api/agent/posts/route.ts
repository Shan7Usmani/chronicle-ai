import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { getClient, isSupabaseConfigured } from "@/lib/db";
import type { PublishSlot } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  if (req.headers.get("x-agent-secret") !== env.AGENT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing ?id=<postId>" }, { status: 400 });
  }

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase not configured; cannot delete posts in memory mode" },
        { status: 503 },
      );
    }
    const db = getClient();

    const { data: agentRows, error: agentError } = await db.from("agents").select("id, schedule");
    if (agentError) throw new Error(`agent lookup failed: ${agentError.message}`);

    for (const agent of agentRows ?? []) {
      const schedule = (agent.schedule ?? []) as PublishSlot[];
      const referencing = schedule.find((s) => s.postId === id && s.state === "published");
      if (referencing) {
        const updated = schedule.map((s) =>
          s.at === referencing.at ? { ...s, state: "pending" as const, postId: null } : s,
        );
        const { error: updateError } = await db
          .from("agents")
          .update({ schedule: updated })
          .eq("id", agent.id);
        if (updateError) throw new Error(`slot revert failed: ${updateError.message}`);
      }
    }

    const { error } = await db.from("posts").delete().eq("id", id);
    if (error) throw new Error(`delete post failed: ${error.message}`);

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
