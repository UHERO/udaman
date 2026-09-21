/**
 * Site-agnostic value parsers for MLS listings — one per MlsColumnKind.
 *
 * Every site adapter funnels its raw strings through these so that
 * "$18,500,000 (FS)", "33,018", "December 31, 2024" and the "--" placeholder
 * mean the same thing no matter which site they came from. All pure.
 */

import type { MlsColumnKind } from "./columns";
import type { ColumnValue, ListingStatus } from "./types";

/** Collapse all whitespace runs (incl. &nbsp;) to one space and trim. */
export function cleanText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/**
 * Decode entities that survive the HTML parser's own decoding. Sites
 * double-encode agent-entered text ("seller&amp;#39;s" in the source, which a
 * browser — and node-html-parser — turns into the literal "seller&#39;s"), so
 * text values get a second pass. Loops because triple-encoding also occurs.
 */
export function decodeResidualEntities(raw: string): string {
  let s = raw;
  for (let pass = 0; pass < 3 && s.includes("&"); pass++) {
    const next = s.replace(
      /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g,
      (whole, dec?: string, hex?: string, name?: string) => {
        if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
        const code = dec ? Number(dec) : parseInt(hex as string, 16);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      },
    );
    if (next === s) break;
    s = next;
  }
  return s;
}

/** The sites' "no value" placeholders: "", "--", "--/--", "--/mo.". */
function isBlank(s: string): boolean {
  return s === "" || /^--(\s*\/\s*(--|mo\.?))?$/i.test(s);
}

/** text: whitespace-collapsed, trimmed; "" and "--" → null. */
export function parseText(raw: string | null | undefined): string | null {
  const s = cleanText(raw);
  return isBlank(s) ? null : s;
}

/** int: "33,018" → 33018; anything that is not wholly a number → null. */
export function parseIntValue(raw: string | null | undefined): number | null {
  const s = cleanText(raw);
  if (!/^-?\d[\d,]*(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s.replace(/,/g, "")));
  return Number.isFinite(n) ? n : null;
}

/**
 * money: leading dollar amount in whole dollars.
 * "$18,500,000 (FS)" → 18500000; "$1,297/mo." → 1297; "$569,900.00" → 569900;
 * "--/mo.", "--", "AVAILABLE" → null.
 */
export function parseMoney(raw: string | null | undefined): number | null {
  const s = cleanText(raw);
  const m = /^\$?\s*(\d[\d,]*(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(/,/g, "")));
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function isoFromParts(y: number, m: number, d: number): string | null {
  if (y < 1800 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > dim[m - 1]) return null;
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/**
 * date: "December 31, 2024", "Friday, September 18, 2026", "September 19th,
 * 2026", "09/18/2026" or "2024-12-31" → "2024-12-31". Built from the parsed
 * parts — never through a JS Date, which would drag the local timezone in.
 * Invalid → null.
 */
export function parseDate(raw: string | null | undefined): string | null {
  const s = cleanText(raw);
  if (!s) return null;

  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return isoFromParts(Number(m[3]), Number(m[1]), Number(m[2]));

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));

  // Optional ordinal suffix on the day: "September 19th, 2026", "March 1st, 2057".
  m =
    /^(?:[A-Za-z]+,\s*)?([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(
      s,
    );
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!month) return null;
    return isoFromParts(Number(m[3]), month, Number(m[2]));
  }
  return null;
}

/** year: "1947" → 1947; "0" or anything outside 1800..2100 → null. */
export function parseYear(raw: string | null | undefined): number | null {
  const s = cleanText(raw);
  if (!/^\d{4}$/.test(s)) return null;
  const y = Number(s);
  return y >= 1800 && y <= 2100 ? y : null;
}

export function normalizeValue(
  kind: MlsColumnKind,
  raw: string | null | undefined,
): ColumnValue {
  switch (kind) {
    case "text":
      return parseText(raw);
    case "int":
      return parseIntValue(raw);
    case "money":
      return parseMoney(raw);
    case "date":
      return parseDate(raw);
    case "year":
      return parseYear(raw);
  }
}

/** "$402,730 (FS)" → "FS"; "$108,000 (LH)" → "LH"; no suffix → null. */
export function parseTenure(
  raw: string | null | undefined,
): "FS" | "LH" | null {
  const m = /\(\s*(FS|LH)\s*\)/i.exec(raw ?? "");
  return m ? (m[1].toUpperCase() as "FS" | "LH") : null;
}

/**
 * "3 - Boat, Driveway, Garage" → { n: 3, rest: "Boat, Driveway, Garage" }.
 * "3" → { n: 3, rest: null }; "Garage, Street" → { n: null, rest: "Garage, Street" };
 * "--" → { n: null, rest: null }.
 */
export function splitLeadingInt(raw: string | null | undefined): {
  n: number | null;
  rest: string | null;
} {
  const s = cleanText(raw);
  const m = /^(\d[\d,]*)(?:\s*-\s*(.*))?$/.exec(s);
  if (m) return { n: parseIntValue(m[1]), rest: parseText(m[2]) };
  return { n: null, rest: parseText(s) };
}

/** Site status text → the shared ListingStatus vocabulary. Case-insensitive. */
export function normalizeStatus(raw: string | null | undefined): ListingStatus {
  switch (cleanText(raw).toLowerCase()) {
    case "active":
      return "active";
    case "active under contract":
      return "active_under_contract";
    case "pending":
      return "pending";
    // hres (and the RESO vocabulary generally) says "Closed".
    case "sold":
    case "closed":
      return "sold";
    default:
      return "unknown";
  }
}
