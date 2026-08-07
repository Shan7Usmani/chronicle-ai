import { describe, it, expect } from "vitest";
import { isDuplicate } from "@/lib/agents/memory";
import type { SourceStory } from "@/lib/types";

function story(overrides: Partial<SourceStory>): SourceStory {
  return {
    id: "s1",
    title: "OpenAI releases GPT-6 with agentic coding",
    url: "https://example.com/openai-gpt6",
    source: "hn",
    sourceName: "Hacker News",
    summary: "A summary.",
    publishedAt: new Date().toISOString(),
    tags: ["ai"],
    ...overrides,
  };
}

describe("isDuplicate", () => {
  it("detects exact URL duplicate", () => {
    const seen = new Set(["https://example.com/openai-gpt6"]);
    const result = isDuplicate(story({}), seen);
    expect(result.duplicate).toBe(true);
  });

  it("normalizes URL protocol/www/slash differences", () => {
    const seen = new Set(["example.com/openai-gpt6"]);
    const result = isDuplicate(
      story({ url: "https://www.example.com/openai-gpt6/" }),
      seen,
    );
    expect(result.duplicate).toBe(true);
  });

  it("detects near-identical titles across different URLs", () => {
    const seen = new Set(["openai releases gpt 6 with agentic coding"]);
    const result = isDuplicate(
      story({ url: "https://other.example.com/another", title: "OpenAI Releases GPT-6 With Agentic Coding" }),
      seen,
    );
    expect(result.duplicate).toBe(true);
    expect(result.reason).toContain("Near-identical");
  });

  it("allows genuinely new topics", () => {
    const seen = new Set(["example.com/unrelated"]);
    const result = isDuplicate(story({}), seen);
    expect(result.duplicate).toBe(false);
  });
});
