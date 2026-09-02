import type { PainMention } from "./types";

const USER_AGENT =
  process.env.REDDIT_USER_AGENT || "icp-discovery-engine/0.1 (by /u/unknown)";

interface RedditPost {
  data: {
    subreddit: string;
    title: string;
    selftext: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
  };
}

/**
 * Module 2 (Reddit half): searches public Reddit for posts matching each
 * search term. Uses OAuth app credentials when REDDIT_CLIENT_ID/SECRET are
 * set (higher rate limit, more reliable); otherwise falls back to Reddit's
 * unauthenticated public search JSON endpoint, which works but is rate
 * limited and can be blocked under sustained load.
 */
export async function searchRedditPain(
  searchTerms: string[],
  { limitPerTerm = 15 }: { limitPerTerm?: number } = {}
): Promise<PainMention[]> {
  const token = await getAppToken();
  const results: PainMention[] = [];
  const seen = new Set<string>();

  for (const term of searchTerms) {
    try {
      const posts = await searchOnce(term, limitPerTerm, token);
      for (const post of posts) {
        if (seen.has(post.data.permalink)) continue;
        seen.add(post.data.permalink);
        results.push({
          source: "reddit",
          subreddit: post.data.subreddit,
          title: post.data.title,
          url: `https://www.reddit.com${post.data.permalink}`,
          excerpt: (post.data.selftext || post.data.title).slice(0, 1000),
          score: post.data.score,
          numComments: post.data.num_comments,
          createdUtc: post.data.created_utc,
        });
      }
    } catch (err) {
      console.error(`Reddit search failed for "${term}":`, err);
    }
  }

  return results;
}

async function searchOnce(
  term: string,
  limit: number,
  token: string | null
): Promise<RedditPost[]> {
  const params = new URLSearchParams({
    q: term,
    sort: "relevance",
    limit: String(limit),
    t: "year",
  });

  const base = token
    ? "https://oauth.reddit.com/search"
    : "https://www.reddit.com/search.json";

  const res = await fetch(`${base}?${params.toString()}`, {
    headers: {
      "user-agent": USER_AGENT,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit search error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return (data?.data?.children ?? []) as RedditPost[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error(`Reddit OAuth failed ${res.status}, falling back to public search`);
    return null;
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}
