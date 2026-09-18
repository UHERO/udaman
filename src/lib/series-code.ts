/**
 * UHERO code parsing and helpers:
 *   - parseSeriesCode(input)        : parses NAME@GEO.FREQ strings into
 *                                     structured parts; null on malformed input
 *   - formatSeriesCode(name, geo, freq) : inverse of the above
 *   - clampObservations(obs, start, end)
 *                                   : date-range filter that handles YYYY,
 *                                     YYYY-MM, and YYYY-MM-DD inputs
 *   - describeDisambiguation(matches)
 *                                   : user-facing hints when a search returns
 *                                     multiple matches differing by geo / freq
 *   - defaultDateRange(freq), defaultLookbackYears(freq)
 *                                   : legacy lookback defaults; no longer used
 *                                     by the MCP tools (which default to the
 *                                     series's full published range) but kept
 *                                     for any other consumers.
 */

import "server-only";

import type { Frequency } from "@/lib/uhero-client";

const SERIES_CODE_RE = /^([A-Z][A-Z0-9_]*)@([A-Z0-9]+)\.([AQMWD])$/i;

export interface ParsedSeriesCode {
  name: string;
  geo: string;
  freq: Frequency;
}

export function parseSeriesCode(input: string): ParsedSeriesCode | null {
  const trimmed = input.trim();
  const m = trimmed.match(SERIES_CODE_RE);
  if (!m) return null;
  return {
    name: m[1].toUpperCase(),
    geo: m[2].toUpperCase(),
    freq: m[3].toUpperCase() as Frequency,
  };
}

export function formatSeriesCode(
  name: string,
  geo: string,
  freq: Frequency,
): string {
  return `${name}@${geo}.${freq}`;
}

export function defaultLookbackYears(freq: Frequency): number {
  switch (freq) {
    case "A":
      return 20;
    case "Q":
      return 10;
    case "M":
    case "W":
    case "D":
    default:
      return 5;
  }
}

export function defaultDateRange(freq: Frequency): {
  start: string;
  end: string;
} {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - defaultLookbackYears(freq));
  return { start: toYearMonth(start), end: toYearMonth(end) };
}

export function toYearMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function clampObservations<T extends { date: string }>(
  observations: T[],
  start: string | undefined,
  end: string | undefined,
): T[] {
  if (!start && !end) return observations;
  const startKey = start ? normalizeDateKey(start) : null;
  const endKey = end ? normalizeDateKey(end) : null;
  return observations.filter((o) => {
    const key = normalizeDateKey(o.date);
    if (startKey && key < startKey) return false;
    if (endKey && key > endKey) return false;
    return true;
  });
}

function normalizeDateKey(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}$/.test(input)) return `${input}-01-01`;
  return input;
}

export function describeDisambiguation(
  matches: Array<{ geography?: { handle: string }; frequencyShort: string }>,
): string | undefined {
  if (matches.length <= 1) return undefined;
  const geoArr = uniq(
    matches.map((m) => m.geography?.handle).filter((g): g is string => !!g),
  );
  const freqArr = uniq(matches.map((m) => m.frequencyShort));
  if (geoArr.length > 1 && freqArr.length <= 1) {
    return `matches differ by geography (${geoArr.join(", ")})`;
  }
  if (freqArr.length > 1 && geoArr.length <= 1) {
    return `matches differ by frequency (${freqArr.join(", ")})`;
  }
  if (geoArr.length > 1 && freqArr.length > 1) {
    return `matches differ by geography (${geoArr.join(", ")}) and frequency (${freqArr.join(", ")})`;
  }
  return undefined;
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
