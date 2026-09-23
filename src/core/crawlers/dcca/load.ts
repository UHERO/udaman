/**
 * Database side of the DCCA pipeline: read the condo rows to match against,
 * write one project's register fields.
 *
 * condominium_projects is a qpub pipeline table — rebuilt from the local
 * rebuild DB on every sync, which never has these fields — so the register
 * fields must be re-applied on the REMOTE after each sync. That is what
 * `bun run dcca load` is for. qpub-load's own upsert touches only
 * project_name / unit_count and leaves these columns alone.
 *
 * The four registration-date columns (preliminary_date, contingent_final_date,
 * final_date, biennial_registration_date) came from the old DPR.Net site; the
 * current register does not publish them, so they are never written here.
 */

import { rawQuery } from "@/lib/mysql/hhdb";
import { localRawQuery } from "@/lib/mysql/hhdb-local";

import type { CondoCandidate } from "./match";
import type { DccaProfile } from "./types";

export type Db = <T = Record<string, unknown>>(
  sql: string,
  params?: (string | number | Date | null)[],
) => Promise<T[]>;

/** Remote housing DB (default) or the local rebuild DB (--local). */
export function selectDb(local: boolean): Db {
  return local ? (localRawQuery as Db) : (rawQuery as Db);
}

/** Columns this pipeline owns, in the order they are written. */
export const DCCA_COLUMNS = [
  "dcca_link",
  "zoning",
  "address",
  "city",
  "developer",
  "project_number",
  "commercial",
  "tool_sheds",
  "ohana",
  "residential",
  "parking",
  "converted",
  "agricultural",
  "other",
  "buildings",
  "floors",
  "land_ownership",
] as const;

export function dccaValues(p: DccaProfile): (string | number | null)[] {
  return [
    p.url,
    p.zoning,
    p.address,
    p.city,
    p.developer,
    p.reg,
    p.commercial,
    p.toolSheds,
    p.ohana,
    p.residential,
    p.parking,
    p.converted,
    p.agricultural,
    p.other,
    p.buildings,
    p.floors,
    p.landOwnership,
  ];
}

/** Pure SQL builders, exported for tests. */
export function buildUpdateSql(tmk: string, p: DccaProfile) {
  const sets = DCCA_COLUMNS.map((c) => `\`${c}\` = ?`).join(", ");
  return {
    sql: `UPDATE condominium_projects SET ${sets} WHERE tmk = ?`,
    params: [...dccaValues(p), tmk],
  };
}

export function buildInsertSql(tmk: string, p: DccaProfile) {
  const cols = ["tmk", "project_name", "unit_count", ...DCCA_COLUMNS];
  return {
    sql: `INSERT INTO condominium_projects (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    params: [tmk, p.name, p.totalUnits, ...dccaValues(p)],
  };
}

export async function getCondoCandidates(db: Db): Promise<CondoCandidate[]> {
  const rows = await db<{
    tmk: string;
    project_name: string | null;
    unit_count: number | null;
  }>("SELECT tmk, project_name, unit_count FROM condominium_projects");
  return rows.map((r) => ({
    tmk: String(r.tmk),
    projectName: r.project_name == null ? null : String(r.project_name),
    unitCount: r.unit_count == null ? null : Number(r.unit_count),
  }));
}

/** TMKs that exist in properties (the FK target) among the given set. */
export async function filterExistingProperties(
  db: Db,
  tmks: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  const CHUNK = 500;
  for (let i = 0; i < tmks.length; i += CHUNK) {
    const chunk = tmks.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const rows = await db<{ tmk: string }>(
      `SELECT tmk FROM properties WHERE tmk IN (${chunk.map(() => "?").join(",")})`,
      chunk,
    );
    for (const r of rows) found.add(String(r.tmk));
  }
  return found;
}

export async function updateProject(
  db: Db,
  tmk: string,
  p: DccaProfile,
): Promise<void> {
  const { sql, params } = buildUpdateSql(tmk, p);
  await db(sql, params);
}

export async function insertProject(
  db: Db,
  tmk: string,
  p: DccaProfile,
): Promise<void> {
  const { sql, params } = buildInsertSql(tmk, p);
  await db(sql, params);
}
