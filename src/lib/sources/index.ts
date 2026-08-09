import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { SourceStory } from "@/lib/types";

const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT_PER_SOURCE = 15;
const DEFAULT_MAX_TOTAL = 40;
const MAX_SUMMARY_LENGTH = 300;
const MAX_TAGS = 6;

const HN_QUERIES = [
  "https://hn.algolia.com/api/v1/search?query=AI&tags=story&hitsPerPage=20",
  "https://hn.algolia.com/api/v1/search?query=LLM%20OR%20agent&tags=story&hitsPerPage=20",
];

const LOBSTERS_URL = "https://lobste.rs/newest.json";
const GOOGLE_NEWS_URL =
  "https://news.google.com/rss/search?q=AI+OR+LLM+OR+agent+OR+OpenAI+OR+Anthropic&hl=en-US&gl=US&ceid=US:en";
const THN_URL = "https://feeds.feedburner.com/TheHackersNews";

const THN_SECURITY_RE =
  /vuln|breach|cve|attack|hack|malware|phishing|ransomware|ai|llm|model/i;

const KEYWORD_TAG_MAP: Record<string, string> = {
  model: "model-releases",
  llm: "llm",
  openai: "openai",
  anthropic: "anthropic",
  benchmark: "benchmarks",
  agent: "agentic-ai",
  rag: "rag",
  vector: "vector-databases",
  security: "ai-security",
  cve: "ai-security",
  "open source": "open-source",
  api: "api",
  infrastructure: "ai-infrastructure",
  gpu: "infrastructure",
  pricing: "pricing",
  privacy: "privacy",
};

const TRACKER_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gclsrc",
  "ref",
  "ref_src",
  "mc_cid",
  "mc_eid",
]);

type AlgoliaHit = {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  points?: number;
  created_at?: string;
};

type LobstersStory = {
  short_id: string;
  title?: string;
  url?: string;
  description?: string;
  created_at?: string;
  tags?: string[];
};

export async function discoverStories(opts?: {
  limitPerSource?: number;
  maxTotal?: number;
}): Promise<SourceStory[]> {
  const limitPerSource = opts?.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE;
  const maxTotal = opts?.maxTotal ?? DEFAULT_MAX_TOTAL;

  const groups = await Promise.all([
    safeFetch(fetchHackerNews(limitPerSource)),
    safeFetch(fetchLobsters(limitPerSource)),
    safeFetch(fetchGoogleNews(limitPerSource)),
    safeFetch(fetchTheHackerNews(limitPerSource)),
  ]);

  const merged: SourceStory[] = [];
  for (const group of groups) merged.push(...group);

  const deduped = dedupeStories(merged);
  deduped.sort((a, b) => dateToMs(b.publishedAt) - dateToMs(a.publishedAt));
  return deduped.slice(0, maxTotal);
}

function titleTokens(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return new Set(normalized.split(/\s+/).filter(Boolean));
}

function titleJaccard(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function dedupeStories(stories: SourceStory[]): SourceStory[] {
  const out: SourceStory[] = [];
  for (const story of stories) {
    const key = normalizeUrl(story.url);
    const existingUrl = out.find((s) => normalizeUrl(s.url) === key);
    if (existingUrl) {
      const existingPoints = existingUrl.points ?? 0;
      const newPoints = story.points ?? 0;
      if (newPoints > existingPoints) {
        out[out.indexOf(existingUrl)] = story;
      }
      continue;
    }
    const existingTitle = out.find(
      (s) => titleJaccard(s.title, story.title) > 0.7,
    );
    if (existingTitle) {
      const existingPoints = existingTitle.points ?? 0;
      const newPoints = story.points ?? 0;
      if (newPoints > existingPoints) {
        out[out.indexOf(existingTitle)] = story;
      }
      continue;
    }
    out.push(story);
  }
  return out;
}

async function safeFetch<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch {
    return [];
  }
}

async function fetchHackerNews(limit: number): Promise<SourceStory[]> {
  const stories: SourceStory[] = [];
  for (const query of HN_QUERIES) {
    let data: { hits?: AlgoliaHit[] };
    try {
      const res = await fetchJson<{ hits?: AlgoliaHit[] }>(query);
      data = res;
    } catch {
      continue;
    }
    for (const hit of data.hits ?? []) {
      const title = cleanTitle(hit.title ?? "");
      if (!title) continue;
      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const publishedAt = toIso(hit.created_at);
      if (!publishedAt) continue;
      const summary = hit.story_text
        ? truncate(stripHtml(hit.story_text), MAX_SUMMARY_LENGTH)
        : `Submitted to Hacker News (${hit.points || 0} points).`;
      stories.push({
        id: stableId(url),
        title,
        url,
        source: "hn",
        sourceName: "Hacker News",
        summary,
        publishedAt,
        tags: deriveTags(`${title} ${summary}`),
        points: hit.points,
      });
    }
  }
  return stories.slice(0, limit);
}

async function fetchLobsters(limit: number): Promise<SourceStory[]> {
  const data = await fetchJson<LobstersStory[]>(LOBSTERS_URL);
  const stories: SourceStory[] = [];
  for (const item of data ?? []) {
    const title = cleanTitle(item.title ?? "");
    if (!title) continue;
    const url = item.url || `https://lobste.rs/s/${item.short_id}`;
    const publishedAt = toIso(item.created_at);
    if (!publishedAt) continue;
    const summary = truncate(stripHtml(item.description ?? ""), MAX_SUMMARY_LENGTH);
    const extraTags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
    stories.push({
      id: stableId(url),
      title,
      url,
      source: "lobsters",
      sourceName: "Lobsters",
      summary,
      publishedAt,
      tags: deriveTags(`${title} ${summary}`, extraTags),
      points: undefined,
    });
  }
  return stories.slice(0, limit);
}

async function fetchGoogleNews(limit: number): Promise<SourceStory[]> {
  const xml = await fetchText(GOOGLE_NEWS_URL);
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  const stories: SourceStory[] = [];
  for (const item of feed.items) {
    const title = cleanTitle(item.title ?? "");
    const url = item.link;
    if (!title || !url) continue;
    const publishedAt = toIso(item.isoDate || item.pubDate);
    if (!publishedAt) continue;
    const titleWithoutSource = title.replace(/^[^:]+:\s*/, "").trim() || title;
    const summary = truncate(
      stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? ""),
      MAX_SUMMARY_LENGTH,
    );
    stories.push({
      id: stableId(url),
      title: titleWithoutSource,
      url,
      source: "google-news",
      sourceName: item.creator || "Google News",
      summary,
      publishedAt,
      tags: deriveTags(`${titleWithoutSource} ${summary}`),
    });
  }
  return stories.slice(0, limit);
}

async function fetchTheHackerNews(limit: number): Promise<SourceStory[]> {
  const xml = await fetchText(THN_URL);
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  const stories: SourceStory[] = [];
  for (const item of feed.items) {
    const title = cleanTitle(item.title ?? "");
    const url = item.link;
    if (!title || !url) continue;
    const publishedAt = toIso(item.isoDate || item.pubDate);
    if (!publishedAt) continue;
    const summary = truncate(
      stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? ""),
      MAX_SUMMARY_LENGTH,
    );
    const haystack = `${title} ${summary}`;
    const extraTags = THN_SECURITY_RE.test(haystack) ? ["security"] : [];
    stories.push({
      id: stableId(url),
      title,
      url,
      source: "thn",
      sourceName: "The Hacker News",
      summary,
      publishedAt,
      tags: deriveTags(haystack, extraTags),
    });
  }
  return stories.slice(0, limit);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": "ChronicleAI/1.0 (AI news discovery agent)",
      Accept: "application/json, application/xml, text/xml, */*",
    },
  });
}

function deriveTags(text: string, extra: string[] = []): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>(["ai", "product"]);
  for (const [keyword, tag] of Object.entries(KEYWORD_TAG_MAP)) {
    if (lower.includes(keyword)) tags.add(tag);
  }
  for (const tag of extra) {
    if (typeof tag === "string" && tag.length > 0) tags.add(tag.toLowerCase());
  }
  if (tags.size < 3) tags.add("ai-news");
  return Array.from(tags).slice(0, MAX_TAGS);
}

function stableId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKER_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function cleanTitle(title: string): string {
  let t = title.trim();
  t = t.replace(/\s*\|\s*Hacker News\s*$/i, "");
  t = t.replace(/\s*[-–—]\s*Hacker News\s*$/i, "");
  t = t.replace(/\s*\(HN\)\s*$/i, "");
  return t.trim();
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function dateToMs(iso: string): number {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}
