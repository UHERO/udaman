/**
 * Small fuzzy matcher for picking people out of a short list (users by name,
 * email, or id). Not a general search engine — it ranks a few hundred rows.
 *
 * Each whitespace-separated query token must match at least one field; a
 * token's score is its best match across fields, and the record's score is
 * the sum. Per field, best first: exact, prefix, word-start (after a space or
 * . _ - @ in an email), substring, then in-order subsequence ("jsmth" →
 * "john.smith"), which tolerates dropped letters but not swapped ones.
 */

const WORD_BREAK = /[\s._\-@+]/;

function scoreField(token: string, field: string): number {
  if (!field) return 0;
  if (field === token) return 100;
  if (field.startsWith(token)) return 80;
  const at = field.indexOf(token);
  if (at > 0 && WORD_BREAK.test(field[at - 1]!)) return 60;
  for (
    let i = field.indexOf(token, at + 1);
    i > 0;
    i = field.indexOf(token, i + 1)
  ) {
    if (WORD_BREAK.test(field[i - 1]!)) return 60;
  }
  if (at >= 0) return 40;
  return subsequenceScore(token, field);
}

/** 1–30 for an in-order subsequence match, tighter spans scoring higher; 0 if none. */
function subsequenceScore(token: string, field: string): number {
  if (token.length < 2) return 0;
  let fi = 0;
  let first = -1;
  for (const ch of token) {
    const found = field.indexOf(ch, fi);
    if (found < 0) return 0;
    if (first < 0) first = found;
    fi = found + 1;
  }
  const span = fi - first;
  return Math.max(1, Math.round(30 * (token.length / span)));
}

/**
 * Score `fields` against `query`; 0 means no match. Fields and query are
 * compared case-insensitively.
 */
export function fuzzyScore(
  query: string,
  fields: (string | number | null | undefined)[],
): number {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const haystack = fields
    .filter((f) => f != null && f !== "")
    .map((f) => String(f).toLowerCase());

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of haystack)
      best = Math.max(best, scoreField(token, field));
    if (!best) return 0;
    total += best;
  }
  return total;
}
