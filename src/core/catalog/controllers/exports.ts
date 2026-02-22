import "server-only";

import { createLogger } from "@/core/observability/logger";

import ExportCollection from "../collections/export-collection";
import type { ExportSeriesRow } from "../collections/export-collection";
import SeriesCollection from "../collections/series-collection";
import type { SerializedExport } from "../models/export";

const log = createLogger("catalog.exports");

// ─── Types ──────────────────────────────────────────────────────────

export interface ExportTableDataPoint {
  date: string;
  value: number | null;
  lvlChange: number | null;
  yoyPct: number | null;
}

export interface ExportTableRow {
  name: string;
  seriesId: number;
  decimals: number;
  lastThree: ExportTableDataPoint[];
  ytdPct: number | null;
  sparkData: [string, number][];
}

/** List all exports with series counts */
export async function listExports() {
  const items = await ExportCollection.list();
  return items.map((item) => ({
    ...item.export.toJSON(),
    seriesCount: item.seriesCount,
  }));
}

/** Get a single export by ID */
export async function getExport({ id }: { id: number }) {
  const exp = await ExportCollection.getById(id);
  return exp.toJSON();
}

/** Get an export with its linked series data */
export async function getExportWithSeries({
  id,
}: {
  id: number;
}): Promise<{ export: SerializedExport; series: ExportSeriesRow[] }> {
  const [exp, series] = await Promise.all([
    ExportCollection.getById(id),
    ExportCollection.getSeriesForExport(id),
  ]);
  return { export: exp.toJSON(), series };
}

/** Create a new export */
export async function createExport({ name }: { name: string }) {
  const exp = await ExportCollection.create(name);
  log.info({ id: exp.id }, `Created export: ${name}`);
  return exp.toJSON();
}

/** Update an export's name */
export async function updateExport({
  id,
  payload,
}: {
  id: number;
  payload: { name?: string };
}) {
  const exp = await ExportCollection.update(id, payload);
  log.info({ id }, `Updated export: ${exp.name}`);
  return exp.toJSON();
}

/** Add a series to an export */
export async function addSeriesToExport({
  exportId,
  seriesId,
}: {
  exportId: number;
  seriesId: number;
}) {
  await ExportCollection.addSeries(exportId, seriesId);
  log.info({ exportId, seriesId }, "Added series to export");
}

/** Remove a series from an export */
export async function removeSeriesFromExport({
  exportId,
  seriesId,
}: {
  exportId: number;
  seriesId: number;
}) {
  await ExportCollection.removeSeries(exportId, seriesId);
  log.info({ exportId, seriesId }, "Removed series from export");
}

/** Move a series up or down in an export */
export async function moveExportSeries({
  exportId,
  seriesId,
  direction,
}: {
  exportId: number;
  seriesId: number;
  direction: "up" | "down";
}) {
  await ExportCollection.moveSeries(exportId, seriesId, direction);
  log.info({ exportId, seriesId, direction }, "Moved export series");
}

/** Replace all series in an export from a list of names */
export async function replaceAllExportSeries({
  exportId,
  seriesNames,
}: {
  exportId: number;
  seriesNames: string[];
}) {
  const result = await ExportCollection.replaceAllSeries(exportId, seriesNames);
  log.info(
    { exportId, added: result.added, notFound: result.notFound.length },
    "Replaced all export series",
  );
  return result;
}

/** Get series names for an export (for edit-as-text) */
export async function getExportSeriesNames({ exportId }: { exportId: number }) {
  return ExportCollection.getSeriesNames(exportId);
}

/** Convert a Series' data Map to sorted [date, value] tuples. */
function mapToTuples(data: Map<string, number>): [string, number][] {
  return [...data.entries()]
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b));
}

/** Get table view data for an export: last 3 values, YOY%, level change, YTD%, sparkline */
export async function getExportTableData({
  id,
}: {
  id: number;
}): Promise<ExportTableRow[]> {
  const seriesRows = await ExportCollection.getSeriesForExport(id);
  log.info({ id, count: seriesRows.length }, "loading export table data");

  const rows: ExportTableRow[] = [];

  for (const row of seriesRows) {
    const series = await SeriesCollection.getById(row.seriesId);
    await SeriesCollection.loadCurrentData(series);

    const yoySeries = series.yoy();
    const diffSeries = series.diff();
    const ytdSeries = series.ytd();

    // Get sorted data entries for the last 3 observations
    const sortedEntries = [...series.data.entries()]
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b));

    const lastThreeEntries = sortedEntries.slice(-3);

    const lastThree: ExportTableDataPoint[] = lastThreeEntries.map(
      ([date, value]) => ({
        date,
        value,
        lvlChange: diffSeries.data.get(date) ?? null,
        yoyPct: yoySeries.data.get(date) ?? null,
      }),
    );

    // YTD% is the last value in the ytd series
    const ytdTuples = mapToTuples(ytdSeries.data);
    const ytdPct = ytdTuples.length > 0 ? ytdTuples.at(-1)![1] : null;

    // Spark data: last 20 observations for a compact chart
    const sparkData = mapToTuples(series.data).slice(-20);

    rows.push({
      name: series.name ?? row.name,
      seriesId: row.seriesId,
      decimals: series.decimals,
      lastThree,
      ytdPct,
      sparkData,
    });
  }

  log.info({ id, rows: rows.length }, "export table data loaded");
  return rows;
}

/** Delete an export and its join records */
export async function deleteExport({ id }: { id: number }) {
  const exp = await ExportCollection.getById(id);
  await ExportCollection.delete(id);
  log.info({ id }, `Deleted export: ${exp.name}`);
  return { success: true };
}
