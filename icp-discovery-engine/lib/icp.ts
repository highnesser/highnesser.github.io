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
exact subreddits, exact job titles, exact triggers.`;

/**
 * Module 4: Automated ICP & Channel Discovery Generator.
 * Converts mined pain themes + competitive positioning into 2-3 ICPs, each
 * with acquisition channels, an outreach template, a lead magnet idea, and
 * landing page copy tailored to that ICP's language.
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

  const prompt = `Product summary: ${seed.productSummary}
Industry verticals: ${seed.industryVerticals.join(", ")}

Top validated pain themes:
${painSummary || "none found - reason from the product summary and problem concepts instead"}

Problem concepts: ${seed.problemConcepts.join(", ")}
Competitive feature gaps: ${gapSummary}

Generate 2-3 hyper-specific Ideal Customer Profiles. Return JSON:
{
  "icps": [
    {
      "name": "short persona label, e.g. 'Overworked Agency Ops Lead'",
      "jobTitle": "specific job title",
      "companySize": "specific range, e.g. '10-50 employees'",
      "dailyWorkflow": "2-3 sentences on their actual day-to-day workflow relevant to this problem",
      "trigger": "the specific event/moment that makes them start searching for a solution",
      "channels": ["3-5 exact acquisition channels, e.g. 'r/agency Reddit community seeding', 'LinkedIn outreach to Ops Managers at 10-50 person agencies', 'programmatic SEO for [X] comparison pages'"],
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
