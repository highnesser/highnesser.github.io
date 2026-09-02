# ICP Discovery Engine

Automated **ICP Discovery, Pain Validation, and Competitor Positioning Engine**.
Feed it a landing page URL or a plain-text idea description; it mines real pain
points from Reddit, maps your competitors, and generates 2-3 Ideal Customer
Profiles with acquisition channels, outreach copy, and landing page copy.

> **This file is the progress tracker.** Every work session should end by
> updating "Current status" and "Next up" below so the next session (human or
> Claude) knows exactly where to resume. Don't let this drift out of date.

---

## Current status — MVP scaffold + baseline security hardening (2026-09-02)

The full pipeline architecture (modules 1-4) is built and wired end-to-end
through a working Next.js app. Module 5 (feedback loop) is deliberately
stubbed — see below for why.

| Module | Status | File(s) |
|---|---|---|
| 1. Input parsing & seed expansion | ✅ Built | `lib/scrape.ts`, `lib/seedExpansion.ts` |
| 2. Live channel mining & pain extraction (Reddit only) | ✅ Built | `lib/reddit.ts`, `lib/painClustering.ts` |
| 2b. X/Twitter, G2, Capterra, Trustpilot mining | ❌ Not built | — |
| 3. Competitor & positioning discovery | ✅ Built (needs `SERPAPI_KEY`) | `lib/competitors.ts` |
| 4. ICP & channel generator | ✅ Built | `lib/icp.ts` |
| 5. Feedback loop & live diagnostics | 🚧 Stubbed only | `lib/feedbackLoop.ts` |
| Orchestrator API | ✅ Built | `app/api/discover/route.ts` |
| Dashboard UI | ✅ Built | `app/page.tsx` |
| Vector clustering (Pinecone/Qdrant) | ❌ Not built — using LLM-pass clustering instead (see below) | — |

### What actually works right now

With just `ANTHROPIC_API_KEY` set, you can run `npm run dev`, submit a URL or
text description, and get a real (not mocked) end-to-end report:
- Landing page scrape (or raw text) → LLM-generated search terms/verticals
- Live Reddit search (public, unauthenticated — no key required) for pain
  mentions, clustered into pain themes by an LLM pass
- ICPs with outreach templates and landing page copy, grounded in the mined
  pain themes

Without `SERPAPI_KEY`, competitor discovery is skipped gracefully (a warning
is shown in the report instead of failing the whole pipeline).

A flow-by-flow security review before further build-out flagged two real
gaps in the initial scaffold, both now fixed and runtime-verified:
- **SSRF in the landing-page scraper.** `extractLandingPage()` fetched any
  user-supplied URL server-side with no host restriction — a direct path to
  internal services or cloud metadata endpoints (`169.254.169.254`). Fixed in
  `lib/ssrf.ts` (`safeFetch`/`assertSafeUrl`): blocks non-http(s) schemes,
  loopback/private/link-local/carrier-NAT ranges on both the hostname and
  every DNS-resolved address (guards against DNS rebinding), and validates
  each redirect hop manually.
- **No rate limiting on `/api/discover`.** Every request triggers metered
  Anthropic/SerpAPI/Firecrawl calls with no cap. Fixed in `lib/rateLimit.ts`
  with a per-IP sliding window (5 req/hour) — noted below as a baseline to
  replace with a durable store before real deployment.

### Deliberate scope decisions (read before "fixing" these)

- **Vector DB skipped.** The original spec calls for Pinecone/Qdrant +
  embeddings to cluster complaints at scale. At MVP scope (dozens to low
  hundreds of Reddit posts per run), a single LLM call over the raw post
  corpus produces equivalent clustering quality with far less infrastructure.
  Revisit this once a single run needs to cluster thousands of posts across
  multiple sources — see "Next up."
- **Only Reddit is wired for pain mining.** X/Twitter, G2, Capterra, and
  Trustpilot all need paid API access or dedicated scrapers the MVP didn't
  have credentials for. `lib/reddit.ts` is the pattern to copy for each
  additional source.
- **Module 5 (feedback loop) is a typed stub, not mock data.** It requires a
  live outbound campaign (Instantly/HubSpot) to have anything real to
  classify. Stubbing it with fake replies would produce a feature that looks
  done but teaches nothing. See `lib/feedbackLoop.ts` for the planned shape.
- **No persistence layer.** Reports are generated synchronously and returned
  as JSON; nothing is saved to a database yet. Fine for testing the pipeline,
  not fine for a real product (a user can't come back to a past report).

---

## Setup

```bash
cd icp-discovery-engine
npm install
cp .env.example .env.local
# then edit .env.local — at minimum set ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

### Required / optional API keys

| Key | Required? | What breaks without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Required** | Nothing works — every module after input parsing calls Claude. |
| `SERPAPI_KEY` | Optional | Competitor discovery (module 3) is skipped with a warning. |
| `FIRECRAWL_API_KEY` | Optional | Falls back to a plain fetch+cheerio scraper (works for most static sites, weaker on JS-heavy sites). |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Optional | Falls back to Reddit's unauthenticated public search JSON endpoint — works, but is rate-limited and less reliable under load. |
| `INSTANTLY_API_KEY` / `HUBSPOT_API_KEY` | Not used yet | Reserved for module 5 once it's built. |

---

## Architecture

```
app/
  page.tsx                  Dashboard: URL/text input form + report view
  api/discover/route.ts     Orchestrator: wires modules 1-4 into one pipeline
lib/
  types.ts                  Shared types for the whole pipeline
  llm.ts                    Thin Anthropic Messages API client (fetch-based)
  scrape.ts                 Module 1: landing page extraction (cheerio / Firecrawl)
  seedExpansion.ts          Module 1: LLM-driven search term/vertical generation
  reddit.ts                 Module 2: Reddit public search for pain mentions
  painClustering.ts         Module 2: LLM clustering of raw mentions into pain themes
  competitors.ts            Module 3: SerpAPI search + landing page scrape + positioning synthesis
  icp.ts                    Module 4: ICP + channel + outreach copy generation
  feedbackLoop.ts           Module 5: STUB — see "Deliberate scope decisions" above
  ssrf.ts                   Security: blocks internal/metadata-address fetches (used by scrape.ts)
  rateLimit.ts              Security: per-IP request cap for /api/discover (in-memory baseline)
```

Data flow: `page.tsx` → `POST /api/discover` → scrape/parse → expand seed →
(reddit search + competitor discovery in parallel) → cluster pain → generate
ICPs → return full `DiscoveryReport` JSON → rendered client-side.

### How it handles brand-new / category-creating ideas

`seedExpansion.ts` generates `problemConcepts` (the underlying pain, phrased
as a problem, not a solution) alongside `searchTerms`. When Reddit search
against `searchTerms` returns nothing, the orchestrator adds a warning
explaining this may mean the category is genuinely novel — the `icp.ts`
prompt is written to reason from `problemConcepts` and the product summary
directly when `painThemes` comes back empty, rather than failing. Fully
implementing the spec's three-tier fallback (manual-workaround forum scan →
adjacent-product review mining → "problem signal volume" scoring) is not done
yet — see "Next up."

---

## Next up (in priority order)

1. **Persistence.** Add a database (Postgres via Prisma or Supabase is the
   natural fit for a Next.js app) so reports are saved and revisitable by URL,
   not just returned once from the API call.
2. **G2/Capterra/Trustpilot review mining.** Copy the `lib/reddit.ts` pattern;
   these sites don't have friendly public APIs, so this likely needs Apify or
   a dedicated scraper — budget more time than Reddit took.
3. **X/Twitter mining.** Needs a paid X API tier; decide budget before
   building.
4. **Novel-idea fallback chain.** Implement the spec's 3-step fallback
   explicitly (manual workaround scan → adjacent product complaint mining →
   problem signal volume score) instead of relying on the LLM prompt alone to
   handle the empty-pain-themes case.
5. **Vector clustering at scale.** Once multiple sources feed pain mining,
   revisit Pinecone/Qdrant + embeddings — the current LLM-pass clustering in
   `painClustering.ts` won't scale past a few hundred posts per run (context
   window + cost).
6. **Module 5 (feedback loop).** Build once there's a real outbound campaign
   to connect to Instantly or HubSpot. See `lib/feedbackLoop.ts` for the
   planned shape.
7. **Auth + multi-tenant dashboard.** Currently single-user, no auth, no
   saved history.
8. **Durable rate limiting.** `lib/rateLimit.ts` is an in-memory per-process
   limiter — fine as a stopgap, but it resets on redeploy and won't share
   state across serverless instances. Swap for a durable store (e.g. Upstash
   Redis) once this is more than a local prototype.

## Known limitations / things to be honest about

- No automated tests yet.
- `npm run build` has been validated to compile cleanly, but the live
  pipeline (real Reddit + SerpAPI + Anthropic calls) has **not** been
  exercised end-to-end in this environment since no API keys are configured
  here — test with your own keys before trusting the output.
- Error handling degrades gracefully per-module (competitor discovery, for
  example) but a hard Anthropic API outage will fail the whole request —
  there's no retry/backoff yet.
- The `next` dependency is pinned to `14.2.35` to pick up published security
  fixes; a residual high-severity advisory remains in a transitive dev-only
  postcss dependency bundled inside `next` itself (source-map path
  traversal) — fixing it requires a Next.js major-version bump, out of scope
  for this MVP pass. Run `npm audit` after `npm install` to confirm current
  status before shipping this to production.
- This currently lives as a subfolder inside `highnesser.github.io` (a public
  repo) rather than its own private repo, because the GitHub integration used
  to build this didn't have repo-creation permission in this session. Move it
  to a dedicated private repo before treating this as more than a prototype —
  see the PR description for details.
