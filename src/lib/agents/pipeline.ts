import type {
  AgentRecord,
  EditorialDecision,
  Post,
  SourceStory,
  TickResult,
} from "@/lib/types";
import {
  ensureAgent,
  getAgent,
  getClient,
  getSeenKeys,
  insertEvaluation,
  insertPost,
  insertTopic,
  markSlotPublished,
  updateAgentRun,
} from "@/lib/db";
import { discoverStories } from "@/lib/sources";
import { scoreTopic } from "@/lib/agents/scoring";
import { isDuplicate } from "@/lib/agents/memory";
import { writePost } from "@/lib/agents/writer";
import { env } from "@/lib/config";
import { DEFAULT_PERSONA } from "@/lib/persona";
import { getNextPendingSlot } from "@/lib/schedule";

const MAX_REJECTION_SAMPLE = 5;

const activeTicks = new Set<string>();

function emptyTickResult(agentId: string, ranAt: string): TickResult {
  return {
    agentId,
    ranAt,
    discovered: 0,
    evaluated: 0,
    rejected: 0,
    published: 0,
    skippedDuplicate: 0,
    publishedPostIds: [],
    rejectionSample: [],
  };
}

function hoursAgo(publishedAt: string, nowMs: number): number {
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 3_600_000));
}

async function resolveLatestAgentId(): Promise<string | null> {
  try {
    const { data } = await getClient()
      .from("agents")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const id = data[0]?.id;
      if (typeof id === "string") return id;
    }
  } catch (err) {
    console.error("[pipeline] failed to resolve latest agent id:", err);
  }
  return null;
}

export async function runAgentTick(agentId?: string): Promise<TickResult> {
  const nowMs = Date.now();
  const ranAt = new Date(nowMs).toISOString();

  let resolvedId = agentId ?? "";
  let agent: AgentRecord | null = null;

  try {
    if (!resolvedId) {
      resolvedId = (await resolveLatestAgentId()) ?? "";
    }
    if (!resolvedId) {
      const created = await ensureAgent(DEFAULT_PERSONA);
      resolvedId = created.id;
    }
    agent = await getAgent(resolvedId);
    if (!agent) {
      const created = await ensureAgent(DEFAULT_PERSONA);
      resolvedId = created.id;
      agent = created;
    }
  } catch (err) {
    console.error("[pipeline] agent resolution failed:", err);
  }

  if (!agent) {
    return emptyTickResult(resolvedId || agentId || "unknown", ranAt);
  }

  if (activeTicks.has(resolvedId)) {
    console.warn(`[pipeline] tick already running for ${resolvedId}, skipping`);
    return emptyTickResult(resolvedId, ranAt);
  }
  activeTicks.add(resolvedId);

  const result = emptyTickResult(resolvedId, ranAt);
  const runCount = agent.totalRuns + 1;
  let schedule = agent.schedule;

  try {
    let discovered: SourceStory[] = [];
    try {
      discovered = await discoverStories({ limitPerSource: 15, maxTotal: 40 });
    } catch (err) {
      console.error("[pipeline] discoverStories failed:", err);
    }
    result.discovered = discovered.length;

    const scored: { story: SourceStory; editorial: EditorialDecision }[] = [];
    for (const story of discovered) {
      try {
        scored.push({ story, editorial: scoreTopic(story, agent.persona) });
      } catch (err) {
        console.error("[pipeline] scoreTopic failed:", err);
      }
    }
    scored.sort((a, b) => {
      if (b.editorial.score !== a.editorial.score) {
        return b.editorial.score - a.editorial.score;
      }
      return (
        new Date(b.story.publishedAt).getTime() - new Date(a.story.publishedAt).getTime()
      );
    });

    let seen: Set<string> = new Set();
    try {
      seen = await getSeenKeys(resolvedId);
    } catch (err) {
      console.error("[pipeline] getSeenKeys failed:", err);
    }

    const shortlist: { story: SourceStory; editorial: EditorialDecision }[] = [];

    for (const { story, editorial } of scored) {
      try {
        const topicId = await insertTopic(resolvedId, story);
        result.evaluated += 1;

        if (!editorial.accepted) {
          await insertEvaluation(resolvedId, {
            topicId,
            title: story.title,
            url: story.url,
            score: editorial.score,
            accepted: false,
            reasons: editorial.reasons,
            selectedWhy: null,
            selectedWhyNow: null,
            evaluatedAt: ranAt,
          });
          if (result.rejectionSample.length < MAX_REJECTION_SAMPLE) {
            result.rejectionSample.push({
              id: topicId,
              title: story.title,
              url: story.url,
              source: story.source,
              sourceName: story.sourceName,
              score: editorial.score,
              reasons: editorial.reasons,
              rejectedAt: ranAt,
            });
          }
          result.rejected += 1;
          continue;
        }

        const dup = isDuplicate(story, seen);
        if (dup.duplicate) {
          await insertEvaluation(resolvedId, {
            topicId,
            title: story.title,
            url: story.url,
            score: editorial.score,
            accepted: false,
            reasons: dup.reason ? [dup.reason] : ["Duplicate"],
            selectedWhy: null,
            selectedWhyNow: null,
            evaluatedAt: ranAt,
          });
          result.skippedDuplicate += 1;
          continue;
        }

        await insertEvaluation(resolvedId, {
          topicId,
          title: story.title,
          url: story.url,
          score: editorial.score,
          accepted: true,
          reasons: editorial.reasons,
          selectedWhy: editorial.reasons.join("; "),
          selectedWhyNow: `Published ${hoursAgo(story.publishedAt, nowMs)}h ago, matches ${agent.persona.name}'s focus on ${agent.persona.domain}.`,
          evaluatedAt: ranAt,
        });
        shortlist.push({ story, editorial });
      } catch (err) {
        console.error("[pipeline] story evaluation failed:", err);
      }
    }

    shortlist.sort((a, b) => b.editorial.score - a.editorial.score);

    const dueSlots = schedule
      .filter((s) => s.state === "pending" && new Date(s.at).getTime() <= nowMs)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const winners = shortlist.slice(0, Math.min(env.MAX_POSTS_PER_TICK, dueSlots.length));

    for (const winner of winners) {
      let post: Post;
      try {
        post = await writePost({
          persona: agent.persona,
          topic: winner.story,
          editorial: winner.editorial,
        });
      } catch (err) {
        console.error("[pipeline] writePost failed:", err);
        continue;
      }
      post.agentId = resolvedId;
      try {
        await insertPost(resolvedId, post);
      } catch (err) {
        console.error("[pipeline] insertPost failed:", err);
        continue;
      }
      result.published += 1;
      result.publishedPostIds.push(post.id);

      const slot = dueSlots.shift();
      if (slot) {
        const slotAt = slot.at;
        schedule = schedule.map((s) =>
          s.at === slotAt ? { ...s, state: "published" as const, postId: post.id } : s,
        );
        try {
          await markSlotPublished(resolvedId, slotAt, post.id);
        } catch (err) {
          console.error("[pipeline] markSlotPublished failed:", err);
        }
      }
    }
  } finally {
    activeTicks.delete(resolvedId);
    try {
      const next = getNextPendingSlot(schedule, nowMs);
      await updateAgentRun(resolvedId, {
        lastRunAt: ranAt,
        nextRunAt: next ? next.at : null,
        totalRuns: runCount,
      });
    } catch (err) {
      console.error("[pipeline] updateAgentRun failed:", err);
    }
  }

  return result;
}
