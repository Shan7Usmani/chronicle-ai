import type { SourceStory } from "@/lib/types";

export function normalizeUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/\s+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function looksLikeTitle(key: string): boolean {
  return key.includes(" ") && !key.includes("://");
}

export function isDuplicate(
  story: SourceStory,
  seenKeys: Set<string>,
): { duplicate: boolean; reason: string | null } {
  const url = normalizeUrl(story.url);
  const rawUrl = story.url.trim().toLowerCase();
  if ((rawUrl && seenKeys.has(rawUrl)) || (url && seenKeys.has(url))) {
    return { duplicate: true, reason: "Already covered (same source)" };
  }

  const titleTokens = tokenSet(normalizeTitle(story.title));
  for (const key of seenKeys) {
    if (!looksLikeTitle(key)) continue;
    const keyTokens = tokenSet(normalizeTitle(key));
    if (jaccard(titleTokens, keyTokens) > 0.7) {
      return { duplicate: true, reason: "Near-identical topic already covered" };
    }
  }

  return { duplicate: false, reason: null };
}
