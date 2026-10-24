/**
 * Free-text query handling for the MCP `search_series` tool. Pure functions,
 * no I/O, so they can be unit-tested without the UHERO API.
 *
 * UHERO's `/search/series?q=` runs `ext_search_text REGEXP q` (MariaDB PCRE2)
 * with LIMIT 50 and no ORDER BY. That means:
 *   - raw user text is a regex: "GDP (real" is a 500, "U.S." matches "UxSx"
 *   - a multi-word q only matches as an exact phrase
 *   - geography names, units and sources aren't in the searched text
 * so we parse the query ourselves:
 *   - parseSearchQuery()  : normalize, pull out geo / freq / SA words, drop
 *                           stopwords → { terms, geo, freq, ... }
 *   - buildAllTermsRegex(): ^(?=.*\bterm1)(?=.*\bterm2) — all terms, any order
 *   - buildAnyTermRegex() : (\bterm1|\bterm2) — fallback
 *   - rankSeries()        : local relevance order, since the API's is arbitrary
 */

import type { Frequency } from "@/lib/uhero-client";

export type SaPreference = "sa" | "nsa";

export interface ParsedSearchQuery {
  /** Topic words to search for, at most MAX_TERMS, in query order. */
  terms: string[];
  /** Set only when exactly one geography was named. */
  geo?: string;
  /** Set only when exactly one frequency was named. */
  freq?: Frequency;
  /** Every geography named, in query order. */
  geosMentioned: string[];
  saPreference?: SaPreference;
  /** Words dropped from the query (geo / freq / SA phrases and stopwords). */
  removed: string[];
}

const MAX_TERMS = 5;

// Longest phrase first so "hawaii county" wins over "hawaii", and
// "maui island" over "maui". Bare "hawaii" is handled separately below.
const GEO_PHRASES: Array<[string, string]> = (
  [
    ["city and county of honolulu", "HON"],
    ["state of hawaii", "HI"],
    ["hawaii county", "HAW"],
    ["hawaii island", "HAW"],
    ["big island", "HAW"],
    ["honolulu county", "HON"],
    ["maui island", "MAUI"],
    ["maui county", "MAU"],
    ["kauai county", "KAU"],
    ["united states", "US"],
    ["statewide", "HI"],
    ["honolulu", "HON"],
    ["oahu", "HON"],
    ["maui", "MAU"],
    ["kauai", "KAU"],
    ["lanai", "LAN"],
    ["molokai", "MOL"],
    ["usa", "US"],
    ["u s", "US"],
    ["us", "US"],
    ["japan", "JP"],
    ["california", "CA"],
  ] as Array<[string, string]>
).sort((a, b) => b[0].length - a[0].length);

// Bare "year" / "month" are deliberately absent: they show up in topics like
// "year-over-year".
const FREQ_PHRASES: Array<[string, Frequency]> = (
  [
    ["semi-annual", "S"],
    ["semi annual", "S"],
    ["semiannual", "S"],
    ["annually", "A"],
    ["annual", "A"],
    ["yearly", "A"],
    ["quarterly", "Q"],
    ["monthly", "M"],
    ["weekly", "W"],
    ["daily", "D"],
  ] as Array<[string, Frequency]>
).sort((a, b) => b[0].length - a[0].length);

const SA_PHRASES: Array<[string, SaPreference]> = [
  ["not seasonally adjusted", "nsa"],
  ["seasonally adjusted", "sa"],
  ["nsa", "nsa"],
  ["sa", "sa"],
];

const STOPWORDS = new Set([
  "the",
  "of",
  "in",
  "for",
  "and",
  "on",
  "a",
  "an",
  "by",
  "to",
  "vs",
  "versus",
  "data",
  "series",
  "statistics",
  "stats",
  // Filler that describes a level rather than a topic. As required terms they
  // sink good matches ("job count" vs "Total Nonfarm Jobs"), and "count" also
  // prefix-matches "County". rankSeries prefers "Total ..." titles instead.
  "count",
  "counts",
  "number",
  "numbers",
  "total",
  "totals",
  "amount",
  "level",
  "levels",
  "figures",
  "overall",
]);

/**
 * NFKD + strip combining marks (Lānaʻi → Lanai), drop ʻokina / apostrophes
 * (Kauaʻi, Kaua'i → Kauai), lowercase, turn punctuation other than _ @ - %
 * into spaces, collapse whitespace. UHERO's stored text is latin1 and has no
 * ʻokina, so a query that keeps one matches nothing.
 */
export function normalizeQuery(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[ʻ‘’'`]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_@%\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove every whole-word occurrence of `phrase` from `text` (both already
 * normalized). Returns the new text and how many were removed.
 */
function extractPhrase(
  text: string,
  phrase: string,
): { text: string; count: number } {
  const re = new RegExp(`(^| )${escapeRegex(phrase)}(?= |$)`, "g");
  let count = 0;
  const out = text.replace(re, (_m, lead: string) => {
    count++;
    return lead;
  });
  return { text: out.replace(/\s+/g, " ").trim(), count };
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  let text = normalizeQuery(query);
  const removed: string[] = [];

  let saPreference: SaPreference | undefined;
  for (const [phrase, pref] of SA_PHRASES) {
    const r = extractPhrase(text, phrase);
    if (r.count > 0) {
      text = r.text;
      removed.push(phrase);
      saPreference ??= pref;
    }
  }

  // Record geos in the order they appear in the query, not phrase order.
  const beforeGeo = ` ${text} `;
  const geoHits: Array<{ handle: string; pos: number }> = [];
  for (const [phrase, handle] of GEO_PHRASES) {
    const r = extractPhrase(text, phrase);
    if (r.count === 0) continue;
    text = r.text;
    removed.push(phrase);
    geoHits.push({ handle, pos: beforeGeo.indexOf(` ${phrase} `) });
  }
  // Bare "hawaii" means the state only when nothing more specific was named;
  // "Maui, Hawaii" is still Maui. Either way it isn't a topic word.
  const hawaii = extractPhrase(text, "hawaii");
  if (hawaii.count > 0) {
    text = hawaii.text;
    removed.push("hawaii");
    if (geoHits.length === 0) geoHits.push({ handle: "HI", pos: 0 });
  }
  const geosMentioned = uniq(
    geoHits.sort((a, b) => a.pos - b.pos).map((g) => g.handle),
  );

  const freqs: Frequency[] = [];
  for (const [phrase, freq] of FREQ_PHRASES) {
    const r = extractPhrase(text, phrase);
    if (r.count > 0) {
      text = r.text;
      removed.push(phrase);
      freqs.push(freq);
    }
  }
  const freqsMentioned = uniq(freqs);

  const terms: string[] = [];
  for (const word of text.split(" ")) {
    if (!word) continue;
    if (STOPWORDS.has(word)) {
      removed.push(word);
      continue;
    }
    // A bare "-" or "%" can't anchor a useful search.
    if (!/[\p{L}\p{N}]/u.test(word)) continue;
    // arrivals → arrival; the \b prefix match still finds the plural.
    const term =
      word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
    if (!terms.includes(term)) terms.push(term);
  }

  return {
    terms: terms.slice(0, MAX_TERMS),
    geo: geosMentioned.length === 1 ? geosMentioned[0] : undefined,
    freq: freqsMentioned.length === 1 ? freqsMentioned[0] : undefined,
    geosMentioned,
    saPreference,
    removed,
  };
}

export function escapeRegex(t: string): string {
  return t.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

// \b only makes sense before a word character; "%" or "-" would never match.
const wb = (t: string) => (/^\w/.test(t) ? "\\b" : "") + escapeRegex(t);

/**
 * All terms, any order. The leading ^ matters: without it PCRE2 retries every
 * lookahead at every position of every row on the full scan.
 */
export function buildAllTermsRegex(terms: string[]): string {
  return "^" + terms.map((t) => `(?=.*${wb(t)})`).join("");
}

export function buildAnyTermRegex(terms: string[]): string {
  return `(${terms.map(wb).join("|")})`;
}

/** Subset of RawSeries the ranker reads; kept structural so tests stay small. */
export interface RankableSeries {
  name: string;
  title?: string;
  description?: string;
  seasonallyAdjusted?: boolean;
  seasonalAdjustment?: string;
  observationStart?: string;
  observationEnd?: string;
}

function termMatcher(term: string): RegExp {
  return new RegExp(wb(term), "i");
}

/** How many of `terms` appear in the series's title, name or description. */
export function countTermHits(s: RankableSeries, terms: string[]): number {
  const text = normalizeQuery(
    [s.title, s.name, s.description].filter(Boolean).join(" "),
  );
  return terms.filter((t) => termMatcher(t).test(text)).length;
}

// Each term counts once, at its best field: a description that repeats the
// title ("Total nonfarm jobs, not seasonally adjusted") shouldn't outrank the
// same title with no description.
function relevanceScore(s: RankableSeries, terms: string[]): number {
  const fields: Array<[string, number]> = [
    [s.title, 3],
    [s.name, 2],
    [s.description, 1],
  ]
    .filter((f): f is [string, number] => !!f[0])
    .map(([field, weight]) => [normalizeQuery(field), weight]);
  let score = 0;
  for (const t of terms) {
    const re = termMatcher(t);
    score += Math.max(0, ...fields.map(([text, w]) => (re.test(text) ? w : 0)));
  }
  return score;
}

export function isSeasonallyAdjusted(s: RankableSeries): boolean | undefined {
  if (s.seasonallyAdjusted !== undefined) return s.seasonallyAdjusted;
  if (!s.seasonalAdjustment || s.seasonalAdjustment === "not_applicable") {
    return undefined;
  }
  return s.seasonalAdjustment === "seasonally_adjusted";
}

function rangeMs(s: RankableSeries): number {
  if (!s.observationStart || !s.observationEnd) return 0;
  const ms = Date.parse(s.observationEnd) - Date.parse(s.observationStart);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Sort by term hits (best of title 3, name 2, description 1), then "Total ..."
 * titles (UHERO's headline aggregates, e.g. Total Nonfarm Jobs), then the
 * preferred seasonal adjustment (SA unless the query asked for NSA), then the
 * longer observation range. Stable, so remaining ties keep the API's order.
 */
export function rankSeries<T extends RankableSeries>(
  series: T[],
  terms: string[],
  saPreference: SaPreference = "sa",
): T[] {
  const wantSa = saPreference === "sa";
  const saRank = (s: T) => {
    const sa = isSeasonallyAdjusted(s);
    if (sa === undefined) return 1;
    return sa === wantSa ? 0 : 2;
  };
  return series
    .map((s) => ({
      s,
      score: relevanceScore(s, terms),
      total: /\btotal\b/i.test(s.title ?? "") ? 0 : 1,
      sa: saRank(s),
      range: rangeMs(s),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.total - b.total ||
        a.sa - b.sa ||
        b.range - a.range,
    )
    .map((x) => x.s);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
