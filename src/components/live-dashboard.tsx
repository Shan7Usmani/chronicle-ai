"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Post = {
  id: string;
  agentId: string;
  title: string;
  text: string;
  rationale: string;
  sources: string[];
  topicIds: string[];
  createdAt: string;
  editorialScore: number;
};

type RejectedTopic = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceName: string;
  score: number;
  reasons: string[];
  rejectedAt: string;
};

type Slot = {
  at: string;
  state: "pending" | "published";
  postId?: string;
};

type AgentStatus = {
  agentId: string;
  createdAt: string;
  publishedCount: number;
  rejectedCount: number;
  memorySize: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  schedule: Slot[];
};

type StatusResponse = {
  status: AgentStatus | null;
  recentRejections: RejectedTopic[];
};

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(iso: string): string {
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  const unit =
    abs < 60 ? "second" : abs < 3600 ? "minute" : abs < 86400 ? "hour" : "day";
  const value = Math.round(
    unit === "second"
      ? diffSec
      : unit === "minute"
        ? diffSec / 60
        : unit === "hour"
          ? diffSec / 3600
          : diffSec / 86400,
  );
  return RELATIVE.format(value, unit as Intl.RelativeTimeFormatUnit);
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* Live-ticking countdown to a target ISO timestamp */
function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!target) return null;
  const ms = Date.parse(target) - now;
  if (ms <= 0) return { done: true as const, text: "now" };

  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { done: false as const, text: `${pad(h)}:${pad(m)}:${pad(sec)}` };
}

/* Animated counter that eases to the latest value */
function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number;
  accent: "green" | "amber" | "cyan" | "plain";
  sub?: string;
}) {
  const animated = useAnimatedNumber(value);
  const color =
    accent === "green"
      ? "neon-text"
      : accent === "amber"
        ? "amber-text"
        : accent === "cyan"
          ? "neon-cyan-text"
          : "text-[#e6edf3]";

  return (
    <div className="glass glass-hover rounded-2xl p-4 sm:p-5 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] muted truncate">
        {label}
      </span>
      <span className={`font-mono text-2xl sm:text-3xl font-bold tabular-nums ${color}`}>
        {animated.toLocaleString()}
      </span>
      {sub && <span className="text-[10px] sm:text-xs muted truncate">{sub}</span>}
    </div>
  );
}

function PostCard({
  post,
  isNew,
  index,
}: {
  post: Post;
  isNew: boolean;
  index: number;
}) {
  return (
    <article
      className={`glass glass-hover rounded-2xl p-5 sm:p-6 space-y-3 animate-rise ${
        isNew ? "!border-[#00ff7a]/50 shadow-[0_0_30px_-6px_rgba(0,255,122,0.35)]" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold leading-snug">
          {isNew && (
            <span className="mr-2 inline-block align-middle rounded-full bg-[#00ff7a]/15 border border-[#00ff7a]/40 px-2 py-0.5 text-[10px] font-mono neon-text">
              NEW
            </span>
          )}
          {post.title}
        </h3>
        <span className="shrink-0 text-[10px] sm:text-xs muted font-mono whitespace-nowrap">
          {timeAgo(post.createdAt)}
        </span>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-[#c3ccd6] whitespace-pre-wrap">
        {post.text}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] sm:text-xs">
        <span className="rounded-full border border-[#00ff7a]/25 bg-[#00ff7a]/5 px-2.5 py-0.5 font-mono neon-text">
          {post.editorialScore.toFixed(1)}
        </span>
        {post.sources.slice(0, 3).map((s) => (
          <a
            key={s}
            href={s}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 muted hover:border-[#00d9ff]/40 hover:text-[#00d9ff] transition-colors"
          >
            {hostname(s)}
          </a>
        ))}
        {post.sources.length > 3 && (
          <span className="muted">+{post.sources.length - 3}</span>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs neon-cyan-text select-none inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
          <span className="inline-block transition-transform group-open:rotate-90">▸</span>
          why publish this
        </summary>
        <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-4">
          <p className="text-xs leading-relaxed text-[#c3ccd6]">{post.rationale}</p>
        </div>
      </details>
    </article>
  );
}

function ScheduleTimeline({ slots, nextRunAt }: { slots: Slot[]; nextRunAt: string | null }) {
  const total = slots.length;
  const published = slots.filter((s) => s.state === "published").length;
  const pct = total === 0 ? 0 : Math.round((published / total) * 100);
  const upcoming = slots.filter((s) => s.state === "pending");

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-[0.25em] muted">Publish schedule</h3>
        <span className="text-xs font-mono">
          <span className="neon-text">{published}</span>
          <span className="muted"> / {total} slots · </span>
          <span className="neon-cyan-text">{pct}%</span>
        </span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="sheen h-full rounded-full bg-gradient-to-r from-[#00ff7a] to-[#00d9ff] transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slots.map((s) => {
          const isNext = s.state === "pending" && s.at === upcoming[0]?.at;
          return (
            <div
              key={s.at}
              title={`${fmtDate(s.at)} — ${s.state}`}
              className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md flex items-center justify-center text-[9px] sm:text-[10px] font-mono transition-all ${
                s.state === "published"
                  ? "bg-[#00ff7a]/20 border border-[#00ff7a]/50 text-[#00ff7a]"
                  : isNext
                    ? "bg-[#00d9ff]/20 border border-[#00d9ff]/60 text-[#00d9ff] pulse-dot-cyan"
                    : "bg-white/5 border border-white/10 text-[#8b98a5]"
              }`}
            >
              {s.state === "published" ? "●" : isNext ? "►" : "·"}
            </div>
          );
        })}
      </div>

      <p className="text-xs muted">
        {nextRunAt ? (
          <>
            next slot{" "}
            <span className="font-mono text-[#e6edf3]">{fmtClock(nextRunAt)}</span> local ·{" "}
            {timeAgo(nextRunAt)}
          </>
        ) : published === total && total > 0 ? (
          <span className="neon-text">all slots published — mission complete</span>
        ) : (
          "schedule pending"
        )}
      </p>
    </div>
  );
}

function RejectionsPanel({ rejections }: { rejections: RejectedTopic[] }) {
  const [open, setOpen] = useState(false);
  if (rejections.length === 0) return null;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] muted">
          <span className="amber-text">▣</span> Editorial rejections
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm amber-text">{rejections.length}</span>
          <span
            className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 px-5 sm:px-6 pb-5">
            {rejections.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs sm:text-sm leading-snug text-[#c3ccd6] hover:text-[#ffb02e] transition-colors line-clamp-2"
                  >
                    {r.title}
                  </a>
                  <span className="shrink-0 font-mono text-xs amber-text">
                    {r.score.toFixed(0)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-[10px] muted font-mono">{r.sourceName}</span>
                  <span className="text-[10px] muted">{timeAgo(r.rejectedAt)}</span>
                </div>
                {r.reasons.length > 0 && (
                  <p className="text-[10px] sm:text-xs text-[#8b98a5] italic line-clamp-2">
                    {r.reasons.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveDashboard() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [rejections, setRejections] = useState<RejectedTopic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "score">("newest");
  const [showAll, setShowAll] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([
      fetch("/api/agent/feed").then((r) => r.json()),
      fetch("/api/agent/status").then((r) => r.json()),
    ])
      .then(([feed, st]) => {
        const statusRes = st as StatusResponse;
        const feedPosts: Post[] = feed.posts ?? [];

        setPosts(feedPosts);
        setAgentId(feed.agentId ?? statusRes.status?.agentId ?? null);
        setStatus(statusRes.status ?? null);
        setRejections(statusRes.recentRejections ?? []);
        setError(null);
        setConnected(true);

        const ids = new Set(feedPosts.map((p) => p.id));
        const fresh = new Set<string>();
        for (const id of ids) {
          if (!prevIds.current.has(id)) fresh.add(id);
        }
        if (fresh.size > 0 && prevIds.current.size > 0) {
          setNewIds(fresh);
          setTimeout(() => setNewIds(new Set()), 6000);
        }
        prevIds.current = ids;
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setConnected(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const countdown = useCountdown(status?.nextRunAt ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts;
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q) ||
          p.sources.some((s) => s.toLowerCase().includes(q)),
      );
    }
    if (sort === "score") {
      list = [...list].sort((a, b) => b.editorialScore - a.editorialScore);
    }
    return list;
  }, [posts, query, sort]);

  const visible = showAll ? filtered : filtered.slice(0, 8);
  const publishedCount = status?.publishedCount ?? posts.length;

  return (
    <div className="space-y-6">
      {/* Live status bar */}
      <div className="live-card rounded-2xl p-5 sm:p-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="pulse-dot inline-flex h-3 w-3 rounded-full bg-[#00ff7a]" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#e6edf3]">
              {connected ? "AGENT LIVE" : "CONNECTING…"}
            </p>
            <p className="text-[10px] sm:text-xs muted font-mono">
              {agentId ? agentId.slice(0, 8) : "agent"}
              {status?.totalRuns ? ` · ${status.totalRuns} runs` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] muted">
            next publish
          </span>
          <span
            className={`font-mono text-xl sm:text-2xl font-bold tabular-nums ${
              countdown?.done ? "neon-text countdown-blink" : "neon-cyan-text"
            }`}
          >
            {countdown ? countdown.text : "—:—:—"}
          </span>
        </div>

        <div className="ml-auto hidden md:block text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] muted">last run</p>
          <p className="font-mono text-xs text-[#c3ccd6]">
            {status?.lastRunAt ? `${timeAgo(status.lastRunAt)} · ${fmtClock(status.lastRunAt)}` : "—"}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 animate-fade-in">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
        <StatCard label="Published" value={publishedCount} accent="green" sub="live posts" />
        <StatCard label="Rejected" value={status?.rejectedCount ?? 0} accent="amber" sub="below the bar" />
        <StatCard label="Runs" value={status?.totalRuns ?? 0} accent="cyan" sub="agent cycles" />
        <StatCard label="Memory" value={status?.memorySize ?? 0} accent="plain" sub="topics remembered" />
      </div>

      {/* Schedule */}
      {status?.schedule && status.schedule.length > 0 && (
        <ScheduleTimeline slots={status.schedule} nextRunAt={status.nextRunAt} />
      )}

      {/* Feed header + controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.25em] muted">Live feed</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search posts…"
              className="glass rounded-full px-4 py-1.5 text-xs text-[#e6edf3] placeholder:text-[#5a6672] outline-none focus:border-[#00d9ff]/50 transition-colors w-full sm:w-56"
            />
            <div className="glass rounded-full p-0.5 flex">
              {(["newest", "score"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={`rounded-full px-3 py-1 text-[11px] font-mono transition-all ${
                    sort === s
                      ? "bg-[#00d9ff]/15 text-[#00d9ff] border border-[#00d9ff]/40"
                      : "text-[#8b98a5] border border-transparent hover:text-[#e6edf3]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {posts.length === 0 && !error && (
          <div className="glass rounded-2xl p-12 text-center animate-fade-in">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-[#00d9ff]/30 border-t-[#00d9ff] spin-slow" />
            <p className="muted text-sm">
              Listening to the AI news cycle. First post lands on schedule.
            </p>
          </div>
        )}

        {posts.length > 0 && filtered.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="muted text-sm">No posts match “{query}”.</p>
          </div>
        )}

        <div className="space-y-4">
          {visible.map((p, i) => (
            <PostCard key={p.id} post={p} isNew={newIds.has(p.id)} index={i} />
          ))}
        </div>

        {filtered.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mx-auto mt-2 rounded-full border border-white/10 bg-white/5 px-6 py-2 text-xs font-mono text-[#c3ccd6] hover:border-[#00ff7a]/40 hover:text-[#00ff7a] transition-all"
          >
            {showAll ? `show fewer` : `show all ${filtered.length} posts ▾`}
          </button>
        )}
      </div>

      {/* Rejections */}
      <RejectionsPanel rejections={rejections} />

      <div className="flex items-center gap-2 justify-center text-[10px] muted font-mono">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#00ff7a] pulse-dot" : "bg-red-400"}`} />
        live — feed refreshes every 15s
      </div>
    </div>
  );
}
