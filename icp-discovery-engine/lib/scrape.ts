import * as cheerio from "cheerio";
import { safeFetch } from "./ssrf";
import type { LandingPageExtract } from "./types";

/**
 * Fetches a URL and pulls the value-prop signals off the landing page DOM:
 * title, meta description, headings, and a body excerpt. Uses Firecrawl
 * when FIRECRAWL_API_KEY is set (better JS-rendered page support), else
 * falls back to a plain fetch + cheerio parse.
 */
export async function extractLandingPage(
  url: string
): Promise<LandingPageExtract> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const html = firecrawlKey
    ? await fetchViaFirecrawl(url, firecrawlKey)
    : await fetchDirect(url);

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  const headings = $("h1, h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 20);

  const bodyExcerpt = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  return { url, title, metaDescription, headings, bodyExcerpt };
}

async function fetchDirect(url: string): Promise<string> {
  const res = await safeFetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ICPDiscoveryEngine/0.1; +https://github.com)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchViaFirecrawl(
  url: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats: ["html"] }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.data?.html ?? "";
}
