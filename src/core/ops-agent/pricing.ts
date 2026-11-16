/**
 * Token pricing for cost accounting (USD per million tokens). The Anthropic
 * Console stays the billing authority; these keep the $50/month cap honest
 * between invoices. Update when prices or the model change.
 */

export const PRICES: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.1,
  },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
  },
};

/** Web search: $10 per 1,000 searches. */
export const WEB_SEARCH_USD = 0.01;

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function costOf(model: string, u: UsageLike): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead) /
      1_000_000 +
    (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
  );
}
