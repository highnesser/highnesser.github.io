import { completeJSON } from "./llm";
import type {
  ICP,
  PainTheme,
  PositioningMatrix,
  SeedExpansion,
} from "./types";

const SYSTEM = `You are a go-to-market strategist. Given validated pain themes and a
competitive positioning matrix, produce hyper-specific Ideal Customer Profiles and
concrete acquisition plays. Avoid generic advice like "post on social media" - name
exact subreddits, exact job titles, exact triggers. Always match the founder's actual
target market: use the correct local currency for any prices, name acquisition
channels that real people in that country/region actually use (not just US-centric
defaults like generic subreddits or LinkedIn if the market doesn't skew that way),
and reference locally recognizable companies, cities, or platforms where relevant.`;

/**
 * Module 4: Automated ICP & Channel Discovery Generator.
 * Converts mined pain themes + competitive positioning into 2-3 ICPs, each
 * with acquisition channels, an outreach template, a lead magnet idea, and
 * landing page copy tailored to that ICP's language and detected market.
 */
export async function generateICPs(
  seed: SeedExpansion,
  painThemes: PainTheme[],
  positioning: PositioningMatrix
): Promise<ICP[]> {
  const painSummary = painThemes
    .map((p) => `- ${p.theme} (score ${p.painScore}): ${p.summary}`)
    .join("\n");
  const gapSummary = positioning.featureGaps.join("; ") || "none identified";
  const market = seed.detectedMarket;

  const prompt = `Product summary: ${seed.productSummary}
Industry verticals: ${seed.industryVerticals.join(", ")}
Target market: ${market.country} (currency: ${market.currency}, symbol: ${market.currencySymbol}, detection confidence: ${market.confidence})

Top validated pain themes:
${painSummary || "none found - reason from the product summary and problem concepts instead"}

Problem concepts: ${seed.problemConcepts.join(", ")}
Competitive feature gaps: ${gapSummary}

Generate 2-3 hyper-specific Ideal Customer Profiles for the target market above -
not a generic or US-default market unless the target market actually is the US/Global.
Return JSON:
{
  "icps": [
    {
      "name": "short persona label, e.g. 'Overworked Agency Ops Lead'",
      "jobTitle": "specific job title",
      "companySize": "specific range, e.g. '10-50 employees'",
      "dailyWorkflow": "2-3 sentences on their actual day-to-day workflow relevant to this problem",
      "trigger": "the specific event/moment that makes them start searching for a solution",
      "channels": ["3-5 exact acquisition channels real people in this market actually use - name real local communities, platforms, or publications, not generic placeholders"],
      "outreachTemplate": "a short cold outreach email (3-5 sentences) written in this ICP's own language, referencing their specific pain",
      "leadMagnetIdea": "one specific lead magnet idea tailored to this ICP",
      "landingPageCopy": {
        "headline": "a headline speaking directly to this ICP's trigger/pain",
        "subheadline": "supporting subheadline",
        "cta": "call to action button text"
      }
    }
  ]
}`;

  const { icps } = await completeJSON<{ icps: ICP[] }>(prompt, SYSTEM);
  return icps;
}
