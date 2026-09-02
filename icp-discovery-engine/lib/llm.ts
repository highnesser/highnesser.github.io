const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export class LLMNotConfiguredError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Add it to .env.local to enable LLM-driven synthesis. Get a free key (no card required) at https://aistudio.google.com/apikey."
    );
    this.name = "LLMNotConfiguredError";
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
}

/**
 * Low-level call to Gemini's generateContent endpoint with retry on
 * transient errors (503 overload, 429/500 rate limit) via exponential
 * backoff instead of failing the request on a momentary blip.
 */
async function generateContent(payload: object): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError();

  const body = JSON.stringify(payload);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${GEMINI_BASE_URL}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
    });

    if (res.ok) return res.json();

    const responseBody = await res.text();
    lastError = new Error(`Gemini API error ${res.status}: ${responseBody}`);

    if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_RETRIES) {
      throw lastError;
    }
    await sleep(2 ** attempt * 500 + Math.random() * 250);
  }
  throw lastError ?? new Error("Gemini API request failed");
}

function extractText(data: GeminiResponse): string {
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    throw new Error(`Gemini declined the request (finishReason: ${finishReason})`);
  }

  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");

  if (!text) throw new Error("Gemini API returned no text content");
  return text;
}

/**
 * Sends a single-turn prompt to Gemini and returns the raw text response.
 * Uses Google's free-tier Generative Language API (no billing required at
 * signup). Throws LLMNotConfiguredError if no API key is present so callers
 * can degrade gracefully instead of crashing the whole pipeline.
 */
export async function completeText(
  prompt: string,
  system?: string,
  { jsonMode = false }: { jsonMode?: boolean } = {}
): Promise<string> {
  const data = await generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: 8192,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
  return extractText(data);
}

export interface GroundedResult {
  text: string;
  sources: { title: string; url: string }[];
}

/**
 * Same as completeText, but grants Gemini live Google Search access
 * (grounding) so it can pull in real, current web results instead of
 * relying only on its training data - used for pain mining and competitor
 * discovery so the pipeline doesn't depend on a separate paid search API
 * key. Cannot be combined with jsonMode (the Gemini API rejects mixing
 * tools with structured JSON output), so callers that need structured data
 * should run a grounded search first, then a separate completeJSON pass to
 * structure the grounded findings.
 */
export async function searchWeb(
  prompt: string,
  system?: string
): Promise<GroundedResult> {
  const data = await generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    tools: [{ google_search: {} }],
    generationConfig: { maxOutputTokens: 8192 },
  });

  const text = extractText(data);
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
    .filter((s) => s.url);

  return { text, sources };
}

/**
 * Same as completeText, but requests strict JSON via Gemini's native JSON
 * response mode and parses it. Strips markdown code fences as a fallback in
 * case the model wraps the JSON anyway.
 */
export async function completeJSON<T>(
  prompt: string,
  system?: string
): Promise<T> {
  const raw = await completeText(
    `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.`,
    system,
    { jsonMode: true }
  );
  const cleaned = raw
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
