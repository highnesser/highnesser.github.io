import { completeJSON, searchWeb } from "./llm";
import { extractLandingPage } from "./scrape";
import type { Competitor, PositioningMatrix, SeedExpansion } from "./types";

const SYSTEM = `You are a competitive intelligence analyst. Given real web search
findings about competitors, produce an honest positioning matrix highlighting real
feature gaps, pricing vulnerabilities, and areas where competitors overcharge or
underdeliver. Do not invent facts not present in the findings - if pricing isn't
visible, say so. Stay focused on competitors that actually serve the founder's
target market/country, not just well-known global players if a local market was
specified.`;

interface SerpResult {
  title: string;
  link: string;
  snippet?: string;
}

/**
 * Module 3: Competitor & Positioning Discovery.
 *
 * Tries Gemini's built-in Google Search grounding first (it costs nothing
 * extra when available), but grounding requires billing enabled on the
 * underlying Google Cloud project - on a pure free-tier API key it returns
 * 429 RESOURCE_EXHAUSTED immediately, every time. That failure is expected
 * and silent (logged, not surfaced as a warning) so it doesn't read as a
 * broken feature. SerpAPI (free tier, no card - see README) is the
 * documented, reliable free path for competitor discovery; scraped landing
 * pages supplement whichever source found candidates.
 */
export async function discoverCompetitors(
  seed: SeedExpansion
): Promise<{ matrix: PositioningMatrix; warnings: string[] }> {
  const warnings: string[] = [];
  const market = seed.detectedMarket;

  const groundedFindings = await findCompetitorsViaGroundedSearch(seed);

  const serpApiKey = process.env.SERPAPI_KEY;
  const serpCompetitors = serpApiKey
    ? await findCompetitorsViaSerpApi(seed, serpApiKey, warnings)
    : [];

  if (!serpApiKey && !groundedFindings) {
    warnings.push(
      "SERPAPI_KEY not configured and Google Search grounding is unavailable on this API key (requires billing enabled on the Google Cloud project) - competitor discovery skipped. Add a free SerpAPI key to enable it."
    );
  }

  const combinedFindings = [groundedFindings, formatSerpCompetitors(serpCompetitors)]
    .filter(Boolean)
    .join("\n\n");

  if (!combinedFindings.trim()) {
    return {
      matrix: {
        competitors: [],
        featureGaps: [],
        pricingVulnerabilities: [],
        overchargeOrUnderdeliverAreas: [],
      },
      warnings,
    };
  }

  const matrix = await synthesizePositioning(combinedFindings, market.country);
  return { matrix, warnings };
}

async function findCompetitorsViaGroundedSearch(
  seed: SeedExpansion
): Promise<string> {
  const market = seed.detectedMarket;
  const marketQualifier =
    market.confidence === "low" ? "" : ` in ${market.country}`;

  const query = `Find real, currently operating competitor products/companies for this idea: ${seed.productSummary}
Also consider these adjacent categories and manual workarounds people use instead: ${seed.adjacentCategories.join(", ")}.
Search specifically for competitors serving customers${marketQualifier}. For each competitor found, give its name, website URL, a short description, and pricing if visible.`;

  try {
    const { text } = await searchWeb(query, SYSTEM);
    return text;
  } catch (err) {
    // Expected on a free-tier key without billing enabled - see the
    // discoverCompetitors doc comment. Not surfaced as a user-facing
    // warning since SerpAPI (or nothing found) already covers that case.
    console.error("Grounded competitor search unavailable:", (err as Error).message);
    return "";
  }
}

async function findCompetitorsViaSerpApi(
  seed: SeedExpansion,
  apiKey: string,
  warnings: string[]
): Promise<Competitor[]> {
  const queries = [
    ...seed.adjacentCategories.map((c) => `${c} alternative`),
    ...seed.searchTerms.slice(0, 3).map((t) => `best ${t} tool`),
  ].slice(0, 6);

  const candidates = await searchCandidates(queries, apiKey);
  return scrapeCompetitors(candidates.slice(0, 8), warnings);
}

function formatSerpCompetitors(competitors: Competitor[]): string {
  if (competitors.length === 0) return "";
  return competitors
    .map((c) => `${c.name} (${c.url}): ${c.description}`)
    .join("\n");
}

async function searchCandidates(
  queries: string[],
  apiKey: string
): Promise<SerpResult[]> {
  const seen = new Set<string>();
  const results: SerpResult[] = [];

  for (const q of queries) {
    const params = new URLSearchParams({
      q,
      api_key: apiKey,
      engine: "google",
      num: "5",
    });
    try {
      const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data?.organic_results ?? []) {
        const link = r.link as string | undefined;
        if (!link || seen.has(link)) continue;
        seen.add(link);
        results.push({ title: r.title ?? "", link, snippet: r.snippet });
      }
    } catch (err) {
      console.error(`SerpAPI search failed for "${q}":`, err);
    }
  }

  return results;
}

async function scrapeCompetitors(
  candidates: SerpResult[],
  warnings: string[]
): Promise<Competitor[]> {
  const competitors: Competitor[] = [];

  for (const c of candidates) {
    try {
      const page = await extractLandingPage(c.link);
      competitors.push({
        name: page.title || c.title,
        url: c.link,
        description: page.metaDescription || c.snippet || "",
        pricingSummary: "",
        strengths: [],
        weaknesses: [],
      });
    } catch (err) {
      warnings.push(`Could not scrape ${c.link}: ${(err as Error).message}`);
    }
  }

  return competitors;
}

async function synthesizePositioning(
  findings: string,
  targetCountry: string
): Promise<PositioningMatrix> {
  const prompt = `Target market: ${targetCountry}

Web search findings on competitors:

${findings}

Return JSON:
{
  "competitors": [
    { "name": "...", "url": "...", "description": "...", "pricingSummary": "note if pricing wasn't visible in the findings", "strengths": ["..."], "weaknesses": ["..."] }
  ],
  "featureGaps": ["gaps across these competitors a new entrant could exploit"],
  "pricingVulnerabilities": ["pricing model weaknesses or complaints implied by the findings"],
  "overchargeOrUnderdeliverAreas": ["areas where these tools seem to overcharge or underdeliver relative to what they promise"]
}`;

  return completeJSON<PositioningMatrix>(prompt, SYSTEM);
}
