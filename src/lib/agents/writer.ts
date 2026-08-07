import type { PersonaConfig, SourceStory, EditorialDecision, Post } from "@/lib/types";
import { draftPost } from "@/lib/llm";

function cleanTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function buildTemplateText(topic: SourceStory, editorial: EditorialDecision): string {
  const sentences = topic.summary
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 0);
  const first = sentences.slice(0, 2).join(" ") || topic.title;
  const reasons = editorial.reasons
    .filter((r) => r !== "Hype/clickbait wording")
    .join("; ");
  const second = reasons
    ? `Why it matters: this development scores ${editorial.score}/100 because ${reasons}.`
    : `Why it matters: this development scores ${editorial.score}/100 on the editorial bar.`;
  const third = `What to watch: follow-ups from ${topic.sourceName}. Original source: ${topic.url}`;
  return [first, second, third].join("\n\n");
}

export async function writePost(args: {
  persona: PersonaConfig;
  topic: SourceStory;
  editorial: EditorialDecision;
}): Promise<Post> {
  const base: Omit<Post, "title" | "text" | "rationale"> = {
    id: `p-${crypto.randomUUID().slice(0, 8)}`,
    agentId: "PENDING",
    sources: [args.topic.url],
    topicIds: [args.topic.id],
    createdAt: new Date().toISOString(),
    editorialScore: args.editorial.score,
  };

  try {
    const draft = await draftPost({
      persona: args.persona,
      topic: {
        title: args.topic.title,
        summary: args.topic.summary,
        url: args.topic.url,
        sourceName: args.topic.sourceName,
        publishedAt: args.topic.publishedAt,
      },
    });
    return {
      ...base,
      title: cleanTitle(draft.title),
      text: draft.text,
      rationale: draft.rationale,
    };
  } catch (err) {
    console.error("[writer] draftPost failed, using template fallback:", err);
    return {
      ...base,
      title: cleanTitle(args.topic.title),
      text: buildTemplateText(args.topic, args.editorial),
      rationale: `Template fallback: LLM unavailable. Selected because ${args.editorial.reasons.join("; ")}`,
    };
  }
}
