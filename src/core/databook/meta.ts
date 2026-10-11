/**
 * Metadata inference for Data Book series: units, percent/decimals, source
 * agency, period-basis notes, and display-name casing.
 */
import type { IRCell, PeriodBasis } from "./ir";

export interface UnitGuess {
  shortLabel: string;
  longLabel: string;
}

const SCALE_WORDS: Record<string, string> = {
  thousands: "Thous.",
  millions: "Mil.",
  billions: "Bil.",
};

/** Title-case an ALL CAPS Data Book title, keeping short words lowercase. */
export function titleCase(s: string): string {
  const small = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "per",
    "the",
    "to",
    "with",
  ]);
  const keepUpper =
    /^(U\.?S\.?|NAICS|SIC|GDP|CPI|ACS|DBEDT|UH|HMSA|HUD|FY|II|III|IV|TV|AIDS|HIV|ARCH|OASDI|SNAP|TANF|WIC|PCE|SPI|RPP|GE|CEO)$/;
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w, i) => {
      if (!w.trim() || w === "-" || w === "/") return w;
      const bare = w.replace(/[^a-z.]/gi, "");
      if (keepUpper.test(bare.toUpperCase())) return w.toUpperCase();
      if (i > 0 && small.has(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join("");
}

/** Strip trailing "BY COUNTY", "FOR HAWAII AND THE UNITED STATES" style clauses. */
export function baseTitle(title: string): string {
  return title
    .replace(/,?\s+(BY|FOR)\s+[^,]*$/i, "")
    .replace(/,\s*$/, "")
    .trim();
}

/** Decimal places implied by an Excel number format ("#,##0.0" → 1). */
export function formatDecimals(numFmt: string | undefined): number | null {
  if (!numFmt || numFmt === "General") return null;
  const m = numFmt.split(";")[0].match(/0\.(0+)/);
  return m ? m[1].length : 0;
}

export function isPercentFormat(numFmt: string | undefined): boolean {
  return !!numFmt && /%/.test(numFmt.split(";")[0].replace(/"[^"]*"/g, ""));
}

/**
 * A numeric cell under a % format holds the fraction (0.17 displays as
 * "17%"). Percent series are stored in percent units (17), as in Rails and
 * the data portal, which show the value as-is and take YOY as a difference.
 * Rounded to 10 places to drop float noise (0.17 * 100 = 17.000000000000004).
 */
export function toPercentUnits(value: number, numFmt?: string): number {
  if (!isPercentFormat(numFmt)) return value;
  return Math.round(value * 100 * 1e10) / 1e10;
}

/**
 * Guess a unit from the headnote ("[In thousands of dollars …]"), the
 * series labels, and the cell number format.
 */
export function inferUnit(opts: {
  headnote: string;
  labels: string[];
  numFmt?: string;
  percent: boolean;
}): UnitGuess {
  const head = opts.headnote.toLowerCase();
  const labels = opts.labels.join(" ").toLowerCase();
  const fmt = opts.numFmt ?? "";

  if (
    opts.percent ||
    /\bin percent\b/.test(head) ||
    /\bpercent\b|%/.test(labels)
  )
    return { shortLabel: "%", longLabel: "Percent" };

  // Only a sentence that STARTS with "In …" states the unit ("[In
  // thousands of dollars.", "[In acres.  …"); "… homeported in Hawaii and
  // residents …" mid-sentence is not a unit.
  const inMatch = head.match(
    /(?:^|\[|[.;]\s+)in (thousands|millions|billions)?\s*(?:of )?([a-z][a-z -]*?)\s*(?:[.;,\]]|\bexcept\b|\bunless\b|\bfor\b|\bas of\b|$)/,
  );
  if (
    inMatch &&
    inMatch[2] &&
    inMatch[2].trim().split(/\s+/).length <= 4 &&
    !/^(the|this|which|order|descending|ascending|each|addition|calendar|fiscal|an?|current|constant|hawaii|percent of|rank)\b/.test(
      inMatch[2].trim(),
    )
  ) {
    const scale = inMatch[1];
    const what = inMatch[2].trim();
    if (/dollar/.test(what))
      return scale
        ? {
            shortLabel: `${SCALE_WORDS[scale]} $`,
            longLabel: `${cap(scale)} of Dollars`,
          }
        : { shortLabel: "$", longLabel: "Dollars" };
    if (what.length <= 40) {
      const long = `${scale ? cap(scale) + " of " : ""}${titleCase(what)}`;
      return { shortLabel: long.slice(0, 20), longLabel: long };
    }
  }

  if (/"?\$"?/.test(fmt) || /\bdollars?\b|\(\$\)|\$/.test(labels))
    return { shortLabel: "$", longLabel: "Dollars" };
  if (/per 1,000|per 1000|rate per/.test(labels + " " + head))
    return { shortLabel: "Rate", longLabel: "Rate" };
  if (/\bindex\b/.test(labels))
    return { shortLabel: "Index", longLabel: "Index" };
  if (/\(years\)|median age|life expectancy|\byears of age\b/.test(labels))
    return { shortLabel: "Years", longLabel: "Years" };
  if (/\bacres?\b/.test(labels + " " + head))
    return { shortLabel: "Acres", longLabel: "Acres" };
  return { shortLabel: "Number", longLabel: "Number" };
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Agency phrase for the `sources` table: the leading clause of the Source
 * note ("U.S. Census Bureau", "Hawaii State Department of Health").
 */
export function sourceAgency(source: string): string {
  let s = source
    .replace(/^\s*sources?:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^(compiled|calculated|prepared|estimated) (by|from) (the )?/i, "")
    .trim();
  // DBEDT's own name contains commas; keep it whole.
  const dbedt = s.match(
    /^(?:the )?(hawaii )?(state )?department of business,? economic development,? (?:&|and) tourism/i,
  );
  if (dbedt)
    return "Hawaii State Department of Business, Economic Development & Tourism";
  if (/^["\u201c]/.test(s)) {
    // Starts with a publication title: use the title.
    const t = s.match(/^["\u201c]([^"\u201d]+)/);
    s = t ? t[1] : s.slice(1);
  }
  const cut = s.search(/,|;|\s"|\s<|\s\(| records\b| data\b| based on\b/);
  const head = (cut > 0 ? s.slice(0, cut) : s).trim().replace(/[.,:]$/, "");
  if (!head || head.split(" ").length > 14) return "DBEDT Data Book";
  if (/^(u\.?s\.? )?bureau of the census$/i.test(head))
    return "U.S. Census Bureau";
  return head.slice(0, 120);
}

/** Description note for non-calendar period bases (decision 3 in the plan). */
export function basisNote(cells: IRCell[]): string | null {
  const counts = new Map<PeriodBasis, number>();
  const points = new Map<string, number>();
  for (const c of cells) {
    counts.set(c.period.basis, (counts.get(c.period.basis) ?? 0) + 1);
    if (c.period.point)
      points.set(c.period.point, (points.get(c.period.point) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  switch (top) {
    case "fiscal":
      return "Fiscal Year (dated by year ending)";
    case "school":
      return "School Year (dated by year ending)";
    case "span1":
      return "Twelve-month period spanning two calendar years (dated by year ending)";
    case "acs5":
      return "5-year American Community Survey estimate (dated by final year)";
    case "point": {
      const p = [...points.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return p ? `As of ${p}` : null;
    }
    default:
      return null;
  }
}
