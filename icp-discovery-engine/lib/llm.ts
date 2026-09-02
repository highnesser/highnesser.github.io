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

/**
 * Sends a single-turn prompt to Gemini and returns the raw text response.
 * Uses Google's free-tier Generative Language API (no billing required at
 * signup). Throws LLMNotConfiguredError if no API key is present so callers
 * can degrade gracefully instead of crashing the whole pipeline. Transient
 * errors (503 overload, 429 rate limit) are retried with exponential
 * backoff instead of failing the request on a momentary blip.
 */
export async function completeText(
  prompt: string,
  system?: string,
  { jsonMode = false }: { jsonMode?: boolean } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError();

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: 8192,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

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

    if (res.ok) return parseGeminiResponse(await res.json());

    const responseBody = await res.text();
    lastError = new Error(`Gemini API error ${res.status}: ${responseBody}`);

    // Gemini overload (503) and rate limiting (429) are transient - retry
    // with exponential backoff instead of failing the whole pipeline on a
    // momentary blip. Anything else (400 bad request, 401/403 auth) is not
    // retryable and fails immediately.
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_RETRIES) {
      throw lastError;
    }
    await sleep(2 ** attempt * 500 + Math.random() * 250);
  }
  throw lastError ?? new Error("Gemini API request failed");
}

function parseGeminiResponse(data: {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
}): string {
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    throw new Error(`Gemini declined the request (finishReason: ${finishReason})`);
  }

  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("");

  if (!text) throw new Error("Gemini API returned no text content");
  return text;
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
