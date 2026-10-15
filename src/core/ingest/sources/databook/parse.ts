/**
 * Every stored Data Book edition → one long extract of latest-edition
 * values, keyed by the base edition's labels:
 *
 *   section,table,name,geo,unit,date,value
 *   20,20.04,Pounds landed of commercial fish,HI,Pounds,2003-01-01,25314680
 *
 *  1. Each edition's 24 workbooks → IR (adapters/: the 2025+ flat xlsx,
 *     the 2002–2024 print-layout xls).
 *  2. The base edition (config baseEdition, 2025) defines the series:
 *     propose() groups its cells into measurements (geography taken out of
 *     the labels) and series (one per geography).
 *  3. matchEditions() links every other edition's cells to those series,
 *     walking back (and forward) one edition at a time: table lineage by
 *     title, values and labels; series by labels and identical values.
 *     Cells of tables or columns DBEDT has since dropped stay unmatched
 *     and are left out.
 *  4. Per series and date, the newest edition that prints the date wins.
 *
 * Dimensions:
 *   section  "20"
 *   table    the base edition's table number ("20.04"), the table's
 *            stable id even after DBEDT renumbers it
 *   name     the measurement's labels without geography (panel > row >
 *            column), or the table title when only geography is left
 *   geo      geography handle (HI, HON, …, OAHU, MAUI, US)
 *   unit     inferred from labels, headnote and number format (meta.ts)
 *
 * Every period between a series' first and last value that has none is a
 * period no edition printed: an unreadable section fails the run.
 */

import type { ParseInput, ParseResult, ValidationResult } from "../../types";
import { extractEdition, SECTIONS } from "./edition";
import { parseDatabookKey } from "./fetch";
import { propose, type ManifestSection } from "./manifest";
import { matchEditions, type TableMatchReport } from "./match";

export const DATABOOK_DIMS = [
  "section",
  "table",
  "name",
  "geo",
  "unit",
] as const;

export const DEFAULT_BASE_EDITION = 2025;

/** Separator between label levels in `name`. */
export const NAME_SEP = " > ";

export type DatabookDims = Record<(typeof DATABOOK_DIMS)[number], string>;

export interface MatchedSeries {
  dims: DatabookDims;
  /** edition → date → value */
  byEdition: Map<number, Map<string, number>>;
}

export interface MatchedDatabook {
  baseEdition: number;
  editions: number[];
  /** By the base edition's internal series id (never leaves the source). */
  series: Map<string, MatchedSeries>;
  /** The base edition's measurements, with their series ids. */
  manifest: ManifestSection[];
  tables: TableMatchReport[];
  /** Editions that do not have all 24 sections stored. */
  incomplete: Array<{ edition: number; missing: number[] }>;
  /** (table, name, geo) printed by more than one series. */
  duplicates: string[];
}

/**
 * The measurement's `name`: its labels, or the table title. Load
 * statements live in latin1 columns, so the few characters outside it are
 * spelled out ("≥ 18" → ">= 18").
 */
export function measurementName(
  title: string,
  dims: { panel: string; row: string[]; column: string[] },
): string {
  const parts = [dims.panel, ...dims.row, ...dims.column]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return (parts.length ? parts.join(NAME_SEP) : title)
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=");
}

/** Files by edition → section → path. */
function filesByEdition(
  inputs: readonly ParseInput[],
): Map<number, Map<number, string>> {
  const out = new Map<number, Map<number, string>>();
  for (const i of inputs) {
    const k = parseDatabookKey(i.artifact.artifactKey);
    if (!k) continue;
    let m = out.get(k.edition);
    if (!m) out.set(k.edition, (m = new Map()));
    m.set(k.section, i.path);
  }
  return out;
}

/** Parse and match every stored edition (also used by the vintage backfill). */
export function matchDatabook(
  inputs: readonly ParseInput[],
  opts: {
    baseEdition?: number;
    /** Keep these measurements' prefixes (the universe's frozen names) */
    previous?: ManifestSection[];
    log?: (msg: string) => void;
  } = {},
): MatchedDatabook {
  const log = opts.log ?? (() => {});
  const files = filesByEdition(inputs);
  const editions = [...files.keys()].sort((a, b) => a - b);
  const baseEdition = opts.baseEdition ?? DEFAULT_BASE_EDITION;
  if (!files.has(baseEdition))
    throw new Error(
      `the base edition ${baseEdition} is not stored (have ${editions.join(", ") || "none"})`,
    );

  const incomplete: MatchedDatabook["incomplete"] = [];
  for (const e of editions) {
    const have = files.get(e)!;
    const missing = Array.from({ length: SECTIONS }, (_, i) => i + 1).filter(
      (s) => !have.has(s),
    );
    if (missing.length) incomplete.push({ edition: e, missing });
  }

  const load = (edition: number) => {
    // An edition's IR is ~200 MB of objects: let the previous one go first.
    if (typeof Bun !== "undefined") Bun.gc(true);
    const t0 = Date.now();
    const ir = extractEdition(edition, files.get(edition)!);
    log(
      `edition ${edition}: ${ir.tables.length} tables, ${ir.cells.length} cells (${Date.now() - t0} ms)`,
    );
    return ir;
  };

  // The base edition defines the series: ids are internal, the labels are
  // what the extract prints.
  const base = load(baseEdition);
  const manifest = propose(base, {
    narratives: base.narratives,
    previous: opts.previous,
  });
  const series = new Map<string, MatchedSeries>();
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const sec of manifest)
    for (const t of sec.tables)
      for (const m of t.measurements)
        for (const s of m.series) {
          const dims: DatabookDims = {
            section: t.tableNum.slice(0, 2),
            table: t.tableNum,
            name: measurementName(t.title, m.dims),
            geo: s.geo,
            unit: m.unit.longLabel,
          };
          const k = `${dims.table}|${dims.name}|${dims.geo}`;
          if (seen.has(k))
            duplicates.push(`${dims.table} ${dims.name} @${dims.geo}`);
          seen.set(k, s.name);
          series.set(s.name, { dims, byEdition: new Map() });
        }

  const res = matchEditions(
    manifest,
    editions,
    (e) => (e === baseEdition ? base : load(e)),
    baseEdition,
    (rows) => {
      for (const r of rows) {
        const s = r.series ? series.get(r.series) : undefined;
        if (!s || !Number.isFinite(r.value)) continue;
        let byDate = s.byEdition.get(r.vintage);
        if (!byDate) s.byEdition.set(r.vintage, (byDate = new Map()));
        byDate.set(r.date, r.value);
      }
    },
  );
  return {
    baseEdition,
    editions,
    series,
    manifest,
    tables: res.tables,
    incomplete,
    duplicates,
  };
}

/**
 * Latest-edition value per date: editions oldest → newest, each
 * overwriting the dates it prints. A date a newer edition no longer prints
 * keeps the value of the last edition that did.
 */
export function latestValues(
  byEdition: Map<number, Map<string, number>>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of [...byEdition.keys()].sort((a, b) => a - b))
    for (const [date, value] of byEdition.get(e)!) out.set(date, value);
  return out;
}

export function parseDatabook(
  inputs: readonly ParseInput[],
  config: Record<string, unknown>,
  log: (msg: string) => void,
): ParseResult {
  const baseEdition = Number(config.baseEdition ?? DEFAULT_BASE_EDITION);
  const m = matchDatabook(inputs, { baseEdition, log });

  const rows: ParseResult["rows"] = [];
  let series = 0;
  for (const s of m.series.values()) {
    const values = latestValues(s.byEdition);
    if (values.size === 0) continue;
    series++;
    for (const [date, value] of values)
      rows.push({ dims: s.dims, date, value });
  }

  const byEdition = new Map<number, { cells: number; matched: number }>();
  for (const t of m.tables) {
    const e = byEdition.get(t.edition) ?? { cells: 0, matched: 0 };
    e.cells += t.cells;
    e.matched += t.matchedCells;
    byEdition.set(t.edition, e);
  }
  const matchRate = Object.fromEntries(
    [...byEdition]
      .sort((a, b) => a[0] - b[0])
      .map(([e, c]) => [
        e,
        `${((100 * c.matched) / Math.max(1, c.cells)).toFixed(1)}%`,
      ]),
  );

  const checks: ValidationResult[] = [
    m.incomplete.length
      ? {
          check: "databook:sections",
          severity: "hard",
          passed: false,
          message: `${m.incomplete.length} edition(s) lack section workbooks`,
          details: m.incomplete.map(
            (x) => `${x.edition}: missing section ${x.missing.join(", ")}`,
          ),
        }
      : {
          check: "databook:sections",
          severity: "hard",
          passed: true,
          message: `all ${SECTIONS} sections of ${m.editions.length} editions`,
        },
    m.duplicates.length
      ? {
          check: "databook:names",
          severity: "hard",
          passed: false,
          message: `${m.duplicates.length} (table, name, geo) printed by two series`,
          details: m.duplicates.slice(0, 50),
        }
      : {
          check: "databook:names",
          severity: "hard",
          passed: true,
          message: "every (table, name, geo) is one series",
        },
  ];

  return {
    rows,
    checks,
    stats: {
      editions: `${m.editions[0]}–${m.editions.at(-1)}`,
      baseEdition: m.baseEdition,
      series,
      matchRate,
    },
  };
}
