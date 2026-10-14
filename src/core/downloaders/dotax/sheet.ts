/**
 * dotax_sheet — the "DOTAX Collections Portal Export Data" Google Sheet, a
 * maintained copy of the DOTAX Collections Portal: preliminary statewide
 * collections, usually weeks or months ahead of the report spreadsheets.
 * Port of rprocess dotax_collec.R.
 *
 *   Series.load_from_dotax_sheet("Collection", "General Excise", "General Excise & Use")
 *
 * Sheet1 is long format, monthly from 2000-01, with the columns
 *   date (yyyy-mm-dd) | type | tax | source | amount | fiscal year
 * (the original headers Date | Source Type | Tax Type | Source | Amount |
 * Fiscal Year work too). Columns are found by header, so their order does
 * not matter; the maintainers' working tabs and any scratch columns outside
 * the configured range are ignored. The output has the same shape as the
 * DOTAX report downloaders (date, type, tax, source, area, amount,
 * fiscal_year; area is always State), and load statements pass type, tax
 * and source as written on the sheet (case and spacing don't matter). Every
 * source is kept (no mapping table): the load statement picks the row.
 *
 * A state series typically has three loaders — archive, current and this
 * sheet with the highest priority — so the sheet's values win where present
 * (what dotax_collec_supersede did in dotax.R).
 */

import { fetchSheetValues } from "../google-sheets";
import { norm } from "../keys";
import { KEY_SEP } from "../tidy";
import type { DownloaderImpl, TidyRow } from "../types";
import { areaCode, DOTAX_LAYOUT, fiscalYear } from "./args";

/** Accepted header text per column (lowercased, "(...)" dropped). */
const HEADERS = {
  date: ["date"],
  type: ["type", "source type"],
  tax: ["tax", "tax type"],
  source: ["source"],
  amount: ["amount"],
  fiscal_year: ["fiscal year", "fiscal_year", "fy"],
} as const;
type Column = keyof typeof HEADERS;
const REQUIRED: Column[] = ["date", "type", "tax", "source", "amount"];

function headerName(v: unknown): string {
  return norm(String(v ?? "").replace(/\(.*?\)/g, ""));
}

/** Lookup key: type|tax|source|area, normalized. */
function sheetKey(type: unknown, tax: unknown, source: unknown): string {
  return [norm(type), norm(tax), norm(source), "HI"].join(KEY_SEP);
}

/** Sheets serial day number → YYYY-MM-01 (first of the month). */
function serialToMonth(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** A date cell → YYYY-MM-01: a real date, or text written yyyy-mm-dd. */
function cellMonth(v: unknown): string | null {
  if (typeof v === "number") return serialToMonth(v);
  const m = String(v ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})(-\d{2})?$/);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12
    ? `${m[1]}-${m[2]}-01`
    : null;
}

export const dotaxSheet: DownloaderImpl = {
  handle: "dotax_sheet",
  loadMethod: "load_from_dotax_sheet",
  loadSignature: 'load_from_dotax_sheet("<type>", "<tax>", "<source>")',
  outputHandle: "DOTAX_SHEET@docs.google.com",
  supportsKeyedRuns: false,
  layout: DOTAX_LAYOUT,

  keyFromArgs(args) {
    const call = `load_from_dotax_sheet(${args
      .filter((a) => a !== undefined)
      .map((a) => JSON.stringify(a))
      .join(", ")})`;
    const given = args.filter((a) => a !== undefined && a !== null);
    if (
      given.length < 3 ||
      given.length > 4 ||
      given.some((a) => typeof a !== "string" || !norm(a))
    ) {
      throw new Error(
        `${call}: expects type, tax and source as written on the sheet (e.g. "Collection", "General Excise", "General Excise & Use")`,
      );
    }
    const [type, tax, source, area = "State"] = given as string[];
    if (areaCode(area) !== "HI") {
      throw new Error(`${call}: the sheet is statewide only (area "State")`);
    }
    return {
      key: sheetKey(type, tax, source),
      frequency: "M",
      label: `sheet row ${type} / ${tax} / ${source}`,
    };
  },

  indexKey(rowKey) {
    const [type, tax, source, area] = rowKey.split(KEY_SEP);
    return areaCode(area) === "HI" ? sheetKey(type, tax, source) : null;
  },

  async run(ctx) {
    const sheetId = String(ctx.downloader.configValue("sheetId", ""));
    const range = String(ctx.downloader.configValue("range", "Sheet1!A:F"));
    if (!sheetId) throw new Error("dotax_sheet: config.sheetId is not set");

    const values = await fetchSheetValues(sheetId, range);
    const header = (values[0] ?? []).map(headerName);
    const col = {} as Record<Column, number>;
    for (const [name, accepted] of Object.entries(HEADERS) as Array<
      [Column, readonly string[]]
    >) {
      col[name] = header.findIndex((h) => accepted.includes(h));
    }
    const missing = REQUIRED.filter((c) => col[c] < 0);
    if (missing.length) {
      throw new Error(
        `${range}: no ${missing.join(", ")} column - expected headers date (yyyy-mm-dd) | type | tax | source | amount | fiscal year, got ${(values[0] ?? []).join(" | ")}`,
      );
    }

    // drop fully blank rows only; a row with data but no real date fails
    const badDates: number[] = [];
    type Obs = { value: number; fiscalYear: string };
    const series = new Map<
      string,
      { label: string[]; latest: string; obs: Map<string, Obs> }
    >();
    const conflicts = new Set<string>();
    let latest = "";
    const blank = (v: unknown) => v === undefined || v === null || v === "";
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const cell = (c: Column) => (col[c] >= 0 ? row[col[c]] : undefined);
      const [date, type, tax, source, amount] = REQUIRED.map(cell);
      if (blank(date) && blank(type) && blank(source)) continue;
      // every date cell must be a real date or yyyy-mm-dd text - nothing
      // else is guessed at
      const month = cellMonth(date);
      if (!month) {
        badDates.push(i + 1);
        continue;
      }
      // months not yet filled in are blank in amount
      if (blank(amount)) continue;
      const value =
        typeof amount === "number"
          ? amount
          : Number(String(amount).replace(/[,$\s]/g, ""));
      if (!Number.isFinite(value)) continue;
      const key = sheetKey(type, tax, source);
      if (month > latest) latest = month;
      const s = series.get(key) ?? { label: [], latest: "", obs: new Map() };
      // print the labels as written in the latest month
      if (month >= s.latest) {
        s.latest = month;
        // "|" joins the key columns
        s.label = [type, tax, source].map((v) =>
          String(v ?? "")
            .trim()
            .replace(/\|/g, "/"),
        );
      }
      const prev = s.obs.get(month);
      if (prev !== undefined && prev.value !== value) conflicts.add(key);
      const fy = cell("fiscal_year");
      s.obs.set(month, {
        value,
        fiscalYear: blank(fy) ? fiscalYear(month.slice(0, 7)) : String(fy),
      });
      series.set(key, s);
    }
    if (badDates.length) {
      throw new Error(
        `Not able to parse date in ${range} row(s) ${badDates.slice(0, 10).join(", ")}${badDates.length > 10 ? ` (+${badDates.length - 10} more)` : ""} - date cells must be real dates or yyyy-mm-dd text, not blank`,
      );
    }
    if (series.size === 0) throw new Error(`No observations found in ${range}`);

    // a source repeated with different amounts in one month would silently
    // collide: drop that source and report it
    const rows: TidyRow[] = [];
    for (const [key, s] of series) {
      if (conflicts.has(key)) continue;
      const rowKey = [...s.label, "State"].join(KEY_SEP);
      for (const [date, o] of s.obs) {
        rows.push({
          key: rowKey,
          date,
          value: o.value,
          extra: { fiscal_year: o.fiscalYear },
        });
      }
    }

    // the sheet is updated by hand each month - flag a stall
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const stale = latest < threeMonthsAgo.toISOString().slice(0, 7) + "-01";
    if (stale)
      ctx.log(
        `newest month on the sheet is ${latest} - has it stopped being updated?`,
      );

    return {
      write: { mode: "replace", rows },
      failedKeys: [...conflicts].map((k) => `duplicate observations: ${k}`),
      stats: {
        sources: series.size,
        rows: rows.length,
        latestMonth: latest,
        ...(stale ? { warning: `newest month is ${latest}` } : {}),
      },
    };
  },
};
