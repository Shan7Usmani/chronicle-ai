"use client";

import { useCallback, useEffect, useState } from "react";

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

type Status = {
  publishedCount: number;
  rejectedCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
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

export default function LiveFeed() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([
      fetch("/api/agent/feed").then((r) => r.json()),
      fetch("/api/agent/status").then((r) => r.json()),
    ])
      .then(([feed, st]) => {
        setPosts(feed.posts ?? []);
        setAgentId(feed.agentId ?? st.status?.agentId ?? null);
        setStatus(st.status ?? null);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00ff7a] pulse-dot" />
          <span className="text-sm text-[#e6edf3] font-medium">
            {status && status.totalRuns > 0 ? "ACTIVE" : "ONLINE"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="muted">published</span>
          <span className="neon-text font-mono text-base">
            {status?.publishedCount ?? 0}
          </span>
          <span className="muted ml-4">rejected</span>
          <span className="amber-text font-mono text-base">
            {status?.rejectedCount ?? 0}
          </span>
          <span className="muted ml-4">runs</span>
          <span className="font-mono text-base">{status?.totalRuns ?? 0}</span>
        </div>
        <div className="ml-auto text-xs muted">
          {status?.nextRunAt ? (
            <span>
              next run{" "}
              <span className="font-mono text-[#e6edf3]">
                {timeAgo(status.nextRunAt)}
              </span>
            </span>
          ) : (
            <span>agent {agentId?.slice(0, 8) ?? "…"}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {posts.length === 0 && !error && (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="muted text-sm">
            Listening to the AI news cycle. First post lands on schedule.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((p) => (
          <article
            key={p.id}
            className="glass rounded-2xl p-6 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold leading-snug">{p.title}</h3>
              <span className="shrink-0 text-xs muted font-mono">
                {timeAgo(p.createdAt)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#c3ccd6] whitespace-pre-wrap">
              {p.text}
            </p>
            <details className="group">
              <summary className="cursor-pointer text-xs neon-cyan-text select-none">
                why publish this
              </summary>
              <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-xs leading-relaxed text-[#c3ccd6]">
                  {p.rationale}
                </p>
                <p className="mt-3 text-xs muted">
                  score{" "}
                  <span className="neon-text font-mono">
                    {p.editorialScore.toFixed(1)}
                  </span>
                </p>
              </div>
            </details>
            {p.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {p.sources.map((s) => (
                  <a
                    key={s}
                    href={s}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs muted hover:border-[#00d9ff]/40 hover:text-[#00d9ff]"
                  >
                    source
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
