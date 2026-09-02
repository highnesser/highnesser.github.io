/**
 * Minimal per-IP rate limiter for /api/discover, which triggers metered
 * Anthropic/SerpAPI/Firecrawl calls on every request. This is a process-local
 * in-memory sliding window - fine as a baseline guardrail, but it resets on
 * redeploy/restart and doesn't share state across serverless instances. For
 * a real deployment, replace with a durable store (e.g. Upstash Redis rate
 * limiting) - see README "Next up".
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const existing = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = existing[0] + WINDOW_MS - now;
    hits.set(key, existing);
    return { allowed: false, retryAfterMs };
  }

  existing.push(now);
  hits.set(key, existing);
  return { allowed: true };
}
