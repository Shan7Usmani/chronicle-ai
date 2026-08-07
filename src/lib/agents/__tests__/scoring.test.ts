import { describe, it, expect } from "vitest";
import { scoreTopic } from "@/lib/agents/scoring";
import { DEFAULT_PERSONA } from "@/lib/persona";
import type { SourceStory } from "@/lib/types";

function story(overrides: Partial<SourceStory>): SourceStory {
  return {
    id: "test",
    title: "OpenAI releases new LLM model with improved API",
    url: "https://example.com/openai-llm",
    source: "hn",
    sourceName: "Hacker News",
    summary:
      "OpenAI announced a new language model today with stronger benchmark results on reasoning and coding tasks. The model is available via API and open weights.",
    publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    tags: ["ai", "model-releases", "openai"],
    points: 120,
    ...overrides,
  };
}

describe("scoreTopic", () => {
  it("accepts a strong on-domain AI story", () => {
    const decision = scoreTopic(story({}), DEFAULT_PERSONA);
    expect(decision.accepted).toBe(true);
    expect(decision.score).toBeGreaterThanOrEqual(55);
    expect(decision.reasons).not.toContain("Off-domain");
  });

  it("rejects an off-domain story", () => {
    const decision = scoreTopic(
      story({
        title: "Growing Up The Hard Way",
        url: "https://example.com/essay",
        summary: "A personal essay about childhood lessons.",
        tags: ["essay"],
      }),
      DEFAULT_PERSONA,
    );
    expect(decision.accepted).toBe(false);
    expect(decision.reasons.some((r) => r.startsWith("Off-domain"))).toBe(true);
  });

  it("penalizes clickbait wording", () => {
    const decision = scoreTopic(
      story({ title: "You won't believe this SHOCKING AI hack!!" }),
      DEFAULT_PERSONA,
    );
    expect(decision.reasons.some((r) => r.includes("Hype/clickbait"))).toBe(true);
  });

  it("penalizes stale stories", () => {
    const decision = scoreTopic(
      story({ publishedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString() }),
      DEFAULT_PERSONA,
    );
    expect(decision.reasons.some((r) => r.startsWith("Too stale"))).toBe(true);
  });

  it("returns a stable 0-100 score", () => {
    const decision = scoreTopic(story({}), DEFAULT_PERSONA);
    expect(decision.score).toBeGreaterThanOrEqual(0);
    expect(decision.score).toBeLessThanOrEqual(100);
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(0.99);
  });
});
