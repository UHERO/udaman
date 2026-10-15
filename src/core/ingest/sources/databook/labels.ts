/**
 * Label normalization and period parsing shared by both edition adapters.
 *
 * Normalization has to make the same label compare equal across 24 years of
 * formatting drift, e.g.
 *   2002: "Maui                         County 2/"
 *   2024: "Maui\nCounty 2/"
 *   2025: "Maui County [b]"
 * all → "Maui County" with marker "b"/"2".
 */
import type { ParsedPeriod, PeriodBasis } from "./ir";

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
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_RE =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

/** No Data Book table has a period before 1800; a smaller "year" is a value. */
const MIN_YEAR = 1800;
const MAX_YEAR = 2100;

/** Rails-style to_ascii (same transliteration as DownloadProcessor). */
export function toAscii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʻ′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ");
}

// "[a]", "[a and b]", "[a, b]", "[1]" — 2025 style.
const BRACKET_MARKER =
  /\s*\[([a-z0-9]{1,2}(?:\s*(?:,|and|&)\s*[a-z0-9]{1,2})*)\]/gi;
// "1/", "2/ 3/" — legacy style; must stand alone (not "1/2").
const SLASH_MARKER = /(^|\s)(\d{1,2})\/(?=\s|$|,|\))/g;

export interface NormalizedLabel {
  text: string;
  markers: string[];
}

/**
 * Normalize a header/row label: ASCII, footnote markers stripped (and
 * returned), line-break hyphenation joined, whitespace collapsed.
 */
export function normalizeLabel(raw: unknown): NormalizedLabel {
  if (raw == null) return { text: "", markers: [] };
  let s = toAscii(String(raw));
  const markers: string[] = [];
  s = s.replace(BRACKET_MARKER, (_, inner: string) => {
    for (const m of inner.split(/\s*(?:,|and|&)\s*/i)) {
      if (m) markers.push(m.toLowerCase());
    }
    return " ";
  });
  s = s.replace(SLASH_MARKER, (_, pre: string, n: string) => {
    markers.push(n);
    return pre;
  });
  s = s
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2") // "employ-\nment" → "employment"
    .replace(/\s+/g, " ")
    .replace(/\s+([,:;.)])/g, "$1")
    .trim()
    .replace(/[:,;]$/, "")
    .trim();
  return { text: s, markers };
}

/** Key form of a label for equality matching: lowercase, punctuation-light. */
export function labelKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'"`]/g, "")
    .replace(/[^a-z0-9%$]+/g, " ")
    .trim();
}

function yearOk(y: number): boolean {
  return Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR;
}

function expandYear(y1: number, part: string): number {
  if (part.length === 4) return Number(part);
  // "2018-19" → 2019; "1999-00" → 2000
  const century = Math.floor(y1 / 100) * 100;
  let y2 = century + Number(part);
  if (y2 <= y1) y2 += 100;
  return y2;
}

function annual(year: number): string {
  return `${year}-01-01`;
}

/**
 * Context that disambiguates spans like "2019-2020" (fiscal? school? ACS
 * window?). Pass table title + headnote + the column/row header text.
 */
export interface PeriodContext {
  text?: string;
}

function spanBasis(span: number, ctx?: PeriodContext): PeriodBasis {
  const t = (ctx?.text ?? "").toLowerCase();
  if (span === 1) {
    if (/fiscal/.test(t)) return "fiscal";
    if (/school|academic|enrollment|graduat/.test(t)) return "school";
    if (/crop|season/.test(t)) return "span1";
    return "span1";
  }
  if (
    span === 4 &&
    /american community survey|\bacs\b|5-year|five-year/.test(t)
  )
    return "acs5";
  return "interval";
}

/**
 * Parse a period label (row label in long tables, header in wide tables,
 * title period in snapshots). Footnote markers must already be stripped or
 * are stripped here.
 */
export function parsePeriod(raw: unknown, ctx?: PeriodContext): ParsedPeriod {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime()))
      return { label: "", year: null, date: null, basis: "unknown" };
    const y = raw.getUTCFullYear();
    return {
      label: raw.toISOString().slice(0, 10),
      year: y,
      date: annual(y),
      basis: "point",
      point: raw.toISOString().slice(5, 10),
    };
  }
  if (typeof raw === "number") {
    if (yearOk(raw))
      return {
        label: String(raw),
        year: raw,
        date: annual(raw),
        basis: "calendar",
      };
    return { label: String(raw), year: null, date: null, basis: "unknown" };
  }

  const label = normalizeLabel(raw).text;
  const s = label.trim();
  const unknown: ParsedPeriod = {
    label: s,
    year: null,
    date: null,
    basis: "unknown",
  };
  if (!s) return unknown;
  let m: RegExpMatchArray | null;

  // 2019
  if ((m = s.match(/^(\d{4})$/)) && yearOk(+m[1]))
    return { label: s, year: +m[1], date: annual(+m[1]), basis: "calendar" };

  // FY 2019, Fiscal year 2019, FY2019
  if ((m = s.match(/^(?:fy|fiscal\s+year)\s*(\d{4})$/i)) && yearOk(+m[1]))
    return { label: s, year: +m[1], date: annual(+m[1]), basis: "fiscal" };

  // FY 2018-19
  if (
    (m = s.match(/^(?:fy|fiscal\s+year)\s*(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/i))
  ) {
    const y2 = expandYear(+m[1], m[2]);
    if (yearOk(y2))
      return { label: s, year: y2, date: annual(y2), basis: "fiscal" };
  }

  // 2018-2019, 2018/19, 1990 - 2000, 1959-1961
  if (
    (m = s.match(/^(\d{4})\s*(?:-|\/|to)\s*(\d{2}|\d{4})$/i)) &&
    yearOk(+m[1])
  ) {
    const y1 = +m[1];
    const y2 = expandYear(y1, m[2]);
    const basis = spaced(s) ? "interval" : spanBasis(y2 - y1, ctx);
    if (basis === "interval")
      return { label: s, year: null, date: null, basis };
    return { label: s, year: y2, date: annual(y2), basis };
  }

  // 2010: April 1 / 1996: Nov. 5 / 1980: (split-date legacy, point in next col)
  // Only month/day text after the colon is a point; "2013: Wealthholders
  // above $5.0 million" is a year + dimension (left to splitPeriod).
  if (
    (m = s.match(/^(\d{4})\s*:\s*(.*)$/)) &&
    yearOk(+m[1]) &&
    (!m[2] || new RegExp(`^${MONTH_RE}\\s*\\d{0,2}$`, "i").test(m[2].trim()))
  )
    return {
      label: s,
      year: +m[1],
      date: annual(+m[1]),
      basis: m[2] ? "point" : "calendar",
      ...(m[2] ? { point: m[2].trim() } : {}),
    };

  // April 1, 2020 / Dec. 31, 2010 / July 2019 / March 31, 2026
  const md = new RegExp(`^(${MONTH_RE})\\s*(\\d{1,2})?,?\\s+(\\d{4})$`, "i");
  if ((m = s.match(md)) && yearOk(+m[3]))
    return {
      label: s,
      year: +m[3],
      date: annual(+m[3]),
      basis: "point",
      point: `${m[1]}${m[2] ? " " + m[2] : ""}`.trim(),
    };

  // Fall 2019, Spring 2020, As of June 30, 2019, Calendar year 2019
  if (
    (m = s.match(
      /^(?:as of\s+)?(?:fall|spring|summer|winter|calendar year|year|cy)\s+(\d{4})$/i,
    )) &&
    yearOk(+m[1])
  )
    return {
      label: s,
      year: +m[1],
      date: annual(+m[1]),
      basis: /calendar|year|cy/i.test(s) ? "calendar" : "point",
      point: s.replace(/\s*\d{4}$/, ""),
    };
  if (
    (m = s.match(
      new RegExp(`^as of\\s+(${MONTH_RE})\\s*(\\d{1,2})?,?\\s+(\\d{4})$`, "i"),
    )) &&
    yearOk(+m[3])
  )
    return {
      label: s,
      year: +m[3],
      date: annual(+m[3]),
      basis: "point",
      point: s.replace(/,?\s*\d{4}$/, ""),
    };

  return unknown;
}

/** "1990 - 2000" (spaced dash) is how the Data Book writes growth intervals. */
function spaced(s: string): boolean {
  return /\d\s+-\s+\d/.test(s);
}

const PERIOD_TOKEN = new RegExp(
  [
    `(?:as of\\s+)?${MONTH_RE}\\s*\\d{0,2},?\\s+\\d{4}`, // April 1, 2020
    `(?:fy|fiscal year)\\s*\\d{4}(?:\\s*[-/]\\s*\\d{2,4})?`, // FY 2019-20
    `\\d{4}\\s*[-/]\\s*\\d{2,4}`, // 2019-2020
    `\\d{4}:\\s*${MONTH_RE}\\s*\\d{0,2}`, // 2010: April 1
    `(?:fall|spring)\\s+\\d{4}`,
    `\\d{4}`,
  ].join("|"),
  "gi",
);

export interface SplitPeriod {
  period: ParsedPeriod;
  /** The label with the period token removed — the measure/dimension part. */
  residue: string;
}

/**
 * Pull exactly one period token out of a composite header such as
 * "Real SPI per capita 2018", "April 1, 2020, Both sexes", "2022 state and
 * local", "Jobs in 2017". Returns null when there is no year token or more
 * than one distinct token (ambiguous — leave to an override).
 */
export function splitPeriod(
  raw: unknown,
  ctx?: PeriodContext,
): SplitPeriod | null {
  const whole = parsePeriod(raw, ctx);
  if (whole.basis !== "unknown") return { period: whole, residue: "" };
  const text = normalizeLabel(raw).text;
  const tokens = [...text.matchAll(PERIOD_TOKEN)]
    .map((t) => t[0])
    .filter((t) => {
      const y = t.match(/\d{4}/);
      return y != null && yearOk(+y[0]);
    });
  if (tokens.length !== 1) return null;
  const period = parsePeriod(tokens[0], ctx);
  if (period.basis === "unknown") return null;
  const residue = text
    .replace(tokens[0], " ")
    .replace(/\b(in|for|as of)\s*$/i, "")
    .replace(/^\s*[,:;-]+|[,:;-]+\s*$/g, "")
    .replace(/\s*,\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,:;-]\s*|\s*[,:;-]$/g, "")
    .trim();
  return { period, residue };
}

export interface ParsedTitle {
  /** "01.06" zero-padded, or null if the text isn't a table title. */
  tableNum: string | null;
  title: string;
  period: string;
}

/** "Table 1.06-- RESIDENT POPULATION, BY COUNTY:  2010 TO 2025" */
export function parseTitle(raw: unknown): ParsedTitle {
  const s = toAscii(String(raw ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  const m = s.match(/^Table\s+(\d{1,2})\.(\d{1,3})\s*-+\s*(.*)$/i);
  if (!m) return { tableNum: null, title: s, period: "" };
  const num = `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}`;
  const rest = m[3].trim();
  // Period is after the LAST ":" when it contains a year.
  const idx = rest.lastIndexOf(":");
  if (idx >= 0 && /\d{4}/.test(rest.slice(idx + 1))) {
    return {
      tableNum: num,
      title: rest.slice(0, idx).trim(),
      period: rest.slice(idx + 1).trim(),
    };
  }
  return { tableNum: num, title: rest, period: "" };
}

/**
 * The single period a snapshot table's title names ("2025", "MARCH 31,
 * 2026", "2020-2024", "2025-2026"), or null if the title names a range of
 * periods ("2010 TO 2025", "2020 AND 2025").
 */
export function snapshotPeriod(
  titlePeriod: string,
  ctx?: PeriodContext,
): ParsedPeriod | null {
  if (
    !titlePeriod ||
    /\bto\b|\band\b|,\s*\d{4}\s*,/i.test(
      titlePeriod.replace(/^\w+\s+\d{1,2},\s*\d{4}$/, ""),
    )
  )
    return null;
  const p = parsePeriod(titlePeriod, ctx);
  return p.basis === "unknown" || p.basis === "interval" ? null : p;
}

/** First `<https://…>` (or bare https URL) in a source note. */
export function extractUrl(source: string): string | null {
  const m =
    source.match(/<\s*(https?:\/\/[^>\s]+)\s*>/i) ??
    source.match(/(https?:\/\/[^\s>)]+)/i);
  return m ? m[1].replace(/[.,;]+$/, "") : null;
}

export { MONTHS };
