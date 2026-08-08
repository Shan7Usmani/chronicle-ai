import { NextResponse } from "next/server";
import type { PersonaConfig } from "@/lib/types";
import { DEFAULT_PERSONA } from "@/lib/persona";
import { ensureAgent } from "@/lib/db";

export async function POST(req: Request) {
  let body: { persona?: { name?: string; domain?: string } } = {};
  if (req.body) {
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const persona = body?.persona ?? {};
  const name = persona.name?.trim();
  const domain = persona.domain?.trim();

  if (
    (name !== undefined && (typeof name !== "string" || name.length < 1 || name.length > 30)) ||
    (domain !== undefined && (typeof domain !== "string" || domain.length < 1 || domain.length > 60))
  ) {
    return NextResponse.json(
      { error: "persona.name (1-30 chars) and persona.domain (1-60 chars) are required" },
      { status: 400 },
    );
  }

  const merged: PersonaConfig = {
    ...DEFAULT_PERSONA,
    ...(name !== undefined ? { name } : {}),
    ...(domain !== undefined ? { domain } : {}),
  };

  const agent = await ensureAgent(merged);
  return NextResponse.json({ agentId: agent.id });
}
