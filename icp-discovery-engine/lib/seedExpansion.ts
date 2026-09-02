import { completeJSON } from "./llm";
import type {
  LandingPageExtract,
  SeedExpansion,
  SeedInput,
} from "./types";

const SYSTEM = `You are a market research analyst helping a founder validate a product idea.
Given a product description (from a landing page or raw text), generate a compact
research brief the rest of a discovery pipeline will use to search Reddit, review
sites, and search engines. Be specific and concrete - avoid generic marketing language.
Never default to US-centric assumptions (US cities, US subreddits, USD pricing) unless
the input actually signals a US market - infer the real target market from domain,
currency, city/country names, phone formats, or language, and say so explicitly.`;

/**
 * Module 1: Input Parsing & Seed Expansion.
 * Turns a URL scrape or raw text description into search terms, problem
 * concepts, industry verticals, adjacent competitor categories, and a
 * detected target market (country/currency) that downstream modules (pain
 * mining, competitor discovery, ICP generation) use to stay localized
 * instead of defaulting to US assumptions.
 */
export async function expandSeed(
  input: SeedInput,
  landingPage: LandingPageExtract | null
): Promise<SeedExpansion> {
  const sourceText = landingPage
    ? `Landing page URL: ${landingPage.url}\nLanding page title: ${landingPage.title}\nMeta description: ${landingPage.metaDescription}\nHeadings: ${landingPage.headings.join(" | ")}\nBody excerpt: ${landingPage.bodyExcerpt}`
    : `Raw idea description: ${input.text}`;

  const prompt = `${sourceText}

Analyze this product/idea and produce a JSON object with this exact shape:
{
  "productSummary": "1-2 sentence plain-language summary of what this product does and who it's for",
  "searchTerms": ["5 to 10 concrete search terms/phrases someone would use on Reddit or Google to find this problem or its solutions"],
  "problemConcepts": ["3 to 6 underlying pain/problem concepts this product solves, phrased as the problem, not the solution"],
  "industryVerticals": ["2 to 5 industry or niche tags this product/idea belongs to"],
  "adjacentCategories": ["3 to 6 adjacent or competitor product categories, including manual workarounds like 'spreadsheets' or 'Zapier chains' if relevant"],
  "detectedMarket": {
    "country": "the specific country this product targets, inferred from domain TLD, city/region names, currency, phone formats, or language in the source text - use 'Global' only if there is genuinely no signal at all",
    "currency": "the ISO 4217 currency code for that country, e.g. NGN, USD, GBP, KES",
    "currencySymbol": "the currency symbol to display, e.g. ₦, $, £",
    "confidence": "high" | "medium" | "low"
  }
}`;

  return completeJSON<SeedExpansion>(prompt, SYSTEM);
}
