/**
 * DOTAX monthly report parsers — a 1:1 port of rprocess dotax_parse.R.
 *
 * One parser per report type, each reading one file (one month) into long
 * rows:
 *   section  table / block (collections, distribution, base, liability, …)
 *   sub      sub-block where labels repeat (corp / ind income), or ""
 *   label    row label as printed (footnote markers removed)
 *   item     canonical item from config/labels (first matching regex wins)
 *   geo      HI (statewide) or HON / MAU / HAW / KAU; UNK for the
 *            "unknown district" column of the liability reports
 *   value    number (dollars; gallons for fuel quantities), or null for a
 *            printed row whose cell is blank
 * Only current-month values are kept. Column roles always come from header
 * TEXT, never fixed positions, and the month printed in the header must
 * equal the file's month (which also picks the right sheet in workbooks
 * that hold several months). Problems are collected, never thrown, so one
 * run shows every problem at once.
 *
 * Indexes are 0-based; problem messages print 1-based rows like the R.
 */

import { knownIssues, labelRules } from "./config";
import { readMatrix, sheetNames, squish } from "./parse-matrix";
import type { Matrix } from "./parse-matrix";

export const GEO_CODES = ["HON", "MAU", "HAW", "KAU"] as const;
const MON_ABB = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export type ReportType =
  "collec" | "ge" | "liab_ge" | "liab_tat" | "fuels" | "liqtob" | "liq" | "tob";

export type ParsedRow = {
  type: ReportType;
  /** YYYY-MM */
  month: string;
  file: string;
  section: string;
  sub: string;
  label: string;
  item: string;
  geo: string;
  value: number | null;
  /** 1-based sheet row */
  row: number;
};

export type Problem = {
  type: string;
  /** YYYY-MM */
  month: string;
  check: string;
  detail: string;
  file: string;
};

export class Problems {
  list: Problem[] = [];
  add(type: string, month: string, check: string, detail: string, file = "") {
    this.list.push({ type, month, check, detail, file });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/** R's a:b (descending when a > b). */
function rseq(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** as.numeric(str_remove_all(x, "[,$\\s]")) — null for NA. */
export function dotaxNum(x: string | undefined): number | null {
  const s = (x ?? "").replace(/[,$\s]/g, "");
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Month printed in a header cell ("MAR 2020*", "OCTOBER 2019") → YYYY-MM. */
export function headerMonth(x: string | undefined): string | null {
  const m = squish(x ?? "")
    .toUpperCase()
    .match(
      /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s*(\d{4})\s*\**$/,
    );
  if (!m) return null;
  return `${m[2]}-${String(MON_ABB.indexOf(m[1]) + 1).padStart(2, "0")}`;
}

/** Sheets named for the month when there are any, otherwise all of them. */
function monthSheets(path: string, month: string): string[] {
  const sheets = sheetNames(path);
  const [yr, mo] = month.split("-");
  const mon = MON_ABB[Number(mo) - 1];
  const full = MONTH_NAMES[Number(mo) - 1];
  const want = new Set([mon, full, mon + yr, full + yr, mon + yr.slice(2, 4)]);
  const hits = sheets.filter((s) =>
    want.has(s.replace(/[\s._-]/g, "").toUpperCase()),
  );
  return hits.length ? hits : sheets;
}

/** Strip footnote markers ("Fuel 6/", "TOTAL 1/, 7/", "Tobacco ***"). */
export function cleanLabel(x: string): string {
  return squish(
    x
      .replace(/’/g, "'")
      .replace(/(?<=[A-Za-z.:)%])[\s,/\d*]*$/, "")
      .replace(/^[\s*]+/, ""),
  );
}

export function slug(x: string): string {
  return x
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const itemCache = new Map<string, string | null>();

/**
 * Canonical item for a label; "*" rule items become a slug of the label;
 * null when no rule matches (an unknown label).
 */
export function matchItem(
  label: string,
  ruleType: string,
  section: string,
  sub: string = "",
): string | null {
  const cacheKey = `${ruleType}\r${section}\r${sub}\r${label}`;
  if (itemCache.has(cacheKey)) return itemCache.get(cacheKey)!;
  const subs = sub ? [sub, "*"] : ["*"];
  let out: string | null = null;
  for (const r of labelRules()) {
    if (r.type !== ruleType) continue;
    if (r.section !== section && r.section !== "*") continue;
    if (!subs.includes(r.sub)) continue;
    if (r.pattern.test(label)) {
      out = r.item === "*" ? slug(label) : r.item;
      break;
    }
  }
  itemCache.set(cacheKey, out);
  return out;
}

/** Cells matching rx (case-insensitive), sorted by row then column. */
function findCells(m: Matrix, rx: string): Array<[number, number]> {
  const re = new RegExp(rx, "i");
  const out: Array<[number, number]> = [];
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (re.test(m[r][c])) out.push([r, c]);
    }
  }
  return out;
}

function ncol(m: Matrix): number {
  return m[0]?.length ?? 0;
}

export function accepted(type: string, month: string, check: string): boolean {
  return knownIssues().some(
    (k) =>
      k.type === type &&
      k.month === month &&
      k.check === check &&
      k.action === "accept",
  );
}

type SheetResult = {
  rows: Omit<ParsedRow, "type" | "month" | "file">[];
  headerMonth: string | null;
};

/**
 * Run parseSheet on each candidate sheet and keep the result whose header
 * month equals `month`; records a problem when none does.
 */
function parseBySheet(
  path: string,
  month: string,
  type: ReportType,
  problems: Problems,
  parseSheet: (m: Matrix, sheet: string) => SheetResult | null,
): SheetResult["rows"] | null {
  let sheets: string[];
  try {
    sheets = monthSheets(path, month);
  } catch {
    problems.add(type, month, "unreadable", "the file cannot be opened", path);
    return null;
  }
  const seen: string[] = [];
  for (const s of sheets) {
    let m: Matrix;
    try {
      m = readMatrix(path, s);
    } catch {
      continue;
    }
    if (m.length < 5 || ncol(m) < 3) continue;
    const res = parseSheet(m, s);
    if (!res) continue;
    seen.push(`${s}: ${res.headerMonth ?? "NA"}`);
    if (res.headerMonth === month) {
      if (res.rows.length === 0) {
        problems.add(
          type,
          month,
          "no_data",
          `sheet ${s} has the month header but no values`,
          path,
        );
      }
      return res.rows;
    }
  }
  problems.add(
    type,
    month,
    "header_month",
    `no sheet with a ${month} header (sheets/header months seen: ${seen.length ? seen.join("; ") : "none parsed"})`,
    path,
  );
  return null;
}

/** Rows that carry numbers in the value columns but have no label. */
function checkBlankLabels(
  m: Matrix,
  rows: number[],
  labCol: number,
  cols: number[],
  type: ReportType,
  month: string,
  path: string,
  problems: Problems,
) {
  for (const r of rows) {
    if (!m[r] || m[r][labCol] !== "") continue;
    const v = cols.map((c) => dotaxNum(m[r][c]));
    if (v.some((x) => x !== null && x !== 0)) {
      problems.add(
        type,
        month,
        "blank_label",
        `row ${r + 1} has values but no label: ${cols.map((c) => m[r][c]).join(" | ")}`,
        path,
      );
    }
  }
}

// ─── COLLEC: State Tax Collections and Distribution ─────────────────

/*
 * Layout: label column holding "SOURCE OF REVENUE"; header row has the
 * month-year of the statewide current month (first month-year cell) and,
 * through 2017-12, FIRST..FOURTH DISTRICT columns (row above + "DISTRICT").
 * Sections in order: collections (with Income-Corp. / Income-Ind. sub
 * blocks), the TOTAL - <month> rows (current, then prior year),
 * DISTRIBUTION OF COLLECTIONS ... SUB-TOTAL, county surcharges, (other)
 * county revenue, final TOTAL. Some work files repeat the table side by
 * side; only the block up to the next SOURCE OF REVENUE is read.
 */
function parseCollec(path: string, month: string, problems: Problems) {
  const distMap: Record<string, string> = {
    FIRST: "HON",
    SECOND: "MAU",
    THIRD: "HAW",
    FOURTH: "KAU",
  };
  const incComp = /^(Decl(\.|aration)? ?(of )?Est|Payment W\/|WH Tax|Refunds)/i;

  return parseBySheet(path, month, "collec", problems, (m) => {
    const hits = findCells(m, "^SOURCE OF REVENUE$");
    if (hits.length === 0 || hits[0][0] < 1) return null;
    const [hr, lc] = hits[0];
    const other = hits.filter(([r, c]) => r === hr && c > lc).map(([, c]) => c);
    const lastCol = other.length ? Math.min(...other) - 1 : ncol(m) - 1;
    const cols = rseq(lc + 1, lastCol);
    const h1 = m[hr - 1];
    const h2 = m[hr];
    const role: (string | null)[] = new Array(ncol(m)).fill(null);
    for (const j of cols) {
      const k = (h1[j] ?? "")
        .toUpperCase()
        .match(/^(FIRST|SECOND|THIRD|FOURTH)/);
      if (k && (h2[j] ?? "").toUpperCase().includes("DISTRICT")) {
        role[j] = distMap[k[1]];
      }
    }
    const mcols = cols.filter((j) => headerMonth(h2[j]) !== null);
    if (mcols.length === 0) return null;
    role[mcols[0]] = "HI";
    const vcols = role.flatMap((r, j) => (r ? [j] : []));

    let sec = "collections";
    let sub = "";
    let nTot = 0;
    const out: SheetResult["rows"] = [];
    let lastRow = m.length - 1;
    for (let i = hr + 1; i < m.length; i++) {
      const lab = cleanLabel(m[i][lc]);
      if (lab === "") continue;
      // footnotes / notes end the table
      if (sec === "done") break;
      if (/^(\d+\/|NOTE:|TAX RESEARCH|Monthly \d)/.test(lab)) {
        lastRow = i - 1;
        break;
      }
      let thisSec = sec;
      if (/^Income-Corp/i.test(lab)) sub = "corp";
      else if (/^Income-Ind/i.test(lab)) sub = "ind";
      else if (sec === "collections" && !incComp.test(lab)) sub = "";
      if (
        (sec === "collections" || sec === "coll_total") &&
        /^TOTAL\b/i.test(lab)
      ) {
        // TOTAL - <month> rows: first is the current month, second the
        // prior year (labels can carry stale years, so go by position)
        sec = "coll_total";
        sub = "";
        nTot++;
        thisSec = nTot === 1 ? "coll_total" : "coll_total_prior";
      } else if (sec === "coll_total") {
        thisSec = "coll_change";
      }
      if (/^DISTRIBUTION OF COLLECTIONS/i.test(lab)) {
        sec = "distribution";
        thisSec = sec;
      } else if (sec === "distribution" && /^SUB-?TOTAL/i.test(lab)) {
        thisSec = "distribution";
        sec = "post_subtotal";
      } else if (
        sec === "post_subtotal" ||
        sec === "county_surcharge" ||
        sec === "county_revenue"
      ) {
        if (/COUNTY SURCHARGE/i.test(lab) && /^[A-Z ]+$/.test(lab)) {
          sec = "county_surcharge";
        } else if (
          /^\(?(OTHER\)? )?COUNTY REVENUE/.test(lab) &&
          !/TOTAL/.test(lab)
        ) {
          sec = "county_revenue";
        } else if (/^TOTAL$/i.test(lab)) {
          sec = "done";
          thisSec = "grand_total";
          lastRow = i;
        }
        if (thisSec !== "grand_total") thisSec = sec;
      }
      if (thisSec === "coll_total_prior") continue;
      const item =
        thisSec === "coll_total"
          ? "total"
          : matchItem(lab, "collec", thisSec, sub);
      const vals = vcols.map((c) => dotaxNum(m[i][c]));
      if (item === null) {
        if (vals.some((v) => v !== null)) {
          problems.add(
            "collec",
            month,
            "unknown_label",
            `[${thisSec}${sub ? `/${sub}` : ""}] ${lab}`,
            path,
          );
        }
        continue;
      }
      if (item === "ignore") continue;
      vcols.forEach((c, k) =>
        out.push({
          section: thisSec,
          sub,
          label: lab,
          item,
          geo: role[c]!,
          value: vals[k],
          row: i + 1,
        }),
      );
    }
    checkBlankLabels(
      m,
      lastRow >= hr + 1 ? rseq(hr + 1, lastRow) : [],
      lc,
      vcols,
      "collec",
      month,
      path,
      problems,
    );
    return { rows: out, headerMonth: headerMonth(h2[mcols[0]]) };
  });
}

// ─── GE / LIAB_GE / LIAB_TAT: by business activity ──────────────────

/*
 * Layout: one or more blocks, each starting at a header row containing ALL
 * DISTRICTS; the block's type (collections / base / liability) comes from
 * the title rows above it. District columns are named OAHU / MAUI / HAWAII
 * / KAUAI (plus UNKNOWN DISTRICT in the liability reports); the statewide
 * current month is the column whose month-year header (on the header row
 * or the row below) equals the file month. SUB-TOTAL rows are numbered by
 * order within a block. The first occurrence of an item in a block wins.
 */
function parseActivity(
  path: string,
  month: string,
  type: "ge" | "liab_ge" | "liab_tat",
  problems: Problems,
) {
  const labelType = type === "liab_tat" ? "liab_tat" : "ge";
  return parseBySheet(path, month, type, problems, (m) => {
    const rowtxt = m.map((r) => r.join(" | ").toUpperCase());
    const hdrRows = rowtxt.flatMap((t, i) =>
      t.includes("ALL DISTRICTS") ? [i] : [],
    );
    if (hdrRows.length === 0) return null;
    let labCol = -1;
    for (let c = 0; c < ncol(m) && labCol < 0; c++) {
      if (m.some((r) => /^(Retailing|Transient Acc)/i.test(r[c]))) labCol = c;
    }
    if (labCol < 0) return null;
    const out: SheetResult["rows"] = [];
    let hMonth: string | null = null;
    hdrRows.forEach((h, k) => {
      const end = k < hdrRows.length - 1 ? hdrRows[k + 1] - 1 : m.length - 1;
      const lo = Math.max(0, h - 6, k > 0 ? hdrRows[k - 1] + 2 : 0);
      const title = rseq(lo, h - 1)
        .filter((i) => i >= 0)
        .map((i) => rowtxt[i])
        .join(" ");
      const section = /\bBASE\b/.test(title)
        ? "base"
        : /LIABILIT/.test(title)
          ? "liability"
          : /COLLECTION/.test(title)
            ? "collections"
            : k === 0
              ? "collections"
              : null;
      if (!section) {
        problems.add(
          type,
          month,
          "section",
          `untyped block at row ${h + 1}: ${title}`,
          path,
        );
        return;
      }
      const geo: (string | null)[] = new Array(ncol(m)).fill(null);
      m[h].forEach((v, j) => {
        const up = v.toUpperCase();
        if (/^OAHU/.test(up)) geo[j] = "HON";
        else if (/^MAUI/.test(up)) geo[j] = "MAU";
        else if (/^HAWAII/.test(up)) geo[j] = "HAW";
        else if (/^KAUAI/.test(up)) geo[j] = "KAU";
        else if (/^UNKNOWN/.test(up)) geo[j] = "UNK";
      });
      const below = m[Math.min(h + 1, m.length - 1)];
      const hm = below.map((v) => headerMonth(v));
      const hm2 = m[h].map((v) => headerMonth(v));
      const cur = hm.flatMap((v, j) =>
        v === month || hm2[j] === month ? [j] : [],
      );
      if (cur.length === 0) {
        // header month differs from the file month: report the first
        // month-year header found
        const anyM = [...hm.filter(Boolean), ...hm2.filter(Boolean)];
        if (hMonth === null && anyM.length) hMonth = anyM[0];
        return;
      }
      hMonth = month;
      geo[cur[0]] = "HI";
      const vcols = geo.flatMap((g, j) => (g ? [j] : []));
      const rows = rseq(Math.min(h + 2, end), end);
      let nSub = 0;
      const seen = new Set<string>();
      for (const i of rows) {
        const lab = cleanLabel(m[i][labCol]);
        if (
          lab === "" ||
          /^(NOTE|TAX RESEARCH|MONTHLY|\d\.|SOURCE:)/i.test(lab)
        ) {
          continue;
        }
        const vals = vcols.map((c) => dotaxNum(m[i][c]));
        let item = matchItem(lab, labelType, section);
        if (item === null) {
          if (vals.some((v) => v !== null)) {
            problems.add(
              type,
              month,
              "unknown_label",
              `[${section}] ${lab}`,
              path,
            );
          }
          continue;
        }
        if (item === "ignore") continue;
        if (item === "subtotal") {
          nSub++;
          item = `subtotal${nSub}`;
        }
        if (seen.has(item)) continue;
        seen.add(item);
        const it = item;
        vcols.forEach((c, kk) =>
          out.push({
            section,
            sub: "",
            label: lab,
            item: it,
            geo: geo[c]!,
            value: vals[kk],
            row: i + 1,
          }),
        );
      }
      checkBlankLabels(m, rows, labCol, vcols, type, month, path, problems);
    });
    return { rows: out, headerMonth: hMonth };
  });
}

// ─── FUELS: Liquid Fuel Tax Collections and Allocations ─────────────

/*
 * Layout: a base table (header row with GALLONS, then STATE / COUNTY /
 * TOTAL tax columns; label column = the SOURCE OF REVENUE header left of
 * GALLONS) and an allocation table (header AMOUNT [+ TOTAL]), each in
 * blocks per county (C&C OF HONOLULU, COUNTY OF MAUI, ... and a statewide
 * SUMMARY). Before 2010-08 the base table sits to the right of a rate
 * schedule; from 2025-11 the tables are on separate sheets, so every sheet
 * is scanned. A refunds table on the rate sheet also has a GALLONS header
 * but no SOURCE OF REVENUE label, and is skipped. The report month is
 * printed in the title ("... DECEMBER 2025").
 */
function parseFuels(path: string, month: string, problems: Problems) {
  const monthsRx = `(${MONTH_NAMES.join("|")})\\s+\\d{4}`;
  const countyOf = (l: string): string | null => {
    const u = squish(l).toUpperCase();
    if (/^(C(ITY)?\s*(&|AND)\s*C(OUNTY)?\s*OF\s*)?HONOLULU/.test(u))
      return "HON";
    if (/^COUNTY OF MAUI$|^MAUI( COUNTY)?$/.test(u)) return "MAU";
    if (/^COUNTY OF HAWAII$|^HAWAII( COUNTY)?$/.test(u)) return "HAW";
    if (/^COUNTY OF KAUAI$|^KAUAI( COUNTY)?$/.test(u)) return "KAU";
    if (/^(SUMMARY|STATE TOTAL|ALL COUNTIES|STATE OF HAWAII TOTAL)/.test(u))
      return "HI";
    return null;
  };
  type Cols = Array<[string, number]>;
  const walkBlocks = (
    m: Matrix,
    r0: number,
    lab: number,
    cols: Cols,
    table: "base" | "alloc",
  ): SheetResult["rows"] => {
    const out: SheetResult["rows"] = [];
    let cty: string | null = null;
    const seen: string[] = [];
    let nSub = 0;
    for (let r = r0 + 1; r < m.length; r++) {
      const l = cleanLabel(m[r][lab]);
      // numbers in the label column are side calculations, not table rows
      if (l === "" || dotaxNum(m[r][lab]) !== null) continue;
      if (/^(\d+\/|\*|NOTE|Tax Research)/i.test(l) && cty === "HI") break;
      const cc = countyOf(l);
      if (cc && !seen.includes(cc)) {
        cty = cc;
        seen.push(cc);
        nSub = 0;
        continue;
      }
      if (cty === null) continue;
      const vals = cols.map(([, c]) => dotaxNum(m[r][c]));
      let item = matchItem(l, "fuels", table);
      if (item === null) {
        if (vals.some((v) => v !== null)) {
          problems.add(
            "fuels",
            month,
            "unknown_label",
            `[${table}] ${l}`,
            path,
          );
        }
        continue;
      }
      if (item === "subtotal") {
        nSub++;
        item = `subtotal${nSub}`;
      }
      const it = item;
      const geo = cty;
      cols.forEach(([name], k) =>
        out.push({
          section: `${table}_${name}`,
          sub: "",
          label: l,
          item: it,
          geo,
          value: vals[k],
          row: r + 1,
        }),
      );
    }
    return out;
  };

  let sheets: string[];
  try {
    sheets = sheetNames(path);
  } catch {
    problems.add(
      "fuels",
      month,
      "unreadable",
      "the file cannot be opened",
      path,
    );
    return null;
  }
  // some 2006-08 workbooks carry DOTAX's own "Worksheets" sheet, which
  // repeats the table headers around scratch calculations
  sheets = sheets.filter((s) => !/^work ?sheets?$/i.test(s));
  const res: SheetResult["rows"] = [];
  const reportMonths: string[] = [];
  for (const s of sheets) {
    let m: Matrix;
    try {
      m = readMatrix(path, s);
    } catch {
      continue;
    }
    if (m.length < 5 || ncol(m) < 3) continue;
    const rm = findCells(m, monthsRx);
    if (rm.length) {
      const hit = m[rm[0][0]][rm[0][1]]
        .toUpperCase()
        .match(new RegExp(monthsRx));
      if (hit) {
        const [name, year] = hit[0].split(/\s+/);
        reportMonths.push(
          `${year}-${String(MONTH_NAMES.indexOf(name) + 1).padStart(2, "0")}`,
        );
      }
    }
    const window = (rh: number) =>
      m.slice(Math.max(0, rh - 1), Math.min(m.length - 1, rh + 1) + 1);
    // base table
    for (const [rh, gc] of findCells(m, "^GALLONS$")) {
      const hdr = window(rh);
      const src = findCells(hdr, "SOURCE OF REVENUE").filter(([, c]) => c < gc);
      if (src.length === 0) continue;
      const lab = Math.max(...src.map(([, c]) => c));
      const hcol = (rx: string): number | null => {
        // merged cells can push TOTAL TAX far right (2026-05: 11 columns)
        const w = findCells(hdr, rx).filter(([, c]) => c > gc && c <= gc + 16);
        return w.length ? Math.min(...w.map(([, c]) => c)) : null;
      };
      const cols: Cols = (
        [
          ["gallons", gc],
          ["state", hcol("^STATE( TAX)?$")],
          ["county", hcol("(COUNTY|CTY).*TAX|^COUNTY$")],
          ["total", hcol("^TOTAL( TAX)?$")],
        ] as Array<[string, number | null]>
      ).filter((x): x is [string, number] => x[1] !== null);
      res.push(...walkBlocks(m, rh, lab, cols, "base"));
    }
    // allocation table
    for (const [rh, ac] of findCells(m, "^AMOUNT$")) {
      const hdr = window(rh);
      const src = findCells(
        hdr,
        "SOURCE OF REVENUE|ALLOCATION OF COLLECTIONS",
      ).filter(([, c]) => c < ac);
      if (src.length === 0) continue;
      const lab = Math.max(...src.map(([, c]) => c));
      const tw = findCells(hdr, "^TOTAL( TAX)?$").filter(
        ([, c]) => c > ac && c <= ac + 4,
      );
      const cols: Cols = [["amount", ac]];
      if (tw.length) cols.push(["total", Math.min(...tw.map(([, c]) => c))]);
      res.push(...walkBlocks(m, rh, lab, cols, "alloc"));
    }
  }
  const repMonths = [...new Set(reportMonths)];
  if (res.length === 0) {
    problems.add(
      "fuels",
      month,
      "no_table",
      "no base or allocation table found",
      path,
    );
    return null;
  }
  if (!repMonths.includes(month) && !accepted("fuels", month, "header_month")) {
    problems.add(
      "fuels",
      month,
      "header_month",
      `report title month(s): ${repMonths.join(", ")}`,
      path,
    );
    return null;
  }
  if (!res.some((r) => r.section.startsWith("alloc_"))) {
    problems.add(
      "fuels",
      month,
      "no_allocation_table",
      "base table found, allocation table not readable",
      path,
    );
  }
  // one value per section / item / county (the base table can repeat on
  // several sheets); rows with a value win over blanks
  const ordered = [
    ...res.filter((r) => r.value !== null),
    ...res.filter((r) => r.value === null),
  ];
  const seen = new Set<string>();
  return ordered.filter((r) => {
    const k = `${r.section}\r${r.item}\r${r.geo}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── LIQTOB / LIQ / TOB: liquor and tobacco by district ─────────────

/*
 * Layout: one block per tax, each with a header row containing FIRST ..
 * FOURTH (or OAHU .. KAUAI) and ALL DISTRICTS, the month in the row below
 * the ALL DISTRICTS cell, the section (liquor / tobacco) from the title
 * rows above. Labels are in the first column.
 */
function parseLiqtob(
  path: string,
  month: string,
  type: "liqtob" | "liq" | "tob",
  problems: Problems,
) {
  const distOf = (v: string): string | null => {
    const u = v.toUpperCase();
    if (/^(FIRST|OAHU)/.test(u)) return "HON";
    if (/^(SECOND|MAUI)/.test(u)) return "MAU";
    if (/^(THIRD|HAWAII)/.test(u)) return "HAW";
    if (/^(FOURTH|KAUAI)/.test(u)) return "KAU";
    if (/^ALL DISTRICTS$/.test(u)) return "HI";
    return null;
  };
  return parseBySheet(path, month, type, problems, (m) => {
    const hr = m.flatMap((r, i) =>
      r.some((v) => /^ALL DISTRICTS$/.test(v.toUpperCase())) ? [i] : [],
    );
    if (hr.length === 0) return null;
    const out: SheetResult["rows"] = [];
    let hMonth: string | null = null;
    hr.forEach((h, k) => {
      const geo = m[h].map(distOf);
      const vcols = geo.flatMap((g, j) => (g ? [j] : []));
      if (vcols.length < 5) return;
      const hiCol = vcols.find((j) => geo[j] === "HI")!;
      const hm = headerMonth(m[Math.min(h + 1, m.length - 1)][hiCol]);
      if (hMonth === null) hMonth = hm;
      if (hm === null || hm !== month) return;
      hMonth = hm;
      let title = "";
      for (let r = h - 1; r >= 0; r--) {
        const t = m[r].join(" ");
        if (/TAX|LIABILIT/i.test(t)) {
          title = t;
          break;
        }
      }
      const section = /LIQUOR/i.test(title)
        ? "liquor"
        : /TOBACCO|CIGARETTE/i.test(title)
          ? "tobacco"
          : null;
      if (!section) {
        problems.add(
          type,
          month,
          "section",
          `untyped block at row ${h + 1}: ${title}`,
          path,
        );
        return;
      }
      const end = k < hr.length - 1 ? hr[k + 1] - 1 : m.length - 1;
      const seen = new Set<string>();
      for (const r of rseq(h + 2, end)) {
        if (!m[r]) continue;
        const lab = cleanLabel(m[r][0]);
        if (lab === "") continue;
        if (/^(due to|tax research|monthly|\d+\/|note)/i.test(lab)) break;
        const vals = vcols.map((c) => dotaxNum(m[r][c]));
        if (vals.every((v) => v === null)) continue;
        const item = matchItem(lab, "liqtob", section);
        if (item === null) {
          problems.add(
            type,
            month,
            "unknown_label",
            `[${section}] ${lab}`,
            path,
          );
          continue;
        }
        if (item === "ignore" || seen.has(item)) continue;
        seen.add(item);
        vcols.forEach((c, kk) =>
          out.push({
            section,
            sub: "",
            label: lab,
            item,
            geo: geo[c]!,
            value: vals[kk],
            row: r + 1,
          }),
        );
      }
    });
    return { rows: out, headerMonth: hMonth };
  });
}

// ─── Dispatch ───────────────────────────────────────────────────────

export function parseFile(
  type: ReportType,
  path: string,
  month: string,
  problems: Problems,
): ParsedRow[] {
  let rows: SheetResult["rows"] | null;
  try {
    switch (type) {
      case "collec":
        rows = parseCollec(path, month, problems);
        break;
      case "ge":
      case "liab_ge":
      case "liab_tat":
        rows = parseActivity(path, month, type, problems);
        break;
      case "fuels":
        rows = parseFuels(path, month, problems);
        break;
      case "liqtob":
      case "liq":
      case "tob":
        rows = parseLiqtob(path, month, type, problems);
        break;
    }
  } catch (e) {
    problems.add(
      type,
      month,
      "parse_error",
      e instanceof Error ? e.message : String(e),
      path,
    );
    return [];
  }
  return (rows ?? []).map((r) => ({ type, month, file: path, ...r }));
}
