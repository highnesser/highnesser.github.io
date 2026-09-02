"use client";

import { useState } from "react";
import type { DiscoveryReport } from "@/lib/types";

type Mode = "url" | "text";

export default function Home() {
  const [mode, setMode] = useState<Mode>("url");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiscoveryReport | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "url" ? { url: value } : { text: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas bg-radial-glow">
      <Header />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs font-medium text-violet-200">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Pain-validated ICPs, powered by real research
        </span>

        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="text-white">Turn a raw idea into </span>
          <span className="bg-gradient-to-r from-violet-300 to-violet-500 bg-clip-text text-transparent">
            validated ICPs
          </span>
          <br />
          <span className="text-neutral-400">instantly with AI</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-neutral-400">
          Paste a landing page URL or describe your idea. We mine real pain
          points from Reddit, map your competitors, and generate outreach-ready
          Ideal Customer Profiles.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 text-left"
        >
          <div className="flex justify-center gap-2 text-sm">
            <ModeButton active={mode === "url"} onClick={() => setMode("url")}>
              URL
            </ModeButton>
            <ModeButton active={mode === "text"} onClick={() => setMode("text")}>
              Text description
            </ModeButton>
          </div>

          {mode === "url" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                required
                placeholder="https://yourproduct.com"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pill-input flex-1 rounded-full border border-border bg-surface px-5 py-3.5 text-sm text-white placeholder:text-neutral-500 transition"
              />
              <button
                type="submit"
                disabled={loading || !value}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cta-gradient px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? "Researching…" : "Run discovery"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                required
                minLength={10}
                rows={4}
                placeholder="Describe the idea: what it does, who it's for, what problem it solves..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pill-input rounded-3xl border border-border bg-surface px-5 py-4 text-sm text-white placeholder:text-neutral-500 transition"
              />
              <button
                type="submit"
                disabled={loading || !value}
                className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-cta-gradient px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? "Researching…" : "Run discovery"}
              </button>
            </div>
          )}
        </form>

        {error && (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-red-900/60 bg-red-950/50 px-5 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {report && <Report report={report} />}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-10">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cta-gradient text-xs">
          ✦
        </span>
        ICP Discovery Engine
      </div>
      <a
        href="https://github.com/highnesser/highnesser.github.io/tree/main/icp-discovery-engine"
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-cta-gradient px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-900/40 transition hover:brightness-110"
      >
        View source
      </a>
    </header>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-cta-gradient text-white shadow-md shadow-violet-900/30"
          : "border border-border bg-white/5 text-neutral-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Report({ report }: { report: DiscoveryReport }) {
  return (
    <div className="mt-16 space-y-10 text-left">
      {report.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/40 px-5 py-4 text-sm text-amber-200">
          <ul className="list-disc space-y-1 pl-5">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Product summary">
        <p className="text-neutral-300">{report.seedExpansion.productSummary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>
            📍 {report.seedExpansion.detectedMarket.country} ({report.seedExpansion.detectedMarket.currencySymbol} {report.seedExpansion.detectedMarket.currency})
          </Chip>
          {report.seedExpansion.industryVerticals.map((v) => (
            <Chip key={v}>{v}</Chip>
          ))}
        </div>
      </Section>

      <Section title={`Pain themes (${report.painThemes.length})`}>
        <div className="space-y-4">
          {report.painThemes.map((p) => (
            <Card key={p.theme}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium text-white">{p.theme}</h3>
                <span className="whitespace-nowrap text-xs text-violet-300">
                  score {p.painScore} · {p.mentionCount} mentions ·{" "}
                  {p.emotionalIntensity}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-400">{p.summary}</p>
              {p.representativeQuotes.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm italic text-neutral-500">
                  {p.representativeQuotes.map((q, i) => (
                    <li key={i}>&ldquo;{q}&rdquo;</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section title={`Competitors (${report.positioningMatrix.competitors.length})`}>
        <div className="space-y-4">
          {report.positioningMatrix.competitors.map((c) => (
            <Card key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-violet-300 underline decoration-violet-700 underline-offset-4"
              >
                {c.name}
              </a>
              <p className="mt-1.5 text-sm text-neutral-400">{c.description}</p>
            </Card>
          ))}
        </div>
        {report.positioningMatrix.featureGaps.length > 0 && (
          <div className="mt-4 text-sm">
            <h4 className="font-medium text-white">Feature gaps to exploit</h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-neutral-400">
              {report.positioningMatrix.featureGaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={`ICPs (${report.icps.length})`}>
        <div className="space-y-6">
          {report.icps.map((icp) => (
            <Card key={icp.name}>
              <h3 className="font-medium text-white">{icp.name}</h3>
              <p className="text-sm text-neutral-500">
                {icp.jobTitle} · {icp.companySize}
              </p>
              <p className="mt-2.5 text-sm text-neutral-300">{icp.dailyWorkflow}</p>
              <p className="mt-2.5 text-sm">
                <span className="text-neutral-500">Trigger: </span>
                <span className="text-neutral-300">{icp.trigger}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {icp.channels.map((ch) => (
                  <Chip key={ch}>{ch}</Chip>
                ))}
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-violet-300">
                  Outreach template &amp; landing copy
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-neutral-300">
                  {icp.outreachTemplate}
                </p>
                <p className="mt-3 text-neutral-300">
                  <strong className="text-white">
                    {icp.landingPageCopy.headline}
                  </strong>
                  <br />
                  {icp.landingPageCopy.subheadline}
                  <br />
                  <em className="text-violet-300">CTA: {icp.landingPageCopy.cta}</em>
                </p>
                <p className="mt-3 text-neutral-500">
                  Lead magnet: {icp.leadMagnetIdea}
                </p>
              </details>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong">
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-white/5 px-3 py-1 text-violet-200">
      {children}
    </span>
  );
}
