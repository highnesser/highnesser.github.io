import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractLandingPage } from "@/lib/scrape";
import { expandSeed } from "@/lib/seedExpansion";
import { searchRedditPain } from "@/lib/reddit";
import { clusterPainMentions, findPainViaGroundedSearch } from "@/lib/painClustering";
import { discoverCompetitors } from "@/lib/competitors";
import { generateICPs } from "@/lib/icp";
import { LLMNotConfiguredError } from "@/lib/llm";
import { UnsafeUrlError } from "@/lib/ssrf";
import { checkRateLimit } from "@/lib/rateLimit";
import type { DiscoveryReport } from "@/lib/types";

export const maxDuration = 300;

const bodySchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().min(10).optional(),
  })
  .refine((v) => v.url || v.text, {
    message: "Provide either a url or a text description",
  });

/**
 * Orchestrates modules 1-4 into a single discovery pipeline:
 * input parsing -> seed expansion -> pain mining -> competitor discovery -> ICP generation.
 * Module 5 (feedback loop) is intentionally not wired here - see lib/feedbackLoop.ts.
 */
export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)),
        },
      }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const warnings: string[] = [];

  try {
    const landingPage = input.url ? await extractLandingPage(input.url) : null;

    const seed = await expandSeed(input, landingPage);

    const [painMentions, competitorResult] = await Promise.all([
      searchRedditPain(seed.searchTerms),
      discoverCompetitors(seed),
    ]);
    warnings.push(...competitorResult.warnings);

    let painThemes = painMentions.length > 0 ? await clusterPainMentions(painMentions) : [];

    if (painThemes.length === 0) {
      // Reddit alone often has nothing for niche or geographically local
      // products - try Gemini's grounded web search across the broader web
      // (forums, reviews, social posts) before giving up. Grounding needs
      // billing enabled on the Google Cloud project behind the API key, so
      // on a pure free-tier key this reliably fails - that's expected and
      // not surfaced as a warning (logged only), since the final "no pain
      // signal found" warning below already covers the empty-result case.
      try {
        painThemes = await findPainViaGroundedSearch(seed);
        if (painThemes.length > 0) {
          warnings.push(
            "No Reddit discussion found for this idea - pain themes below were sourced from a broader web search instead."
          );
        }
      } catch (err) {
        console.error("Web-based pain search unavailable:", (err as Error).message);
      }
    }

    if (painThemes.length === 0) {
      warnings.push(
        "No pain signal found on Reddit or the broader web for the generated search terms - this can mean the category is genuinely novel (see README 'novel ideas' section) or the terms need manual refinement."
      );
    }

    const icps = await generateICPs(seed, painThemes, competitorResult.matrix);

    const report: DiscoveryReport = {
      input,
      landingPage,
      seedExpansion: seed,
      painThemes,
      positioningMatrix: competitorResult.matrix,
      icps,
      generatedAt: new Date().toISOString(),
      warnings,
    };

    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 412 });
    }
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
