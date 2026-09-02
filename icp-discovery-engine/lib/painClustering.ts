import { completeJSON, searchWeb } from "./llm";
import type { PainMention, PainTheme, SeedExpansion } from "./types";

const SYSTEM = `You are a market research analyst clustering real user complaints into
themes. You will be given raw forum post excerpts or web search findings. Group them
into recurring pain themes, quantify how strong the signal is, and cite real quotes
and URLs - never invent quotes or scores that aren't grounded in the provided
material.`;

/**
 * Module 2 (clustering half): given raw pain mentions (from Reddit, reviews,
 * etc.), uses the LLM to cluster them into semantic pain themes with a
 * frequency + emotional-intensity score. This is the step vector embeddings
 * would normally do at scale; at MVP scope a single LLM pass over the
 * (bounded) mention set is simpler and good enough.
 */
export async function clusterPainMentions(
  mentions: PainMention[]
): Promise<PainTheme[]> {
  if (mentions.length === 0) return [];

  const corpus = mentions
    .slice(0, 150)
    .map(
      (m, i) =>
        `[${i}] r/${m.subreddit} | score:${m.score} comments:${m.numComments} | ${m.title}\n${m.excerpt}\nURL: ${m.url}`
    )
    .join("\n\n");

  return clusterFromCorpus(
    corpus,
    `Here are ${Math.min(mentions.length, 150)} raw Reddit posts/complaints gathered while researching a product idea:`
  );
}

/**
 * Fallback pain mining for when Reddit search comes back empty - common for
 * niche or geographically local products (e.g. a single-country product)
 * where Reddit simply has no dense conversation. Uses Gemini's grounded
 * Google Search to find real complaints/discussions about the underlying
 * problem across the broader web (forums, review sites, social posts)
 * instead of Reddit alone.
 */
export async function findPainViaGroundedSearch(
  seed: SeedExpansion
): Promise<PainTheme[]> {
  const market = seed.detectedMarket;
  const marketQualifier = market.confidence === "low" ? "" : ` in ${market.country}`;

  const query = `Search the web for real people complaining about or discussing this problem${marketQualifier}: ${seed.problemConcepts.join("; ")}.
This is for a product idea: ${seed.productSummary}
Find actual quotes, forum posts, reviews, or social media discussions - not generic summaries. Include the source URL for each.`;

  const { text, sources } = await searchWeb(query, SYSTEM);
  if (!text.trim()) return [];

  const sourceList = sources.map((s) => `${s.title}: ${s.url}`).join("\n");
  const corpus = `${text}\n\nSource URLs:\n${sourceList}`;

  return clusterFromCorpus(
    corpus,
    "Here are web search findings (with source URLs) about real people discussing this problem:"
  );
}

async function clusterFromCorpus(
  corpus: string,
  intro: string
): Promise<PainTheme[]> {
  const prompt = `${intro}

${corpus}

Cluster these into 3-8 recurring pain themes. For each theme return:
{
  "themes": [
    {
      "theme": "short theme name",
      "summary": "1-2 sentence description of the underlying pain/inefficiency",
      "painScore": <integer 1-100, weighting mention count, upvotes, comment count, and emotional intensity>,
      "mentionCount": <how many distinct posts/sources belong to this theme>,
      "emotionalIntensity": "low" | "medium" | "high",
      "representativeQuotes": ["1-3 short direct quotes pulled from the material above"],
      "sourceUrls": ["the URL of each source belonging to this theme"]
    }
  ]
}

Only use content actually present in the material above. Return JSON matching this shape exactly, sorted by painScore descending.`;

  const { themes } = await completeJSON<{ themes: PainTheme[] }>(
    prompt,
    SYSTEM
  );
  return themes;
}
