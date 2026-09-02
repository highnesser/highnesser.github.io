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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold">ICP Discovery Engine</h1>
      <p className="mt-2 text-neutral-400">
        Paste a landing page URL or describe your idea. We&apos;ll mine real
        pain points, map your competitors, and generate ICPs with outreach
        copy.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded px-3 py-1 ${mode === "url" ? "bg-white text-black" : "bg-neutral-800"}`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded px-3 py-1 ${mode === "text" ? "bg-white text-black" : "bg-neutral-800"}`}
          >
            Text description
          </button>
        </div>

        {mode === "url" ? (
          <input
            type="url"
            required
            placeholder="https://yourproduct.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-3"
          />
        ) : (
          <textarea
            required
            minLength={10}
            rows={4}
            placeholder="Describe the idea: what it does, who it's for, what problem it solves..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-3"
          />
        )}

        <button
          type="submit"
          disabled={loading || !value}
          className="rounded bg-white px-5 py-2.5 font-medium text-black disabled:opacity-50"
        >
          {loading ? "Researching..." : "Run discovery"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded border border-red-800 bg-red-950 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      {report && <Report report={report} />}
    </main>
  );
}

function Report({ report }: { report: DiscoveryReport }) {
  return (
    <div className="mt-12 space-y-10">
      {report.warnings.length > 0 && (
        <div className="rounded border border-yellow-800 bg-yellow-950 px-4 py-3 text-sm text-yellow-200">
          <ul className="list-disc space-y-1 pl-5">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-xl font-semibold">Product summary</h2>
        <p className="mt-2 text-neutral-300">
          {report.seedExpansion.productSummary}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {report.seedExpansion.industryVerticals.map((v) => (
            <span key={v} className="rounded-full bg-neutral-800 px-3 py-1">
              {v}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">
          Pain themes ({report.painThemes.length})
        </h2>
        <div className="mt-4 space-y-4">
          {report.painThemes.map((p) => (
            <div key={p.theme} className="rounded border border-neutral-800 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{p.theme}</h3>
                <span className="text-sm text-neutral-400">
                  score {p.painScore} · {p.mentionCount} mentions ·{" "}
                  {p.emotionalIntensity}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-300">{p.summary}</p>
              {p.representativeQuotes.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm italic text-neutral-400">
                  {p.representativeQuotes.map((q, i) => (
                    <li key={i}>&ldquo;{q}&rdquo;</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">
          Competitors ({report.positioningMatrix.competitors.length})
        </h2>
        <div className="mt-4 space-y-4">
          {report.positioningMatrix.competitors.map((c) => (
            <div key={c.url} className="rounded border border-neutral-800 p-4">
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                {c.name}
              </a>
              <p className="mt-1 text-sm text-neutral-300">{c.description}</p>
            </div>
          ))}
        </div>
        {report.positioningMatrix.featureGaps.length > 0 && (
          <div className="mt-4 text-sm">
            <h4 className="font-medium">Feature gaps to exploit</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-300">
              {report.positioningMatrix.featureGaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">ICPs ({report.icps.length})</h2>
        <div className="mt-4 space-y-6">
          {report.icps.map((icp) => (
            <div key={icp.name} className="rounded border border-neutral-800 p-4">
              <h3 className="font-medium">{icp.name}</h3>
              <p className="text-sm text-neutral-400">
                {icp.jobTitle} · {icp.companySize}
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                {icp.dailyWorkflow}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-neutral-500">Trigger: </span>
                {icp.trigger}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {icp.channels.map((ch) => (
                  <span key={ch} className="rounded-full bg-neutral-800 px-3 py-1">
                    {ch}
                  </span>
                ))}
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-neutral-400">
                  Outreach template & landing copy
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-neutral-300">
                  {icp.outreachTemplate}
                </p>
                <p className="mt-2 text-neutral-300">
                  <strong>{icp.landingPageCopy.headline}</strong>
                  <br />
                  {icp.landingPageCopy.subheadline}
                  <br />
                  <em>CTA: {icp.landingPageCopy.cta}</em>
                </p>
                <p className="mt-2 text-neutral-400">
                  Lead magnet: {icp.leadMagnetIdea}
                </p>
              </details>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
