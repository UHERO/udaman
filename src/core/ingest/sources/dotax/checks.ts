/**
 * DOTAX consistency checks — port of the CHECKS / KNOWN ISSUES parts of
 * rprocess dotax_parse.R. Districts must add up to the state, components
 * to their totals, fuel base to allocation. Failures are Problems;
 * config/known-issues waives the hand-checked DOTAX file errors. (The R
 * SERIES checks keyed by UDAMAN series id are not part of the extractor;
 * gaps are classified per source key in parse.ts.)
 */

import { knownIssues } from "./config";
import type { KnownIssue } from "./config";
import { GEO_CODES } from "./parse-reports";
import type { ParsedRow, Problem, Problems } from "./parse-reports";

export const isCounty = (g: string) =>
  (GEO_CODES as readonly string[]).includes(g);

export function tol(x: number): number {
  return Math.max(2, 1e-6 * Math.abs(x));
}

export const fmt = (x: number) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const g = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = g.get(k);
    if (arr) arr.push(r);
    else g.set(k, [r]);
  }
  return g;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
type V = ParsedRow & { value: number };

/** First value of `item` in the group, or null (R: value[item == x][1]). */
function firstOf(g: V[], item: string): number | null {
  const r = g.find((x) => x.item === item);
  return r ? r.value : null;
}

function check(
  problems: Problems,
  type: string,
  rule: string,
  month: string,
  file: string,
  keys: string,
  lhs: number | null,
  rhs: number | null,
) {
  if (lhs === null || rhs === null) return;
  if (Math.abs(lhs - rhs) > tol(rhs)) {
    problems.add(
      type,
      month,
      rule,
      `${keys}: ${fmt(lhs)} vs ${fmt(rhs)}`,
      file,
    );
  }
}

/** District / county columns add up to the statewide column. */
function checkDistricts(p: V[], type: string, problems: Problems) {
  const g = groupBy(
    p.filter((r) => r.type === type),
    (r) => `${r.month}\r${r.file}\r${r.section}\r${r.item}`,
  );
  for (const rows of g.values()) {
    if (!rows.some((r) => isCounty(r.geo))) continue;
    if (!rows.some((r) => r.geo === "HI")) continue;
    const hi = sum(rows.filter((r) => r.geo === "HI").map((r) => r.value));
    const districts = sum(
      rows.filter((r) => r.geo !== "HI").map((r) => r.value),
    );
    const r0 = rows[0];
    check(
      problems,
      type,
      "district_sum",
      r0.month,
      r0.file,
      `${r0.section} / ${r0.item}`,
      districts,
      hi,
    );
  }
}

const FOUR = [
  "retailing",
  "services",
  "contracting",
  "theater",
  "interest_all_others",
  "interest",
  "all_others_4",
  "commissions",
  "hotel_rentals",
  "other_rentals",
  "use_4",
];
const LOW = [
  "insurance_solicitors",
  "sugar_processing",
  "pineapple_canning",
  "producing",
  "manufacturing",
  "wholesaling",
  "services_intermediary",
  "services_wholesale",
  "use_half",
];
const FUEL_ITEMS = [
  "gasoline",
  "diesel_off_highway",
  "diesel_highway",
  "lpg_off_highway",
  "lpg_highway",
  "small_boat_gasoline",
  "small_boat_diesel",
  "aviation",
  "other_fuel",
];

export function validate(parsed: ParsedRow[], problems: Problems) {
  const p = parsed.filter((r): r is V => r.value !== null);

  // collec
  checkDistricts(p, "collec", problems);
  const ch = p.filter((r) => r.type === "collec" && r.geo === "HI");
  const surcharge = new Map<string, number>();
  for (const [month, rows] of groupBy(
    ch.filter((r) => r.section === "county_surcharge"),
    (r) => r.month,
  )) {
    const parts = rows.filter((r) => r.item.startsWith("surcharge_"));
    surcharge.set(
      month,
      sum((parts.length ? parts : rows).map((r) => r.value)),
    );
  }
  for (const rows of groupBy(ch, (r) => `${r.month}\r${r.file}`).values()) {
    const { month, file } = rows[0];
    const s = (f: (r: V) => boolean) => sum(rows.filter(f).map((r) => r.value));
    const components = s((r) => r.section === "collections");
    const collTotal = s((r) => r.section === "coll_total");
    const grandTotal = s((r) => r.section === "grand_total");
    const funds = s(
      (r) => r.section === "distribution" && r.item !== "subtotal",
    );
    const subtotal = s(
      (r) => r.section === "distribution" && r.item === "subtotal",
    );
    const countyRev = s(
      (r) =>
        r.section === "county_revenue" && r.item !== "county_revenue_total",
    );
    const countyRevTotal = rows.some((r) => r.item === "county_revenue_total")
      ? s((r) => r.item === "county_revenue_total")
      : null;
    const distributed = subtotal + (surcharge.get(month) ?? 0) + countyRev;
    check(
      problems,
      "collec",
      "collections_sum",
      month,
      file,
      file,
      components,
      collTotal,
    );
    check(
      problems,
      "collec",
      "collections_vs_grand_total",
      month,
      file,
      file,
      collTotal,
      grandTotal,
    );
    check(
      problems,
      "collec",
      "distribution_sum",
      month,
      file,
      file,
      funds,
      subtotal,
    );
    check(
      problems,
      "collec",
      "distributed_vs_grand_total",
      month,
      file,
      file,
      distributed,
      grandTotal,
    );
    check(
      problems,
      "collec",
      "county_revenue_sum",
      month,
      file,
      file,
      countyRev,
      countyRevTotal,
    );
  }

  // ge, liab_ge: business activities add up to the subtotals and totals
  for (const t of ["ge", "liab_ge"]) {
    checkDistricts(p, t, problems);
    for (const g of groupBy(
      p.filter((r) => r.type === t),
      (r) => `${r.month}\r${r.file}\r${r.section}\r${r.geo}`,
    ).values()) {
      const { month, file, section, geo } = g[0];
      const s4 = sum(
        g.filter((r) => FOUR.includes(r.item)).map((r) => r.value),
      );
      const sLow = sum(
        g.filter((r) => LOW.includes(r.item)).map((r) => r.value),
      );
      const sub1 = firstOf(g, "subtotal1");
      const sub2 = firstOf(g, "subtotal2");
      const allocated = firstOf(g, "allocated");
      const unallocated = firstOf(g, "unallocated") ?? 0;
      const grand = firstOf(g, "grand_total");
      const subs = sub1 !== null && sub2 !== null ? sub1 + sub2 : null;
      const toTotal = allocated === null ? subs : allocated + unallocated;
      const keys = `${section} / ${geo}`;
      check(problems, t, "activity_sum_4pct", month, file, keys, s4, sub1);
      check(
        problems,
        t,
        "activity_sum_lower_rates",
        month,
        file,
        keys,
        sLow,
        sub2,
      );
      check(
        problems,
        t,
        "subtotals_vs_allocated",
        month,
        file,
        keys,
        subs,
        allocated,
      );
      check(problems, t, "grand_total", month, file, keys, toTotal, grand);
    }
  }

  // liab_tat: districts, and the two accommodation types add up to TOTAL
  checkDistricts(p, "liab_tat", problems);
  for (const g of groupBy(
    p.filter((r) => r.type === "liab_tat"),
    (r) => `${r.month}\r${r.file}\r${r.section}\r${r.geo}`,
  ).values()) {
    const { month, file, section, geo } = g[0];
    const parts = sum(g.filter((r) => r.item !== "total").map((r) => r.value));
    check(
      problems,
      "liab_tat",
      "tat_parts_sum",
      month,
      file,
      `${section} / ${geo}`,
      parts,
      firstOf(g, "total"),
    );
  }

  // fuels: fuel types add up to SUB-TOTAL, + environmental tax to TOTAL;
  // counties add up to the statewide summary; base TOTAL = allocated TOTAL
  const fuels = p.filter((r) => r.type === "fuels");
  for (const g of groupBy(
    fuels.filter((r) => r.section === "base_total"),
    (r) => `${r.month}\r${r.file}\r${r.geo}`,
  ).values()) {
    const { month, file, geo } = g[0];
    const fuel = sum(
      g.filter((r) => FUEL_ITEMS.includes(r.item)).map((r) => r.value),
    );
    const ert = sum(
      g.filter((r) => r.item.startsWith("ert_")).map((r) => r.value),
    );
    check(
      problems,
      "fuels",
      "fuel_types_sum",
      month,
      file,
      geo,
      fuel,
      firstOf(g, "subtotal1"),
    );
    check(
      problems,
      "fuels",
      "fuel_total",
      month,
      file,
      geo,
      fuel + ert,
      firstOf(g, "total"),
    );
  }
  for (const g of groupBy(
    fuels.filter((r) => r.section === "base_total" && r.item === "total"),
    (r) => `${r.month}\r${r.file}`,
  ).values()) {
    const { month, file } = g[0];
    const counties = sum(g.filter((r) => r.geo !== "HI").map((r) => r.value));
    const hi = sum(g.filter((r) => r.geo === "HI").map((r) => r.value));
    check(problems, "fuels", "county_sum", month, file, file, counties, hi);
  }
  for (const g of groupBy(
    fuels.filter(
      (r) =>
        r.item === "total" &&
        (r.section === "base_total" || r.section === "alloc_total"),
    ),
    (r) => `${r.month}\r${r.file}\r${r.geo}`,
  ).values()) {
    const { month, file, geo } = g[0];
    const base = sum(
      g.filter((r) => r.section === "base_total").map((r) => r.value),
    );
    const alloc = g.some((r) => r.section === "alloc_total")
      ? sum(g.filter((r) => r.section === "alloc_total").map((r) => r.value))
      : null;
    check(
      problems,
      "fuels",
      "base_vs_allocation",
      month,
      file,
      geo,
      alloc,
      base,
    );
  }

  // liquor / tobacco: districts add up to ALL DISTRICTS
  for (const t of ["liqtob", "liq", "tob"]) checkDistricts(p, t, problems);
}

// ─── Series mapping (for the checks) ────────────────────────────────

/** The known issue that waives a problem, if any. */
export function waiverFor(p: Problem): KnownIssue | null {
  return (
    knownIssues().find(
      (w) =>
        (w.action === "waive" || w.action === "accept") &&
        w.type === p.type &&
        w.month === p.month &&
        w.check === p.check &&
        (w.detail === "" || new RegExp(w.detail, "i").test(p.detail)),
    ) ?? null
  );
}

/** Split problems into open ones and the ones waived by known issues. */
export function applyKnown(problems: Problem[]): {
  open: Problem[];
  waived: Array<Problem & { note: string }>;
} {
  const open: Problem[] = [];
  const waived: Array<Problem & { note: string }> = [];
  for (const p of problems) {
    const w = waiverFor(p);
    if (w) waived.push({ ...p, note: w.note });
    else open.push(p);
  }
  return { open, waived };
}
