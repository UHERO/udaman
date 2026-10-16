/**
 * Write the DATABOOK manifest to the database (plan §2.5). Idempotent
 * upsert keyed on (universe, prefix) / (universe, name) — never a wipe, so
 * series ids, portal links and hand edits survive re-runs.
 *
 * Creates or updates, in order: the universe row, geographies, units,
 * sources, source details, categories (Data Book → section → table, one
 * data list per table), measurements + data list membership, series +
 * measurement links, and loaders:
 *  - observed:  Series.load_from_extract("databook", { table, name, geo })  priority 100
 *  - pseudo:    the same .fill_missing_linear, priority 40, pseudo_history,
 *               only for series flagged `interpolate`
 *
 * Snapshot series matched in fewer than MIN_SNAPSHOT_EDITIONS editions are
 * skipped (decision 5).
 */
import LoaderCollection from "@catalog/collections/loader-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Universe } from "@catalog/types/shared";

import { DATABOOK_GEOS } from "@/core/ingest/sources/databook/geo";
import { toAscii } from "@/core/ingest/sources/databook/labels";
import {
  measurementNotes,
  type ManifestMeasurement,
  type ManifestSection,
  type ManifestSeries,
  type ManifestTable,
} from "@/core/ingest/sources/databook/manifest";
import { measurementName } from "@/core/ingest/sources/databook/parse";
import { createLogger } from "@/core/observability/logger";
import { insertAndGetId, rawQuery } from "@/lib/mysql/db";

import { DATABOOK_EXTRACTOR } from "./source";

const log = createLogger("databook.apply");

export const DATABOOK: Universe = "DATABOOK";
export const MIN_SNAPSHOT_EDITIONS = 5;
const OBSERVED_PRIORITY = 100;
const PSEUDO_PRIORITY = 40;

export type DatabookFilters = { table: string; name: string; geo: string };

/** A series' filters in the databook extract. */
export function seriesFilters(
  t: ManifestTable,
  m: ManifestMeasurement,
  s: ManifestSeries,
): DatabookFilters {
  if (!m.dims)
    throw new Error(
      `${m.prefix}: the manifest predates extract filters (run bun run databook sync)`,
    );
  return {
    table: t.tableNum,
    name: measurementName(t.title, m.dims),
    geo: s.geo,
  };
}

/** Double quotes, or single when the label has a double quote. */
const quote = (v: string) => (v.includes('"') ? `'${v}'` : `"${v}"`);

/** Load statements live in data_sources.eval, VARCHAR(500). */
export const MAX_EVAL = 500;

export function observedEval(f: DatabookFilters): string {
  return `Series.load_from_extract("${DATABOOK_EXTRACTOR}", { table: ${quote(f.table)}, name: ${quote(f.name)}, geo: ${quote(f.geo)} })`;
}

export function pseudoEval(f: DatabookFilters): string {
  return `${observedEval(f)}.fill_missing_linear`;
}

/**
 * Measurements the manifest says should exist in the database, always
 * with ALL their geographies. Snapshot measurements need ≥5 editions in at
 * least one geography (decision 5) — a county that matched in fewer
 * editions still comes along so the measurement is complete.
 */
export function includeMeasurement(m: ManifestMeasurement): boolean {
  return m.series.some(
    (s) =>
      hasHistory(s) &&
      (!s.snapshot || (s.editions ?? 0) >= MIN_SNAPSHOT_EDITIONS),
  );
}

/**
 * A series needs at least two observations: a single point is not a time
 * series (event lists like eruptions or hurricanes, a geography printed
 * for one year only). Series not yet matched (no count) are kept.
 */
export const MIN_OBSERVATIONS = 2;

function hasHistory(s: ManifestSeries): boolean {
  return s.observations === undefined || s.observations >= MIN_OBSERVATIONS;
}

/** The series of `m` to create. */
export function includedSeries(m: ManifestMeasurement): ManifestSeries[] {
  return includeMeasurement(m) ? m.series.filter(hasHistory) : [];
}

export interface ApplyStats {
  categories: number;
  dataLists: number;
  measurements: { created: number; updated: number };
  series: { created: number; updated: number; skippedSnapshot: number };
  loaders: { created: number };
  units: number;
  sources: number;
}

type Params = (string | number | null)[];

/** Fit a value to a VARCHAR(n) column ("" → null). */
function clip(v: string | null | undefined, n: number): string | null {
  if (!v) return null;
  return v.length <= n ? v : v.slice(0, n - 1) + "…";
}

async function findId(sql: string, params: Params): Promise<number | null> {
  const rows = await rawQuery<{ id: number }>(
    sql,
    params as (string | number)[],
  );
  return rows[0]?.id ?? null;
}

async function upsertId(
  findSql: string,
  findParams: Params,
  insertSql: string,
  insertParams: Params,
): Promise<number> {
  return (
    (await findId(findSql, findParams)) ??
    (await insertAndGetId(insertSql, insertParams))
  );
}

/** Count what `applyManifest` would do, without writing. */
export function planManifest(sections: ManifestSection[]) {
  let tables = 0;
  let measurements = 0;
  let series = 0;
  let skippedSnapshot = 0;
  let pseudo = 0;
  for (const s of sections) {
    for (const t of s.tables) {
      tables++;
      for (const m of t.measurements) {
        const kept = includedSeries(m);
        skippedSnapshot += m.series.length - kept.length;
        if (kept.length) measurements++;
        series += kept.length;
        pseudo += kept.filter((x) => x.interpolate).length;
      }
    }
  }
  return {
    sections: sections.length,
    tables,
    measurements,
    series,
    skippedSnapshot,
    pseudoLoaders: pseudo,
  };
}

/**
 * udaman's text columns are latin1: transliterate (ʻ → ', Ō → O, “ → ")
 * and drop anything still outside latin1 so inserts don't fail.
 */
function latin1(sections: ManifestSection[]): ManifestSection[] {
  return JSON.parse(JSON.stringify(sections), (_k, v) =>
    typeof v === "string"
      ? [...toAscii(v)].filter((ch) => ch.charCodeAt(0) <= 0xff).join("")
      : v,
  );
}

export async function applyManifest(
  input: ManifestSection[],
): Promise<ApplyStats> {
  const sections = latin1(input);
  // Filters from the manifest as written (the extract's labels), not the
  // latin1 copy.
  const filters = new Map<string, DatabookFilters>();
  for (const sec of input)
    for (const t of sec.tables)
      for (const m of t.measurements)
        for (const x of includedSeries(m))
          filters.set(x.name, seriesFilters(t, m, x));
  const stats: ApplyStats = {
    categories: 0,
    dataLists: 0,
    measurements: { created: 0, updated: 0 },
    series: { created: 0, updated: 0, skippedSnapshot: 0 },
    loaders: { created: 0 },
    units: 0,
    sources: 0,
  };

  // ── Universe + geographies ──────────────────────────────────────
  if (
    !(await rawQuery("SELECT name FROM universe WHERE name = ?", [DATABOOK]))[0]
  ) {
    await rawQuery("INSERT INTO universe (name, description) VALUES (?, ?)", [
      DATABOOK,
      "DBEDT State of Hawaii Data Book",
    ]);
  }
  // Geography names follow UHERO's where it has the handle, so a place
  // reads the same in every universe.
  const uhero = new Map(
    (
      await rawQuery<{
        handle: string;
        display_name: string;
        display_name_short: string;
        fips: string | null;
      }>(
        "SELECT handle, display_name, display_name_short, fips FROM geographies WHERE universe = 'UHERO'",
      )
    ).map((r) => [r.handle, r]),
  );
  const geoIds = new Map<string, number>();
  for (const g of DATABOOK_GEOS) {
    const u = uhero.get(g.handle);
    const names = [
      u?.display_name ?? g.displayName,
      u?.display_name_short ?? g.displayNameShort,
      u?.fips ?? g.fips,
    ];
    let id = await findId(
      "SELECT id FROM geographies WHERE universe = ? AND handle = ? LIMIT 1",
      [DATABOOK, g.handle],
    );
    if (id) {
      await rawQuery(
        "UPDATE geographies SET display_name = ?, display_name_short = ?, fips = ?, updated_at = NOW() WHERE id = ?",
        [...names, id] as (string | number)[],
      );
    } else {
      id = await insertAndGetId(
        `INSERT INTO geographies (universe, handle, display_name, display_name_short, fips, geotype, list_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [DATABOOK, g.handle, ...names, g.geotype, g.listOrder],
      );
    }
    geoIds.set(g.handle, id);
  }

  // ── Units, sources, source details (cached by value) ────────────
  const unitIds = new Map<string, number>();
  const unitId = async (m: ManifestMeasurement) => {
    const k = `${m.unit.shortLabel}|${m.unit.longLabel}`;
    if (!unitIds.has(k)) {
      unitIds.set(
        k,
        await upsertId(
          "SELECT id FROM units WHERE universe = ? AND short_label = ? AND long_label = ? LIMIT 1",
          [DATABOOK, m.unit.shortLabel, m.unit.longLabel],
          "INSERT INTO units (universe, short_label, long_label, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
          [DATABOOK, m.unit.shortLabel, m.unit.longLabel],
        ),
      );
      stats.units = unitIds.size;
    }
    return unitIds.get(k)!;
  };
  const sourceIds = new Map<string, number>();
  const sourceId = async (agency: string, link: string | null) => {
    if (!sourceIds.has(agency)) {
      sourceIds.set(
        agency,
        await upsertId(
          "SELECT id FROM sources WHERE universe = ? AND description = ? LIMIT 1",
          [DATABOOK, agency],
          "INSERT INTO sources (universe, description, link, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
          [DATABOOK, agency.slice(0, 255), link ? link.slice(0, 255) : null],
        ),
      );
      stats.sources = sourceIds.size;
    }
    return sourceIds.get(agency)!;
  };
  const detailIds = new Map<string, number>();
  const sourceDetailId = async (detail: string) => {
    if (!detail) return null;
    if (!detailIds.has(detail)) {
      detailIds.set(
        detail,
        await upsertId(
          "SELECT id FROM source_details WHERE universe = ? AND description = ? LIMIT 1",
          [DATABOOK, detail],
          "INSERT INTO source_details (universe, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
          [DATABOOK, detail],
        ),
      );
    }
    return detailIds.get(detail)!;
  };

  // ── Category tree ───────────────────────────────────────────────
  const rootId = await upsertId(
    "SELECT id FROM categories WHERE universe = ? AND ancestry IS NULL LIMIT 1",
    [DATABOOK],
    `INSERT INTO categories (universe, name, list_order, hidden, masked, header, default_freq, created_at, updated_at)
     VALUES (?, 'Data Book', 0, 0, 0, 0, 'A', NOW(), NOW())`,
    [DATABOOK],
  );
  const hiId = geoIds.get("HI")!;

  for (const sec of sections) {
    const secName = `${sec.section}. ${sec.name}`;
    const secId = await upsertId(
      "SELECT id FROM categories WHERE universe = ? AND ancestry = ? AND meta = ? LIMIT 1",
      [DATABOOK, String(rootId), `DATABOOK_S${sec.section}`],
      `INSERT INTO categories (universe, name, ancestry, list_order, meta, description, hidden, masked, header, default_geo_id, default_freq, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, 'A', NOW(), NOW())`,
      [
        DATABOOK,
        secName,
        String(rootId),
        sec.section,
        `DATABOOK_S${sec.section}`,
        sec.narrative.slice(0, 500) || null,
        hiId,
      ],
    );
    await rawQuery(
      "UPDATE categories SET name = ?, description = ? WHERE id = ?",
      [
        secName,
        sec.narrative.slice(0, 500) || (null as unknown as string),
        secId,
      ],
    );
    stats.categories++;
    const secAncestry = `${rootId}/${secId}`;

    for (let ti = 0; ti < sec.tables.length; ti++) {
      const t = sec.tables[ti];
      const measurements = t.measurements.filter((m) => includeMeasurement(m));
      if (measurements.length === 0) continue;
      const tableName = `${t.tableNum} ${t.title}`.slice(0, 255);
      const meta = `DATABOOK_T${t.tableNum}`;

      let catId = await findId(
        "SELECT id FROM categories WHERE universe = ? AND meta = ? LIMIT 1",
        [DATABOOK, meta],
      );
      let dataListId: number;
      if (catId) {
        dataListId = (
          await rawQuery<{ data_list_id: number }>(
            "SELECT data_list_id FROM categories WHERE id = ?",
            [catId],
          )
        )[0].data_list_id;
        await rawQuery(
          "UPDATE categories SET name = ?, list_order = ? WHERE id = ?",
          [tableName, ti, catId],
        );
        await rawQuery("UPDATE data_lists SET name = ? WHERE id = ?", [
          tableName,
          dataListId,
        ]);
      } else {
        dataListId = await insertAndGetId(
          "INSERT INTO data_lists (universe, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
          [DATABOOK, tableName],
        );
        catId = await insertAndGetId(
          `INSERT INTO categories (universe, name, ancestry, list_order, meta, data_list_id, hidden, masked, header, default_geo_id, default_freq, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'A', NOW(), NOW())`,
          [DATABOOK, tableName, secAncestry, ti, meta, dataListId, hiId],
        );
        stats.dataLists++;
      }
      stats.categories++;

      const tSourceId = await sourceId(t.source.agency, t.source.link);
      const tDetailId = await sourceDetailId(t.source.detail);

      for (let mi = 0; mi < measurements.length; mi++) {
        const m = measurements[mi];
        const mUnitId = await unitId(m);
        const mFields = {
          dataPortalName: m.dataPortalName,
          unitId: mUnitId,
          sourceId: tSourceId,
          sourceDetailId: tDetailId,
          decimals: m.decimals,
          percent: m.percent,
          seasonalAdjustment: "not_applicable" as const,
          sourceLink: clip(t.source.link, 255),
          notes: clip(measurementNotes(t, m), 500),
        };
        let measurementId = await findId(
          "SELECT id FROM measurements WHERE universe = ? AND prefix = ? LIMIT 1",
          [DATABOOK, m.prefix],
        );
        if (measurementId) {
          await MeasurementCollection.update(measurementId, mFields);
          stats.measurements.updated++;
        } else {
          measurementId = (
            await MeasurementCollection.create({
              prefix: m.prefix,
              universe: DATABOOK,
              ...mFields,
            })
          ).id;
          stats.measurements.created++;
        }
        const indent = `indent${Math.max(0, Math.min(3, m.indent))}`;
        await rawQuery(
          `INSERT INTO data_list_measurements (data_list_id, measurement_id, list_order, indent)
           VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE list_order = VALUES(list_order), indent = VALUES(indent)`,
          [dataListId, measurementId, mi, indent],
        );

        const kept = new Set(includedSeries(m));
        for (const s of m.series) {
          if (!kept.has(s)) {
            stats.series.skippedSnapshot++;
            continue;
          }
          const sFields = {
            dataPortalName: m.dataPortalName,
            description: m.description,
            decimals: m.decimals,
            unitId: mUnitId,
            sourceId: tSourceId,
            sourceDetailId: tDetailId,
            sourceLink: clip(t.source.link, 255),
          };
          let series = await SeriesCollection.findByNameAndUniverse(
            s.name,
            DATABOOK,
          );
          if (series) {
            await SeriesCollection.update(series.id!, sFields);
            stats.series.updated++;
          } else {
            series = await SeriesCollection.create({
              name: s.name,
              universe: DATABOOK,
              geographyId: geoIds.get(s.geo) ?? null,
              frequency: "year",
              seasonalAdjustment: "not_applicable",
              percent: m.percent,
              ...sFields,
            });
            stats.series.created++;
          }
          await MeasurementCollection.addSeries(measurementId, series.id!);
          stats.loaders.created += await ensureLoaders(
            series.id!,
            s,
            filters.get(s.name)!,
          );
        }
      }
    }
  }

  log.info({ ...stats }, "DATABOOK manifest applied");
  return stats;
}

/** Create the observed (and, if flagged, pseudo-history) loaders if missing. */
async function ensureLoaders(
  seriesId: number,
  s: ManifestSeries,
  f: DatabookFilters,
): Promise<number> {
  const existing = await LoaderCollection.getBySeriesId(seriesId);
  const evals = new Set(existing.map((l) => l.eval));
  let created = 0;
  const want: Array<{ code: string; priority: number; pseudo: boolean }> = [
    { code: observedEval(f), priority: OBSERVED_PRIORITY, pseudo: false },
  ];
  if (s.interpolate)
    want.push({
      code: pseudoEval(f),
      priority: PSEUDO_PRIORITY,
      pseudo: true,
    });
  for (const w of want)
    if (w.code.length > MAX_EVAL)
      throw new Error(`${s.name}: load statement over ${MAX_EVAL} characters`);
  for (const w of want) {
    if (evals.has(w.code)) continue;
    const loader = await LoaderCollection.create({
      seriesId,
      code: w.code,
      priority: w.priority,
      scale: 1,
      presaveHook: "",
      clearBeforeLoad: false,
      pseudoHistory: w.pseudo,
      universe: DATABOOK,
    });
    // Data Book loads are driven by the annual job, not the nightly reload.
    await LoaderCollection.update(loader.id, { reloadNightly: false });
    created++;
  }
  return created;
}

/**
 * Remove DATABOOK series and measurements that are no longer in the
 * manifest (e.g. year panels merged into one series, or snapshot series
 * that fell under the edition threshold). Data points, loaders and links
 * go with them. Only touches the DATABOOK universe.
 */
export async function pruneManifest(sections: ManifestSection[]): Promise<{
  series: number;
  measurements: number;
  sources: number;
  sourceDetails: number;
}> {
  const keepSeries = new Set<string>();
  const keepPrefixes = new Set<string>();
  for (const s of sections)
    for (const t of s.tables)
      for (const m of t.measurements) {
        const kept = includedSeries(m);
        if (kept.length) keepPrefixes.add(m.prefix);
        for (const x of kept) keepSeries.add(x.name);
      }

  let series = 0;
  const rows = await rawQuery<{ id: number; name: string }>(
    "SELECT id, name FROM series WHERE universe = ?",
    [DATABOOK],
  );
  for (const r of rows) {
    if (keepSeries.has(r.name)) continue;
    await SeriesCollection.delete(r.id, { force: true });
    series++;
  }

  let measurements = 0;
  const ms = await rawQuery<{ id: number; prefix: string }>(
    "SELECT id, prefix FROM measurements WHERE universe = ?",
    [DATABOOK],
  );
  for (const m of ms) {
    if (keepPrefixes.has(m.prefix)) continue;
    await MeasurementCollection.delete(m.id);
    measurements++;
  }
  // Sources / source details nothing in the universe points at any more.
  const sources = await rawQuery(
    `DELETE FROM sources WHERE universe = ?
       AND id NOT IN (SELECT source_id FROM series WHERE universe = ? AND source_id IS NOT NULL)
       AND id NOT IN (SELECT source_id FROM measurements WHERE universe = ? AND source_id IS NOT NULL)`,
    [DATABOOK, DATABOOK, DATABOOK],
  );
  const details = await rawQuery(
    `DELETE FROM source_details WHERE universe = ?
       AND id NOT IN (SELECT source_detail_id FROM series WHERE universe = ? AND source_detail_id IS NOT NULL)
       AND id NOT IN (SELECT source_detail_id FROM measurements WHERE universe = ? AND source_detail_id IS NOT NULL)`,
    [DATABOOK, DATABOOK, DATABOOK],
  );
  const affected = (r: unknown) =>
    Number((r as { affectedRows?: number }).affectedRows ?? 0);
  const out = {
    series,
    measurements,
    sources: affected(sources),
    sourceDetails: affected(details),
  };
  log.info(out, "Pruned DATABOOK rows not in the manifest");
  return out;
}
