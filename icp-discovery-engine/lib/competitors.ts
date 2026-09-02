import { completeJSON } from "./llm";
import { extractLandingPage } from "./scrape";
import type { Competitor, PositioningMatrix, SeedExpansion } from "./types";

const SYSTEM = `You are a competitive intelligence analyst. Given scraped competitor
landing pages, produce an honest positioning matrix highlighting real feature gaps,
pricing vulnerabilities, and areas where competitors overcharge or underdeliver.
Do not invent facts not present in the scraped content - if pricing isn't visible,
say so.`;

interface SerpResult {
  title: string;
  link: string;
  snippet?: string;
}

/**
 * Module 3: Competitor & Positioning Discovery.
 * Searches for direct/indirect competitors via SerpAPI (falls back to an
 * empty result set with a warning if no key is configured), scrapes each
 * candidate's landing page, then asks the LLM to synthesize a positioning
 * matrix (feature gaps, pricing vulnerabilities, over/under-delivery areas).
 */
export async function discoverCompetitors(
  seed: SeedExpansion
): Promise<{ matrix: PositioningMatrix; warnings: string[] }> {
  const warnings: string[] = [];
  const serpApiKey = process.env.SERPAPI_KEY;

  if (!serpApiKey) {
    warnings.push(
      "SERPAPI_KEY not configured - competitor discovery skipped. Add a SerpAPI key to enable automated competitor search."
    );
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

  const queries = [
    ...seed.adjacentCategories.map((c) => `${c} alternative`),
    ...seed.searchTerms.slice(0, 3).map((t) => `best ${t} tool`),
  ].slice(0, 6);

  const candidates = await searchCandidates(queries, serpApiKey);
  const competitors = await scrapeCompetitors(candidates.slice(0, 8), warnings);

  if (competitors.length === 0) {
    warnings.push("No competitor landing pages could be scraped successfully.");
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

  const matrix = await synthesizePositioning(competitors);
  return { matrix, warnings };
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
  competitors: Competitor[]
): Promise<PositioningMatrix> {
  const corpus = competitors
    .map((c) => `${c.name} (${c.url}): ${c.description}`)
    .join("\n");

  const prompt = `Here are ${competitors.length} candidate competitors discovered via search:

${corpus}

Return JSON:
{
  "competitors": [
    { "name": "...", "url": "...", "description": "...", "pricingSummary": "note if pricing wasn't visible in the description", "strengths": ["..."], "weaknesses": ["..."] }
  ],
  "featureGaps": ["gaps across these competitors a new entrant could exploit"],
  "pricingVulnerabilities": ["pricing model weaknesses or complaints implied by the descriptions"],
  "overchargeOrUnderdeliverAreas": ["areas where these tools seem to overcharge or underdeliver relative to what they promise"]
}`;

  return completeJSON<PositioningMatrix>(prompt, SYSTEM);
}
