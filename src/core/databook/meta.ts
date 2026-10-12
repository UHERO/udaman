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

// ─── Units written into labels ──────────────────────────────────────

/** Measure words a label's unit parenthetical may name → display form. */
const UNIT_WORDS: Array<[RegExp, string]> = [
  [/^(number|count)$/, "Number"],
  [/^(percent|%)$/, "Percent"],
  [/^years?$/, "Years"],
  [/^months?$/, "Months"],
  [/^weeks?$/, "Weeks"],
  [/^days?$/, "Days"],
  [/^hours?$/, "Hours"],
  [/^inches$/, "Inches"],
  [/^(feet|ft\.?)$/, "Feet"],
  [/^meters$/, "Meters"],
  [/^(miles)$/, "Miles"],
  [/^(sq\.? ?km\.?|square kilometers)$/, "Sq. Km."],
  [/^(sq\.? ?mi\.?|sq\.? miles|square miles)$/, "Sq. Mi."],
  [/^(sq\.? ?ft\.?|square feet)$/, "Sq. Ft."],
  [/^square meters$/, "Sq. Meters"],
  [/^acres$/, "Acres"],
  [/^acre-ft\.?$/, "Acre-Feet"],
  [/^(gallons|wine gallons)$/, "Gallons"],
  [/^gallons per day$/, "Gallons per Day"],
  [/^barrels$/, "Barrels"],
  [/^cubic feet$/, "Cubic Feet"],
  [/^km3$/, "Cubic Km."],
  [/^kwh$/, "kWh"],
  [/^kw$/, "kW"],
  [/^therms$/, "Therms"],
  [/^btu$/, "Btu"],
  [/^(short tons|u\.?s\.? tons|tons)$/, "Short Tons"],
  [/^metric tons$/, "Metric Tons"],
  [/^(lb\.?|pounds)$/, "Pounds"],
  [/^(kgs?\.?|kilograms)$/, "Kilograms"],
  [/^grams$/, "Grams"],
  [/^kilonewtons$/, "Kilonewtons"],
  [/^(°f|degrees)$/, "Degrees F"],
  [/^(m\.?p\.?h\.?|miles\/hour)$/, "MPH"],
  [/^ppm$/, "PPM"],
  [/^mg\/m3$/, "mg/m3"],
  [/^person-hours$/, "Person-Hours"],
  [/^employees$/, "Employees"],
];

const SCALES: Array<[RegExp, string, string]> = [
  // [pattern, short prefix, long prefix]
  [/^(1,000s?|1,000's|thousands?)$/, "Thous.", "Thousands"],
  [/^(1,000,000|millions?|mil\.?)$/, "Mil.", "Millions"],
  [/^(billions?|bil\.?)$/, "Bil.", "Billions"],
];

function scaleOf(word: string): [string, string] | null {
  for (const [re, short, long] of SCALES)
    if (re.test(word)) return [short, long];
  return null;
}

function unitWord(word: string): string | null {
  for (const [re, name] of UNIT_WORDS) if (re.test(word)) return name;
  return null;
}

function scaled(
  scale: [string, string] | null,
  what: string,
  dollars: boolean,
): UnitGuess {
  if (dollars)
    return scale
      ? { shortLabel: `${scale[0]} $`, longLabel: `${scale[1]} of Dollars` }
      : { shortLabel: "$", longLabel: "Dollars" };
  if (what === "Percent") return { shortLabel: "%", longLabel: "Percent" };
  if (!scale) return { shortLabel: what.slice(0, 20), longLabel: what };
  if (what === "Number") return { shortLabel: scale[0], longLabel: scale[1] };
  const long = `${scale[1]} of ${what}`;
  return { shortLabel: `${scale[0]} ${what}`.slice(0, 20), longLabel: long };
}

/**
 * The unit stated by a parenthetical in a label, e.g. "(dollars)", "($1,000)",
 * "(in thousands)", "(1,000 kwh)", "(millions of dollars)", "(sq. km.)",
 * "(2017=100)", "(dollars/hour)". Null when the parenthetical is not a unit
 * ("(excludes DHHL)", "(Optical/Infrared)").
 */
export function parseUnitText(text: string): UnitGuess | null {
  let s = text.toLowerCase().replace(/\s+/g, " ").trim().replace(/^in /, "");
  if (!s) return null;

  // Index base: "2017=100", "1982-84=100".
  const idx = s.match(/^(\d{4}(?:-\d{2})?)\s*=\s*100$/);
  if (idx)
    return {
      shortLabel: `Index (${idx[1]}=100)`,
      longLabel: `Index (${idx[1]}=100)`,
    };

  // Rates: "$/kwh", "dollars/hour", "per sq. km.".
  const rate = s.match(/^(\$|dollars)\s*\/\s*([a-z]+)$/);
  if (rate) {
    const per = unitWord(rate[2]) ?? rate[2];
    const unit = `$ per ${per.replace(/s$/, "")}`;
    return { shortLabel: `$/${rate[2]}`.slice(0, 20), longLabel: unit };
  }
  const per = s.match(/^per (.+)$/);
  if (per) {
    const w = unitWord(per[1]);
    return w
      ? { shortLabel: `Per ${w}`.slice(0, 20), longLabel: `Per ${w}` }
      : null;
  }

  // Dollars, with an optional scale: "$", "dollars", "$1,000", "$ 1,000",
  // "$1000", "thousands of dollars", "million dollars", "$ millions",
  // "$m.", "$mil.", "million $", "dollars million", "millions of chained
  // 2017 dollars".
  s = s
    .replace(/\$\s*1,?000,?000\b/, "$ million")
    .replace(/\$\s*1,?000\b/, "$ thousand");
  const chained = s.match(/chained (\d{4}) dollars/);
  if (/\$|\bdollars?\b/.test(s)) {
    const rest = s
      .replace(/chained \d{4}/, "")
      .replace(/\$|\bdollars?\b|\bof\b/g, " ")
      .replace(/\bm\.?$/, "million")
      .trim();
    if (rest && !scaleOf(rest)) return null;
    const scale = rest ? scaleOf(rest) : null;
    const u = scaled(scale, "", true);
    if (chained)
      return {
        shortLabel: `${scale ? scale[0] + " " : ""}${chained[1]} $`,
        longLabel: `${scale ? scale[1] + " of " : ""}Chained ${chained[1]} Dollars`,
      };
    return u;
  }

  // "% of total", "percent of total": a share, still percent.
  if (/^(%|percent)( of .+)?$/.test(s))
    return { shortLabel: "%", longLabel: "Percent" };

  // "[scale] [of] unit": "thousands", "1,000s", "1,000 kwh", "million
  // therms", "millions of gallons", "1,000 short tons".
  const words = s.split(" ");
  for (let n = Math.min(2, words.length); n >= 0; n--) {
    const head = words.slice(0, n).join(" ");
    const scale = n ? scaleOf(head) : null;
    if (n && !scale) continue;
    const tail = words.slice(n).join(" ").replace(/^of /, "");
    if (!tail) return scale ? scaled(scale, "Number", false) : null;
    const w = unitWord(tail);
    if (w) return scaled(scale, w, false);
  }
  return null;
}

/** Trailing "(unit)" parenthetical, if it is a unit. */
const PAREN = /\s*\(([^()]*)\)\s*$/;

/** A label's own unit and the label without it. */
export function splitLabelUnit(label: string): {
  text: string;
  unit: UnitGuess | null;
} {
  // "Contract awards ($M) and personnel (number)": two units, no single one.
  const stated = new Set(
    [...label.matchAll(/\(([^()]*)\)/g)]
      .map((m) => parseUnitText(m[1])?.longLabel)
      .filter(Boolean),
  );
  if (stated.size > 1) return { text: label, unit: null };
  const m = label.match(PAREN);
  if (m) {
    const unit = parseUnitText(m[1]);
    // "(% of total)" says what the share is of: keep it in the label.
    if (unit?.longLabel === "Percent" && / of /i.test(m[1]))
      return { text: label, unit };
    if (unit) return { text: label.slice(0, m.index).trim() || label, unit };
  }
  // ", in thousands" / ": dollars" written without parentheses.
  const t = label.match(/[,:]\s*(in [^,:]+)$/i);
  if (t) {
    const unit = parseUnitText(t[1]);
    if (unit) return { text: label.slice(0, t.index).trim(), unit };
  }
  return { text: label, unit: null };
}

/**
 * The unit a measurement's labels state, most specific label first
 * (leaf before parent). `labels` is ordered general → specific.
 */
export function unitFromLabels(labels: string[]): UnitGuess | null {
  for (let i = labels.length - 1; i >= 0; i--) {
    // "Value of contract awards ($M) and personnel (number)": the unit
    // whose subject another label names ("Personnel"), else the first.
    const parts = statedUnits(labels[i]);
    if (parts.length > 1) {
      const others = labels
        .filter((_, j) => j !== i)
        .join(" ")
        .toLowerCase();
      const named = parts.find((p) => p.subject && others.includes(p.subject));
      return (named ?? parts[0]).unit;
    }
    // An item listed under a code ("841112 > Turbojets … (kilonewtons)")
    // describes the item, not the measure.
    if (i > 0 && /^[\d.-]+$/.test(labels[i - 1].trim())) continue;
    const { unit } = splitLabelUnit(labels[i]);
    if (unit) return unit;
  }
  return null;
}

/** Each "subject (unit)" pair in a label, subject = its last word. */
function statedUnits(
  label: string,
): Array<{ subject: string; unit: UnitGuess }> {
  const out: Array<{ subject: string; unit: UnitGuess }> = [];
  for (const m of label.matchAll(/([^()]*)\(([^()]*)\)/g)) {
    const unit = parseUnitText(m[2]);
    if (!unit) continue;
    const words = m[1].toLowerCase().match(/[a-z]+/g) ?? [];
    out.push({ subject: words[words.length - 1] ?? "", unit });
  }
  return out;
}

/** "Hawaii as percent of U.S.", "Percent in Honolulu" — not "50% exemption". */
export function isPercentLabel(label: string): boolean {
  return /\bpercent\b|%/i.test(label.replace(/\d[\d.,]*\s*%/g, ""));
}

/**
 * Guess a unit from the series labels' own unit text ("Average weekly
 * earnings (dollars)", "All occupations (in thousands)"), then the
 * headnote ("[In thousands of dollars …]"), then label words and the cell
 * number format.
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

  if (opts.percent || opts.labels.some(isPercentLabel))
    return { shortLabel: "%", longLabel: "Percent" };
  const own = unitFromLabels(opts.labels);
  if (own) return own;
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
