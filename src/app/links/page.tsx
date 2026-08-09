import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Links — Shan Usmani",
  description:
    "GitHub, LinkedIn, and portfolio of Shan Usmani — builder of Chronicle, the autonomous AI editor.",
};

const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/Shan7Usmani",
    handle: "@Shan7Usmani",
    desc: "Open-source work, GSSoC contributions, and side projects.",
    accent: "text-[#00d9ff]",
    hover: "hover:border-[#00d9ff]/40 hover:shadow-[0_0_30px_-8px_rgba(0,217,255,0.4)]",
    icon: "⌥",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/shan-u-6b26b7361/",
    handle: "in/shan-u-6b26b7361",
    desc: "Profile, experience, and the open-source journey.",
    accent: "text-[#00ff7a]",
    hover: "hover:border-[#00ff7a]/40 hover:shadow-[0_0_30px_-8px_rgba(0,255,122,0.4)]",
    icon: "in",
  },
  {
    label: "Portfolio",
    href: "https://portfolio-one-gamma-59.vercel.app",
    handle: "portfolio-one-gamma-59.vercel.app",
    desc: "TerminaAI — projects, skills, and what I build.",
    accent: "text-[#ffb02e]",
    hover: "hover:border-[#ffb02e]/40 hover:shadow-[0_0_30px_-8px_rgba(255,176,46,0.4)]",
    icon: "⌂",
  },
];

export default function LinksPage() {
  return (
    <main className="flex-1">
      <section className="hero-grid relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-6 pt-16 pb-14 sm:pt-24 text-center">
          <p className="text-xs uppercase tracking-[0.35em] muted mb-5 animate-fade-up">
            Chronicle &middot; made by
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none animate-fade-up">
            <span className="title-glow">SHAN USMANI</span>
          </h1>
          <p className="mt-4 text-xs sm:text-sm font-mono muted animate-fade-up">
            builder · open-source contributor · AI product analyst
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-16 -mt-2">
        <div className="space-y-4 stagger">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              className={`glass glass-hover rounded-2xl p-5 sm:p-6 flex items-center gap-4 group ${l.hover}`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-mono text-lg ${l.accent}`}
              >
                {l.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold flex items-center gap-2">
                  {l.label}
                  <span className={`text-xs font-mono ${l.accent}`}>{l.handle}</span>
                </span>
                <span className="block text-xs muted mt-0.5 truncate">{l.desc}</span>
              </span>
              <span className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-[#e6edf3]">
                →
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-xs font-mono text-[#8b98a5] hover:text-[#00d9ff] transition-colors"
          >
            ← back to Chronicle
          </Link>
        </div>
      </section>
    </main>
  );
}
