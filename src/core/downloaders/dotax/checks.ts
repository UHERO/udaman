/**
 * DOTAX consistency checks — port of the CHECKS / SERIES / KNOWN ISSUES
 * parts of rprocess dotax_parse.R. Districts must add up to the state,
 * components to their totals, fuel base to allocation; mapped series must
 * have no holes. Failures are Problems; config/known-issues waives the
 * hand-checked DOTAX file errors.
 */

import { knownIssues, seriesMapRows } from "./config";
import { GEO_CODES } from "./parse";
import type { ParsedRow, Problem, Problems } from "./parse";

const isCounty = (g: string) => (GEO_CODES as readonly string[]).includes(g);

export function tol(x: number): number {
  return Math.max(2, 1e-6 * Math.abs(x));
}

const fmt = (x: number) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
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

export type MappedRow = {
  type: string;
  section: string;
  item: string;
  geo: string;
  month: string;
  id: string;
  value: number | null;
  file: string;
};

/**
 * Map parsed values to series ids with config/series (same rules as R).
 * Values no mapping claims get a slug id (<type>-<section>-<item>@<geo>.m).
 * Two cells for one id and month: blanks give way to values, equal values
 * merge, conflicting values are a duplicate_id problem.
 */
export function mapSeries(p: ParsedRow[], problems: Problems): MappedRow[] {
  const sm = seriesMapRows();
  const byKey = groupBy(sm, (r) => `${r.type}\r${r.section}\r${r.item}`);
  const mapped: MappedRow[] = [];
  const claimed = new Set<string>();
  for (const r of p) {
    for (const s of byKey.get(`${r.type}\r${r.section}\r${r.item}`) ?? []) {
      if (s.from && r.month < s.from) continue;
      if (s.to && r.month > s.to) continue;
      if (!(
        s.geo === "all" ||
        s.geo === r.geo ||
        (s.geo === "county" && isCounty(r.geo))
      )) {
        continue;
      }
      mapped.push({
        type: r.type,
        section: r.section,
        item: r.item,
        geo: r.geo,
        month: r.month,
        id: s.id.replace("{geo}", r.geo),
        value: r.value,
        file: r.file,
      });
      claimed.add(`${r.type}\r${r.section}\r${r.item}\r${r.geo}\r${r.month}`);
    }
  }
  const slugs: MappedRow[] = p
    .filter(
      (r) =>
        !claimed.has(
          `${r.type}\r${r.section}\r${r.item}\r${r.geo}\r${r.month}`,
        ),
    )
    .map((r) => ({
      type: r.type,
      section: r.section,
      item: r.item,
      geo: r.geo,
      month: r.month,
      id: `${`${r.type}-${r.section}-${r.item}`.replace(/_/g, "-")}@${r.geo.toLowerCase()}.m`,
      value: r.value,
      file: r.file,
    }));

  const out: MappedRow[] = [];
  for (const g of groupBy(
    [...mapped, ...slugs],
    (r) => `${r.id}\r${r.month}`,
  ).values()) {
    const vals = g.some((r) => r.value !== null)
      ? g.filter((r) => r.value !== null)
      : g;
    if (vals.length > 1 && vals[0].value !== null) {
      const first = vals[0].value;
      if (
        vals.some((r) => Math.abs((r.value as number) - first) > tol(first))
      ) {
        problems.add(
          "series",
          vals[0].month,
          "duplicate_id",
          `${vals[0].id}: ${vals.map((r) => fmt(r.value as number)).join(" / ")}`,
        );
      }
    }
    out.push(vals[0]);
  }
  return out;
}

/**
 * Continuity fills kept from the previous dotax.R, applied only for the
 * gap check here (in UDAMAN they become arithmetic loaders): TGR/TGB ITONS
 * = ITNS + OTNS where DOTAX printed them separately; SINS ← SWNS.
 */
export function fillLegacy(s: MappedRow[]): MappedRow[] {
  const v = s.filter((r) => r.value !== null);
  const derived: MappedRow[] = [];
  for (const pre of ["TGR", "TGB"]) {
    for (const geo of ["HI", ...GEO_CODES]) {
      const id = (code: string) => `${pre}${code}NS@${geo}.M`;
      const itoMonths = new Set(
        v.filter((r) => r.id === id("ITO")).map((r) => r.month),
      );
      for (const g of groupBy(
        v.filter((r) => r.id === id("IT") || r.id === id("OT")),
        (r) => `${r.type}\r${r.month}\r${r.file}`,
      ).values()) {
        if (g.length !== 2 || itoMonths.has(g[0].month)) continue;
        derived.push({
          ...g[0],
          section: "derived",
          item: "it_plus_ot",
          geo,
          id: id("ITO"),
          value: (g[0].value as number) + (g[1].value as number),
        });
      }
      const siMonths = new Set(
        v.filter((r) => r.id === id("SI")).map((r) => r.month),
      );
      for (const r of v.filter(
        (r) => r.id === id("SW") && !siMonths.has(r.month),
      )) {
        derived.push({
          ...r,
          section: "derived",
          item: "sw_as_si",
          id: id("SI"),
        });
      }
    }
  }
  const replaced = new Set(derived.map((r) => `${r.id}\r${r.month}`));
  return [...s.filter((r) => !replaced.has(`${r.id}\r${r.month}`)), ...derived];
}

/**
 * A mapped series must not have holes: every month between its first and
 * last value where its report was parsed must have a value or at least a
 * printed (blank) row.
 */
export function checkGaps(
  s: MappedRow[],
  parsedMonths: Array<{ type: string; month: string }>,
  problems: Problems,
) {
  for (const g of groupBy(
    s.filter((r) => /@[A-Z]+\.M$/.test(r.id)),
    (r) => `${r.id}\r${r.type}`,
  ).values()) {
    const withValue = g
      .filter((r) => r.value !== null)
      .map((r) => r.month)
      .sort();
    if (withValue.length === 0) continue;
    const first = withValue[0];
    const last = withValue[withValue.length - 1];
    const have = new Set(g.map((r) => r.month));
    const { id, type } = g[0];
    const expect = parsedMonths
      .filter((pm) => pm.type === type && pm.month >= first && pm.month <= last)
      .map((pm) => pm.month);
    for (const mo of [...new Set(expect)].sort()) {
      if (!have.has(mo)) problems.add(type, mo, "series_gap", id);
    }
  }
}

/** Split problems into open ones and the ones waived by known issues. */
export function applyKnown(problems: Problem[]): {
  open: Problem[];
  waived: Problem[];
} {
  const waive = knownIssues().filter(
    (k) => k.action === "waive" || k.action === "accept",
  );
  const open: Problem[] = [];
  const waived: Problem[] = [];
  for (const p of problems) {
    const hit = waive.some(
      (w) =>
        w.type === p.type &&
        w.month === p.month &&
        w.check === p.check &&
        (w.detail === "" || new RegExp(w.detail, "i").test(p.detail)),
    );
    (hit ? waived : open).push(p);
  }
  return { open, waived };
}
