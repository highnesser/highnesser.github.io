const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class LLMNotConfiguredError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Add it to .env.local to enable LLM-driven synthesis. Get a free key (no card required) at https://aistudio.google.com/apikey."
    );
    this.name = "LLMNotConfiguredError";
  }
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError();

  const res = await fetch(`${GEMINI_BASE_URL}/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        maxOutputTokens: 8192,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();

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
