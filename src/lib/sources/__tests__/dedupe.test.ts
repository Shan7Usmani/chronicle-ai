import { describe, it, expect } from "vitest";
import { dedupeStories } from "@/lib/sources";
import type { SourceStory } from "@/lib/types";

function story(partial: Partial<SourceStory> & { title: string; url: string }): SourceStory {
  return {
    id: partial.id ?? `id-${partial.url}`,
    title: partial.title,
    url: partial.url,
    source: partial.source ?? "custom",
    sourceName: partial.sourceName ?? "Custom",
    summary: partial.summary ?? "",
    publishedAt: partial.publishedAt ?? "2026-08-09T00:00:00.000Z",
    tags: partial.tags ?? [],
    points: partial.points,
  };
}

describe("dedupeStories", () => {
  it("drops exact duplicate URLs, keeping the higher-points variant", () => {
    const a = story({ title: "OpenAI ships new model", url: "https://example.com/a", points: 5 });
    const b = story({ title: "OpenAI ships new model", url: "https://example.com/a", points: 9 });
    const out = dedupeStories([a, b]);
    expect(out.length).toBe(1);
    expect(out[0].points).toBe(9);
  });

  it("dedupes the same story from different URLs via title similarity", () => {
    const a = story({
      title: "How a small Israeli startup was linked to rogue AI hacks",
      url: "https://news.google.com/rss/articles/AAAA",
    });
    const b = story({
      title: "How a small Israeli startup was linked to rogue AI hacks",
      url: "https://news.google.com/rss/articles/BBBB",
    });
    const out = dedupeStories([a, b]);
    expect(out.length).toBe(1);
  });

  it("keeps genuinely different stories", () => {
    const a = story({ title: "OpenAI releases a new coding model", url: "https://example.com/a" });
    const b = story({ title: "Meta patents a vector database index", url: "https://example.com/b" });
    const out = dedupeStories([a, b]);
    expect(out.length).toBe(2);
  });

  it("handles near-identical titles with small wording differences", () => {
    const a = story({
      title: "Google unveils an agentic coding assistant",
      url: "https://example.com/a",
    });
    const b = story({
      title: "Google unveils agentic coding assistant",
      url: "https://example.com/b",
    });
    const out = dedupeStories([a, b]);
    expect(out.length).toBe(1);
  });

  it("prefers the higher-points entry when title-deduping", () => {
    const a = story({ title: "Anthropic adds web search to Claude", url: "https://example.com/a" });
    const b = story({
      title: "Anthropic adds web search to Claude API",
      url: "https://example.com/b",
      points: 12,
    });
    const out = dedupeStories([a, b]);
    expect(out.length).toBe(1);
    expect(out[0].points).toBe(12);
  });
});
