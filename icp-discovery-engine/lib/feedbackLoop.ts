import type { ICP } from "./types";

export type ReplyCategory = "objection" | "interest" | "feature_request" | "other";

export interface ClassifiedReply {
  prospectEmail: string;
  icpName: string;
  rawReply: string;
  category: ReplyCategory;
  summary: string;
}

/**
 * Module 5: Feedback Loop & Live Diagnostic Engine.
 *
 * NOT WIRED YET. This module needs an outbound sequencer connection
 * (Instantly, HubSpot, etc.) to pull real prospect replies before it can do
 * anything - there is no live campaign data to work from until a founder
 * actually runs outreach using the ICPs/templates this engine generates.
 *
 * Planned shape once wired:
 *   1. fetchReplies(provider) -> pull new replies since last sync via the
 *      provider's API (INSTANTLY_API_KEY / HUBSPOT_API_KEY in .env.example).
 *   2. classifyReply(reply) -> LLM call (same pattern as lib/llm.ts) that
 *      buckets each reply into ReplyCategory and extracts a summary.
 *   3. refineICP(icp, replies) -> feeds classified replies back through a
 *      prompt similar to lib/icp.ts to update channel/copy recommendations
 *      based on what's actually landing.
 *
 * See README.md "Next up" for why this is deferred rather than stubbed with
 * fake data: there's nothing meaningful to classify without a live campaign.
 */
export async function classifyReply(
  _rawReply: string,
  _icp: ICP
): Promise<ClassifiedReply> {
  throw new Error(
    "feedbackLoop.classifyReply is not implemented yet - requires an outbound sequencer integration (Instantly/HubSpot). See README.md."
  );
}
