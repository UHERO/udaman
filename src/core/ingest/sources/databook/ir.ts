/**
 * Intermediate representation (IR) of one Data Book edition.
 *
 * Both edition adapters — `adapters/accessible.ts` (2025+ flat xlsx) and
 * `adapters/legacy.ts` (2002–2024 print-layout xls) — emit this shape, and
 * everything downstream (classification, cross-edition matching, manifest,
 * vintage load) reads only this. Labels here are already normalized with
 * `normalizeLabel` (footnote markers stripped, whitespace collapsed, ASCII);
 * the raw text is kept alongside for review reports.
 */

/** How a period label maps onto an annual observation date. */
export type PeriodBasis =
  | "calendar" // 2019
  | "point" // "July 1, 2019", "2010: April 1", "Dec. 31, 2010"
  | "fiscal" // "FY 2019", "2018-19" / "2018/2019" when the table says fiscal
  | "school" // "2018-2019" school year
  | "span1" // one-year span not otherwise identified ("2005/2006")
  | "acs5" // 5-year ACS window ending in year, "2020-2024"
  | "interval" // multi-year interval ("1990 - 2000", "2020-2030") — skipped
  | "unknown";

export interface ParsedPeriod {
  /** Original label text (trimmed, footnote markers removed). */
  label: string;
  /** Observation year, or null when the label carries no usable year. */
  year: number | null;
  /** Annual observation date `YYYY-01-01`, or null (intervals, unknown). */
  date: string | null;
  basis: PeriodBasis;
  /** For `point`: the within-year part, e.g. "July 1", "April 1". */
  point?: string;
}

/** Where a table's period comes from. */
export type TableLayout =
  | "long" // period down the first column, series across
  | "wide" // period across the header, series down
  | "snapshot" // single period (from the title), rows × columns are dims
  | "text" // rankings / name lists / mostly non-numeric — not loaded
  | "unknown";

export interface IRTable {
  edition: number; // Data Book edition year, e.g. 2025
  section: number; // 1..24
  /** Table number as printed in this edition, zero-padded "01.06". */
  tableNum: string;
  /** Workbook-relative sheet name. */
  sheet: string;
  /** Title without the "Table 1.06--" prefix and without the period part. */
  title: string;
  /** Period part of the title, e.g. "2010 TO 2025", "2025", "MARCH 31, 2026". */
  titlePeriod: string;
  headnote: string;
  /** Footnote marker ("a", "b", "1", "2") → footnote text. */
  footnotes: Record<string, string>;
  /** Full "Source: …" text. */
  source: string;
  /** First <https://…> URL in the source text, if any. */
  sourceUrl: string | null;
  layout: TableLayout;
  /** Header labels per panel (normalized), for review and matching. */
  panels: IRPanel[];
  /** Parser notes for the coverage / review report. */
  warnings: string[];
}

export interface IRPanel {
  /** 0-based panel index within the table. */
  index: number;
  /**
   * Panel label (the col-A text of a repeated header row, or of a
   * label-only year/subsection row that splits the table). "" for the
   * first/only panel.
   */
  label: string;
  /** Normalized column header paths, by 0-based column index. */
  headers: Record<number, string[]>;
}

/**
 * One numeric observation. The series identity within a table/edition is
 * `(panel, rowPath, colPath)` — period components are NOT part of it:
 *  - long:     rowPath = [] (the row is the period), colPath = header path
 *  - wide:     rowPath = row label path, colPath = header path minus the year
 *              (e.g. "Real SPI per capita 2018" → ["Real SPI per capita"])
 *  - snapshot: rowPath and colPath are both dimensions; period from title
 */
export interface IRCell {
  tableNum: string;
  panel: number;
  /** Hierarchy path of the row label, outermost first. */
  rowPath: string[];
  /** Header path of the column (multi-row header bands joined outermost first). */
  colPath: string[];
  period: ParsedPeriod;
  value: number;
  /** "01.06!C7" — sheet!A1 address, for provenance. */
  cellAddr: string;
  /** Excel number format of the cell, when available ("0.0%", "#,##0"). */
  numFmt?: string;
  /** Footnote markers attached to the row/column/value. */
  markers: string[];
}

export interface EditionIR {
  edition: number;
  tables: IRTable[];
  cells: IRCell[];
}
