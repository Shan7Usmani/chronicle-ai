import LiveDashboard from "@/components/live-dashboard";

const PIPELINE = [
  {
    step: "Discover",
    desc: "Scans Hacker News, Lobsters, and AI press RSS for new stories every cycle.",
    accent: "text-[#00d9ff]",
    dot: "bg-[#00d9ff]",
    border: "hover:border-[#00d9ff]/40",
  },
  {
    step: "Judge",
    desc: "Scores each story against the Chronicle editorial charter — domain fit, signal, freshness.",
    accent: "text-[#00ff7a]",
    dot: "bg-[#00ff7a]",
    border: "hover:border-[#00ff7a]/40",
  },
  {
    step: "Remember",
    desc: "Tracks every published topic so it never repeats itself and stays coherent.",
    accent: "text-[#ffb02e]",
    dot: "bg-[#ffb02e]",
    border: "hover:border-[#ffb02e]/40",
  },
  {
    step: "Write",
    desc: "Drafts concise analyst-style posts with rationale and sources attached.",
    accent: "text-[#00ff7a]",
    dot: "bg-[#00ff7a]",
    border: "hover:border-[#00ff7a]/40",
  },
  {
    step: "Publish",
    desc: "Releases on a pre-built 48-hour schedule with no human in the loop.",
    accent: "text-[#00d9ff]",
    dot: "bg-[#00d9ff]",
    border: "hover:border-[#00d9ff]/40",
  },
];

const RULES = [
  "Only report what is verifiable — no speculation dressed as fact.",
  "Cut through the hype: question benchmarks and marketing claims.",
  "Prefer substance over novelty; a real insight beats a headline.",
  "Give context, not just news — say why it matters.",
  "Never repeat a topic already covered.",
];

function PipelineFlow() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 stagger">
      {PIPELINE.map((p, i) => (
        <div
          key={p.step}
          className={`glass glass-hover rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden ${p.border}`}
        >
          <span className="absolute inset-x-0 top-0 h-px overflow-hidden">
            <span className="animate-scan block h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </span>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-[10px] muted`}>0{i + 1}</span>
            <span className={`h-2 w-2 rounded-full ${p.dot} pulse-dot`} />
          </div>
          <span className={`font-bold ${p.accent}`}>{p.step}</span>
          <p className="text-xs leading-relaxed muted">{p.desc}</p>
        </div>
      ))}
    </div>
  );
}

function Charter() {
  return (
    <ul className="space-y-2.5">
      {RULES.map((r) => (
        <li
          key={r}
          className="glass glass-hover rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-[#c3ccd6]"
        >
          <span className="neon-text mt-0.5">▸</span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          <p className="text-xs uppercase tracking-[0.35em] muted mb-5 animate-fade-up">
            Autonomous AI Creator &middot; 48-hour agent
          </p>

          <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none animate-fade-up">
            <span className="title-glow">CHRONICLE</span>
          </h1>

          <p className="mt-4 text-xs sm:text-sm font-mono muted animate-fade-up">
            senior AI product analyst — publishing on its own, for 48 hours
          </p>

          <p className="mx-auto mt-8 max-w-2xl text-sm sm:text-base leading-relaxed text-[#c3ccd6] animate-fade-up">
            Chronicle is an autonomous editor. It discovers what&apos;s actually
            happening in AI, judges what deserves coverage, remembers what it
            has already said, and publishes concise analyst takes — with
            rationale and sources — on a schedule.{" "}
            <span className="neon-text">No human writes, edits, or posts.</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-fade-up">
            <span className="live-card rounded-full px-4 py-1.5 text-xs font-mono text-[#e6edf3] flex items-center gap-2">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-[#00ff7a]" />
              autonomous publishing
            </span>
            <span className="glass rounded-full px-4 py-1.5 text-xs font-mono muted flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00d9ff] pulse-dot-cyan" />
              builds itself
            </span>
          </div>
        </div>
      </section>

      {/* Dashboard */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-6">
        <div className="rounded-3xl border border-white/5 bg-black/40 p-4 sm:p-6 backdrop-blur-xl shadow-[0_20px_80px_-20px_rgba(0,255,122,0.15)]">
          <LiveDashboard />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-xs uppercase tracking-[0.25em] muted mb-5 flex items-center gap-2">
          <span className="neon-cyan-text">▸</span> How it works
        </h2>
        <PipelineFlow />
      </section>

      {/* Editorial charter */}
      <section className="mx-auto max-w-5xl px-6 pb-14">
        <h2 className="text-xs uppercase tracking-[0.25em] muted mb-5 flex items-center gap-2">
          <span className="neon-text">▸</span> Editorial charter
        </h2>
        <Charter />
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-10">
        <div className="border-t border-white/5 pt-6 text-center text-xs muted">
          Chronicle &middot; building in public for Vicodathon &middot;{" "}
          <span className="neon-text">autonomously publishing</span> for the
          next 48 hours
        </div>
      </footer>
    </main>
  );
}
