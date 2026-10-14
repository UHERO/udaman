/**
 * Load statements for the DOTAX universe's series, replacing
 * `"<name>".tsn.load_from("dotax/dotax.csv")` (the rprocess dotax.R
 * output) with the downloaders' load methods.
 *
 * A series name is traced back to the DOTAX rows dotax.R built it from:
 *  - UDAMAN ids (TGRRTNS@MAU.M) through config/series, the same item → id
 *    map (with its month ranges) dotax.R used; a range becomes `.trim`;
 *  - slug names (GE_BASE_SUBTOTAL1@HI.M, from ge-base-subtotal1@hi.m) by
 *    splitting off the report type and section;
 *  - dotax.R's continuity fills become lower-priority loaders: TGR/TGB
 *    ITONS = ITNS + OTNS, and SINS from SWNS;
 *  - the statewide series the Google Sheet superseded in dotax.R
 *    (dotax_collec_supersede) get a dotax_sheet loader on top.
 *
 * Each row gets a loader per downloader whose output has it. Priorities
 * follow the UDAMAN convention: the series' strongest loader is 100 and each
 * weaker kind steps down by 10, in the order sheet, current, archive, then
 * the fills (current before archive). So a series without a sheet loader
 * gets current 100 / archive 90, and a superseded one sheet 100 / current
 * 90 / archive 80. Arguments are printed as the output shows them.
 */

import { norm } from "../keys";
import { reportKey } from "./args";
import { seriesMapRows } from "./config";

export type Tier = "archive" | "current" | "sheet";

/** Strongest first; continuity fills sit under the direct rows. */
const RANK = {
  sheet: 0,
  current: 1,
  archive: 2,
  current_fill: 3,
  archive_fill: 4,
} as const;

/**
 * Each downloader's output, per row: the printed columns and the months
 * it covers. Files are keyed by lookup key (report|section|sub|item|geo)
 * with args [type, tax, source, area]; the sheet by norm(type)|norm(source)
 * with args [type, tax, source].
 */
export type DotaxRowInfo = { args: string[]; first: string; last: string };
export type DotaxLabels = Record<Tier, Map<string, DotaxRowInfo>>;

export type PlannedLoader = { code: string; priority: number };
type Ranked = { code: string; rank: number };

type Coord = {
  type: string;
  section: string;
  sub: string;
  item: string;
  geo: string;
  /** YYYY-MM bounds, inclusive */
  from: string | null;
  to: string | null;
};

const GEOS = ["HI", "HON", "MAU", "HAW", "KAU", "UNK"];
const COUNTIES = ["HON", "MAU", "HAW", "KAU"];
const TYPES = [
  "liab_tat",
  "liab_ge",
  "liqtob",
  "collec",
  "fuels",
  "liq",
  "tob",
  "ge",
];
const SECTIONS = [
  "county_surcharge",
  "county_revenue",
  "distribution",
  "grand_total",
  "coll_total",
  "collections",
  "base_gallons",
  "base_county",
  "base_state",
  "base_total",
  "alloc_amount",
  "alloc_total",
  "liability",
  "tobacco",
  "liquor",
  "base",
];

/** dotax_collec.R source_to_id, for the series the sheet supersedes. */
const SHEET_SOURCES: Array<[string, string, string]> = [
  ["Collection", "General Excise & Use", "TRGTNS@HI.M"],
  ["Collection", "Decl. of Est. Taxes-Ind", "TRINESNS@HI.M"],
  ["Collection", "Payment W/ Returns-Ind", "TRINPRNS@HI.M"],
  ["Collection", "WH Tax on Wages-Ind", "TRINWHNS@HI.M"],
  ["Collection", "Refunds-Ind", "TRINRFNS@HI.M"],
  ["Collection", "Decl. of Est. Taxes-Corp", "TRCOESNS@HI.M"],
  ["Collection", "Payment W/ Returns-Corp", "TRCOPRNS@HI.M"],
  ["Collection", "Refunds-Corp", "TRCORFNS@HI.M"],
  ["Collection", "Trans. Accomm. Tax/Time Share Occup. Tax", "TRTTNS@HI.M"],
  ["Collection", "County Surcharges", "TRHSNS@HI.M"],
  ["Distribution", "City and County of Honolulu", "TRHSNS@HON.M"],
  ["Distribution", "County of Hawaii", "TRHSNS@HAW.M"],
  ["Distribution", "County of Hawaii", "TRHASNS@HI.M"],
  ["Distribution", "County of Kauai", "TRHSNS@KAU.M"],
  ["Distribution", "County of Kauai", "TRKSNS@HI.M"],
  ["Distribution", "County of Maui", "TRHSNS@MAU.M"],
  ["Distribution", "County of Maui", "TRMSNS@HI.M"],
  ["Distribution", "State General Fund", "TDGFNS@HI.M"],
];

export function sheetLabelKey(type: unknown, source: unknown): string {
  return `${norm(type)}|${norm(source)}`;
}

function subOf(type: string, section: string, item: string): string {
  if (type !== "collec" || section !== "collections") return "";
  if (item.startsWith("corp_")) return "corp";
  if (item.startsWith("ind_")) return "ind";
  return "";
}

function geoOk(rule: string, geo: string): boolean {
  return (
    rule === "all" ||
    rule === geo ||
    (rule === "county" && COUNTIES.includes(geo))
  );
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Rows of config/series that build `name`. */
function mappedCoords(name: string): Coord[] {
  const out: Coord[] = [];
  for (const r of seriesMapRows()) {
    const geos = r.id.includes("{geo}") ? GEOS : [r.geo];
    for (const geo of geos) {
      if (r.id.replace("{geo}", geo) !== name || !geoOk(r.geo, geo)) continue;
      out.push({
        type: r.type,
        section: r.section,
        sub: subOf(r.type, r.section, r.item),
        item: r.item,
        geo,
        from: r.from,
        to: r.to,
      });
    }
  }
  return out;
}

/**
 * Slug name → its row: "<type>_<section>_<item>@<geo>.M". Months that
 * config/series maps to a UDAMAN id went there instead, so they are
 * trimmed off.
 */
function slugCoords(name: string): Coord[] {
  const m = name.match(/^([A-Z0-9_]+)@([A-Z]+)\.M$/);
  if (!m) return [];
  const rest0 = m[1].toLowerCase();
  const geo = m[2];
  for (const type of TYPES) {
    if (!rest0.startsWith(`${type}_`)) continue;
    const rest = rest0.slice(type.length + 1);
    const section = SECTIONS.find((s) => rest.startsWith(`${s}_`));
    if (!section) continue;
    const item = rest.slice(section.length + 1);
    const claims = seriesMapRows()
      .filter(
        (r) =>
          r.type === type &&
          r.section === section &&
          r.item === item &&
          geoOk(r.geo, geo),
      )
      .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
    // the complement of the claimed month ranges
    const free: Array<[string | null, string | null]> = [];
    let start: string | null = null;
    for (const c of claims) {
      if (c.from === null) {
        if (c.to === null) return [];
      } else if (start === null || c.from > start) {
        free.push([start, shiftMonth(c.from, -1)]);
      }
      if (c.to === null) {
        start = "9999-12";
        break;
      }
      start = shiftMonth(c.to, 1);
    }
    if (start !== "9999-12") free.push([start, null]);
    const sub = subOf(type, section, item);
    return free.map(([from, to]) => ({
      type,
      section,
      sub,
      item,
      geo,
      from,
      to,
    }));
  }
  return [];
}

function call(method: string, args: string[], coord?: Coord): string {
  let code = `Series.${method}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
  if (coord?.from || coord?.to) {
    const start = coord.from ? `${coord.from}-01` : "1000-01-01";
    code += coord.to
      ? `.trim("${start}", "${coord.to}-01")`
      : `.trim("${start}")`;
  }
  return code;
}

export type DotaxLoaderPlan = {
  loaders: PlannedLoader[];
  /** What could not be planned (e.g. a row missing from every output) */
  missing: string[];
};

/** The downloader loaders for one DOTAX series. */
export function planDotaxLoaders(
  name: string,
  labels: DotaxLabels,
): DotaxLoaderPlan {
  const loaders: Ranked[] = [];
  const missing: string[] = [];
  const keyOf = (c: Pick<Coord, "type" | "section" | "sub" | "item" | "geo">) =>
    reportKey(c.type, c.section, c.sub, c.item, c.geo);
  /** Printed args: the current spelling when current has the row */
  const argsOf = (key: string) =>
    (labels.current.get(key) ?? labels.archive.get(key))?.args ?? null;
  /** The tier has the row inside the coordinate's month window */
  const covers = (tier: Tier, key: string, c?: Coord) => {
    const info = labels[tier].get(key);
    if (!info) return false;
    if (c?.from && info.last < `${c.from}-01`) return false;
    if (c?.to && info.first > `${c.to}-01`) return false;
    return true;
  };
  const fileTiers = ["archive", "current"] as const;

  const coords = /_/.test(name.split("@")[0])
    ? slugCoords(name)
    : mappedCoords(name);
  for (const c of coords) {
    const key = keyOf(c);
    const args = argsOf(key);
    if (!args) {
      missing.push(
        `${key}${c.from || c.to ? ` (${c.from ?? ""}..${c.to ?? ""})` : ""}: in neither the archive nor the current output`,
      );
      continue;
    }
    for (const tier of fileTiers) {
      if (!covers(tier, key, c)) continue;
      loaders.push({
        code: call(`load_from_dotax_${tier}`, args, c),
        rank: RANK[tier],
      });
    }
  }

  // dotax.R continuity fills
  const fill = name.match(/^(TGR|TGB)(ITO|SI)NS@([A-Z]+)\.M$/);
  if (fill) {
    const [, pre, code, geo] = fill;
    const section = pre === "TGR" ? "collections" : "base";
    const k = (item: string) =>
      keyOf({ type: "ge", section, sub: "", item, geo });
    const parts =
      code === "ITO"
        ? [k("interest"), k("all_others_4")]
        : [k("services_wholesale")];
    for (const tier of fileTiers) {
      if (!parts.every((p) => covers(tier, p))) continue;
      loaders.push({
        code: parts
          .map((p) => call(`load_from_dotax_${tier}`, argsOf(p)!))
          .join(" + "),
        rank: RANK[`${tier}_fill`],
      });
    }
  }

  for (const [type, source, id] of SHEET_SOURCES) {
    if (id !== name) continue;
    const args = labels.sheet.get(sheetLabelKey(type, source))?.args;
    if (!args) {
      missing.push(`sheet ${type} / ${source}: not in the dotax_sheet output`);
      continue;
    }
    loaders.push({
      code: call("load_from_dotax_sheet", args),
      rank: RANK.sheet,
    });
  }

  if (coords.length === 0 && !fill && loaders.length === 0) {
    missing.push("no DOTAX row maps to this name");
  }
  return { loaders: prioritize(loaders), missing };
}

/** Dedupe, then 100 for the strongest rank present, 90 for the next, ... */
function prioritize(loaders: Ranked[]): PlannedLoader[] {
  const seen = new Set<string>();
  const unique = loaders.filter((l) => !seen.has(l.code) && seen.add(l.code));
  const ranks = [...new Set(unique.map((l) => l.rank))].sort((a, b) => a - b);
  return unique.map((l) => ({
    code: l.code,
    priority: 100 - 10 * ranks.indexOf(l.rank),
  }));
}
