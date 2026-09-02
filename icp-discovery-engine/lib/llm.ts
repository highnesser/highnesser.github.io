const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5";

export class LLMNotConfiguredError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable LLM-driven synthesis."
    );
    this.name = "LLMNotConfiguredError";
  }
}

/**
 * Sends a single-turn prompt to Claude and returns the raw text response.
 * Throws LLMNotConfiguredError if no API key is present so callers can
 * degrade gracefully instead of crashing the whole pipeline.
 */
export async function completeText(
  prompt: string,
  system?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMNotConfiguredError();

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.content
    ?.map((block: { type: string; text?: string }) =>
      block.type === "text" ? block.text : ""
    )
    .join("");

  if (!text) throw new Error("Anthropic API returned no text content");
  return text;
}

/**
 * Same as completeText, but instructs the model to return strict JSON and
 * parses it. Strips markdown code fences if the model wraps the JSON anyway.
 */
export async function completeJSON<T>(
  prompt: string,
  system?: string
): Promise<T> {
  const raw = await completeText(
    `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.`,
    system
  );
  const cleaned = raw
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
