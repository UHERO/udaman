/**
 * One Data Book edition's 24 section workbooks → IR, with the right
 * adapter: the flat "accessible" xlsx from 2025, the print-layout xls
 * before.
 */
import { readAccessibleSection } from "./adapters/accessible";
import { readLegacySection } from "./adapters/legacy";
import type { EditionIR } from "./ir";

/** First edition published in the flat "accessible" xlsx layout. */
export const FIRST_ACCESSIBLE_EDITION = 2025;

/** First edition with Excel workbooks in the DBEDT archive. */
export const FIRST_EDITION = 2002;

export const SECTIONS = 24;

export function sectionFileName(edition: number, section: number): string {
  const nn = String(section).padStart(2, "0");
  return edition >= FIRST_ACCESSIBLE_EDITION
    ? `DB${edition}_section${nn}.xlsx`
    : `section${nn}.xls`;
}

export interface ExtractedEdition extends EditionIR {
  /** Section number → narrative text. */
  narratives: Record<number, string>;
}

/** Parse an edition's section workbooks ({ section → file path }). */
export function extractEdition(
  edition: number,
  files: ReadonlyMap<number, string>,
): ExtractedEdition {
  const out: ExtractedEdition = {
    edition,
    tables: [],
    cells: [],
    narratives: {},
  };
  const read =
    edition >= FIRST_ACCESSIBLE_EDITION
      ? readAccessibleSection
      : readLegacySection;
  for (const [section, file] of [...files].sort((a, b) => a[0] - b[0])) {
    const res = read(file, edition, section);
    out.tables.push(...res.tables);
    out.cells.push(...res.cells);
    if (res.narrative) out.narratives[section] = res.narrative;
  }
  promoteYearRows(out);
  return out;
}

/**
 * A snapshot table (dated by its title) can hold a panel whose rows are
 * years: 10.06's "Value of contract awards" lists 2017 … 2023 totals, then
 * 2024 with its breakdown. Those rows are periods, not dimensions: the
 * year becomes the cell's date and leaves the row path, so the totals form
 * one series. Needs ≥3 distinct year rows in the table.
 */
export function promoteYearRows(ir: EditionIR): void {
  const YEAR = /^(19|20)\d{2}$/;
  const snapshot = new Set(
    ir.tables.filter((t) => t.layout === "snapshot").map((t) => t.tableNum),
  );
  const years = new Map<string, Set<string>>();
  for (const c of ir.cells) {
    const r = c.rowPath[0]?.trim();
    if (!snapshot.has(c.tableNum) || !r || !YEAR.test(r)) continue;
    let s = years.get(c.tableNum);
    if (!s) years.set(c.tableNum, (s = new Set()));
    s.add(r);
  }
  for (const c of ir.cells) {
    if ((years.get(c.tableNum)?.size ?? 0) < 3) continue;
    const r = c.rowPath[0]?.trim();
    if (!r || !YEAR.test(r)) continue;
    const year = Number(r);
    c.period = { ...c.period, label: r, year, date: `${year}-01-01` };
    c.rowPath = c.rowPath.slice(1);
  }
}

/** Per-edition coverage summary. */
export function coverage(ir: EditionIR) {
  const layouts: Record<string, number> = {};
  for (const t of ir.tables) layouts[t.layout] = (layouts[t.layout] ?? 0) + 1;
  return {
    edition: ir.edition,
    tables: ir.tables.length,
    layouts,
    cells: ir.cells.length,
    tablesWithWarnings: ir.tables.filter((t) => t.warnings.length).length,
  };
}
