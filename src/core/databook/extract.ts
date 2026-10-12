/**
 * Edition → IR, cached on disk as data-dir/databook/ir/db{YYYY}.json so the
 * matcher can be re-run without re-parsing 24 workbooks per edition.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readAccessibleSection } from "./adapters/accessible";
import { readLegacySection } from "./adapters/legacy";
import { FIRST_ACCESSIBLE_EDITION, rawDir, sectionFileName } from "./fetch";
import type { EditionIR } from "./ir";
import { databookDir } from "./store";

export interface ExtractedEdition extends EditionIR {
  /** Section number → narrative text. */
  narratives: Record<number, string>;
}

export function irPath(edition: number): string {
  return join(databookDir(), "ir", `db${edition}.json`);
}

/** Parse all 24 section workbooks of an edition with the right adapter. */
export function extractEdition(edition: number): ExtractedEdition {
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
  for (let section = 1; section <= 24; section++) {
    const file = join(rawDir(edition), sectionFileName(edition, section));
    if (!existsSync(file))
      throw new Error(
        `Data Book ${edition}: missing ${file} (run fetch first)`,
      );
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

export function writeIR(ir: ExtractedEdition): string {
  const p = irPath(ir.edition);
  mkdirSync(join(databookDir(), "ir"), { recursive: true });
  writeFileSync(p, JSON.stringify(ir));
  return p;
}

export function readIR(edition: number): ExtractedEdition {
  const p = irPath(edition);
  if (!existsSync(p))
    throw new Error(`No IR for ${edition} at ${p} (run extract first)`);
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Editions with a cached IR, ascending. */
export function availableEditions(
  from = 2002,
  to = new Date().getFullYear(),
): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) if (existsSync(irPath(y))) out.push(y);
  return out;
}

/** Per-edition coverage summary for the CLI. */
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
