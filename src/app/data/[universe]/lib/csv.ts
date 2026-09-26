/**
 * CSV export builders (replaces ag-grid exportDataAsCsv + the Highcharts
 * getCSV metadata wrapper). Builders are pure; `downloadCsv` is the only
 * browser-touching function.
 */
import { saveAs } from "file-saver";

import type { PortalConfig } from "./config";
import { formatTableDate } from "./dates";
import { publicPortalUrl } from "./links";
import type { DateEntry, PortalSeries, SeriesChartRow } from "./types";

type Cell = string | number | null | undefined;

/** RFC-4180 escape: quote when needed, double inner quotes. */
export function csvEscape(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  const s =
    typeof cell === "number"
      ? Number.isFinite(cell)
        ? String(cell)
        : ""
      : cell;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** Trigger a browser download. Client-only. */
export function downloadCsv(fileName: string, csv: string): void {
  const name = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), name);
}

export interface CsvTableRow {
  /** First column ("Series"). */
  label: string;
  /** Values keyed by column key (date or tableDate). */
  values: Record<string, Cell>;
}

/**
 * Generic wide table: first column label, then one column per period in
 * CHRONOLOGICAL order (UI tables show newest-first; exports are oldest-first,
 * matching Angular's reversed columnKeys).
 */
export function buildWideTableCsv(opts: {
  columns: { key: string; label: string }[];
  rows: CsvTableRow[];
  firstColumnLabel?: string;
  prepend?: string[];
  append?: string[];
}): string {
  const { columns, rows, firstColumnLabel = "Series", prepend, append } = opts;
  const body: Cell[][] = [
    [firstColumnLabel, ...columns.map((c) => c.label)],
    ...rows.map((r) => [r.label, ...columns.map((c) => r.values[c.key])]),
  ];
  const parts: string[] = [];
  if (prepend?.length)
    parts.push(prepend.map((l) => csvEscape(l)).join("\n"), "");
  parts.push(toCsv(body));
  if (append?.length)
    parts.push("", append.map((l) => csvEscape(l)).join("\n"));
  return parts.join("\n");
}

/**
 * Same wide table as `buildWideTableCsv`, tab-separated with no metadata
 * lines, for "Copy to Clipboard" — pastes into Excel/Sheets as cells.
 */
export function buildWideTableTsv(opts: {
  columns: { key: string; label: string }[];
  rows: CsvTableRow[];
  firstColumnLabel?: string;
}): string {
  const { columns, rows, firstColumnLabel = "Series" } = opts;
  const cell = (c: Cell) =>
    c === null ||
    c === undefined ||
    (typeof c === "number" && !Number.isFinite(c))
      ? ""
      : String(c).replace(/[\t\r\n]+/g, " ");
  return [
    [firstColumnLabel, ...columns.map((c) => c.label)],
    ...rows.map((r) => [r.label, ...columns.map((c) => r.values[c.key])]),
  ]
    .map((r) => r.map(cell).join("\t"))
    .join("\n");
}

/**
 * Category table export (category-table-view.onExport).
 * File name: "{dataList}_{geo}-{freqLabel}". Footer: title, geo-freq, link.
 */
export function buildCategoryCsv(opts: {
  config: PortalConfig;
  categoryId: number;
  categoryName: string;
  dataListId: number;
  dataListName: string;
  geoName?: string;
  freqLabel?: string;
  /** Visible periods in chronological order. */
  dates: DateEntry[];
  rows: CsvTableRow[];
}): { fileName: string; csv: string } {
  const { config, dates, rows, geoName = "", freqLabel = "" } = opts;
  const link = publicPortalUrl(config.exportLabels.publicUrl, "category", {
    id: opts.categoryId,
    data_list_id: opts.dataListId,
    view: "table",
  });
  const csv = buildWideTableCsv({
    columns: dates.map((d) => ({ key: d.date, label: d.tableDate })),
    rows,
    append: [
      `${opts.categoryName}: ${opts.dataListName} Table`,
      `${geoName}-${freqLabel}`,
      link,
    ],
  });
  return { fileName: `${opts.dataListName}_${geoName}-${freqLabel}`, csv };
}

/** Analyzer table export (analyzer-table.onExport): source line prepended. */
export function buildAnalyzerCsv(opts: {
  config: PortalConfig;
  /** Visible tableDates in chronological order (column keys = tableDate). */
  dates: DateEntry[];
  rows: CsvTableRow[];
}): { fileName: string; csv: string } {
  return {
    fileName: "analyzer",
    csv: buildWideTableCsv({
      columns: opts.dates.map((d) => ({
        key: d.tableDate,
        label: d.tableDate,
      })),
      rows: opts.rows,
      prepend: [opts.config.exportLabels.portalSource],
    }),
  };
}

/**
 * Metadata block prepended to single-series chart exports
 * (highstock.formatAccessibilityDescription).
 */
export function seriesCsvMetadata(
  s: PortalSeries,
  config: PortalConfig,
): string[] {
  const link = publicPortalUrl(config.exportLabels.publicUrl, "series", {
    id: s.id,
  });
  return [
    `Series: ${s.title} (${s.geography.name} - ${s.frequency})`,
    s.sourceDescription ?? "",
    s.sourceLink ?? "",
    s.sourceDetails ?? "",
    `${s.title}: ${link}`,
    config.exportLabels.portal,
    config.exportLabels.portalLink,
  ].filter(Boolean);
}

/** Single-series long-format CSV: Date, Level, and any companion columns. */
export function buildSeriesCsv(opts: {
  series: PortalSeries;
  config: PortalConfig;
  rows: SeriesChartRow[];
  columns: { key: keyof SeriesChartRow; label: string }[];
}): { fileName: string; csv: string } {
  const { series, config, rows, columns } = opts;
  const body: Cell[][] = [
    ["Date", ...columns.map((c) => c.label)],
    ...rows.map((r) => [
      formatTableDate(r.date, series.frequencyShort),
      ...columns.map((c) => r[c.key] as Cell),
    ]),
  ];
  return {
    fileName: series.name.replace(/[^\w@.&-]+/g, "_"),
    csv: `${seriesCsvMetadata(series, config)
      .map((l) => csvEscape(l))
      .join("\n")}\n\n${toCsv(body)}`,
  };
}
