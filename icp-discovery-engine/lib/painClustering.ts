import { completeJSON } from "./llm";
import type { PainMention, PainTheme } from "./types";

const SYSTEM = `You are a market research analyst clustering real user complaints into
themes. You will be given raw forum post excerpts. Group them into recurring pain
themes, quantify how strong the signal is, and cite real quotes and URLs - never
invent quotes or scores that aren't grounded in the provided posts.`;

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

  const prompt = `Here are ${Math.min(mentions.length, 150)} raw Reddit posts/complaints gathered while researching a product idea:

${corpus}

Cluster these into 3-8 recurring pain themes. For each theme return:
{
  "themes": [
    {
      "theme": "short theme name",
      "summary": "1-2 sentence description of the underlying pain/inefficiency",
      "painScore": <integer 1-100, weighting mention count, upvotes, comment count, and emotional intensity>,
      "mentionCount": <how many of the provided posts belong to this theme>,
      "emotionalIntensity": "low" | "medium" | "high",
      "representativeQuotes": ["1-3 short direct quotes pulled from the excerpts above"],
      "sourceUrls": ["the URL field of each post belonging to this theme"]
    }
  ]
}

Only use content actually present in the posts above. Return JSON matching this shape exactly, sorted by painScore descending.`;

  const { themes } = await completeJSON<{ themes: PainTheme[] }>(
    prompt,
    SYSTEM
  );
  return themes;
}
