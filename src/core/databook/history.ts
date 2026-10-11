/**
 * Vintage load (plan §3.3): write every Data Book edition into udaman,
 * oldest first, each edition's points stamped with its release date
 * (`vintageDate`). `SeriesCollection.updateData` then does the vintage
 * bookkeeping: identical values are discarded, changed values demote the
 * old point and become current, and an older edition can never overwrite
 * a newer one.
 *
 * Runs per series (editions ascending within a series), several series at
 * a time. Within a series, an edition only sends the dates whose value
 * differs from what the previous edition sent — unchanged history is the
 * common case and would be discarded by updateData anyway.
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import Series from "@catalog/models/series";

import { createLogger } from "@/core/observability/logger";
import { rawQuery } from "@/lib/mysql/db";

import { DATABOOK, observedEval, pseudoEval } from "./apply";
import { getVintageIndex, latestObserved, vintageDate } from "./store";

const log = createLogger("databook.history");

export interface HistoryOptions {
  /** Only load these editions (default: all in the vintage file). */
  editions?: number[];
  /** Only these series (default: every DATABOOK series with a Data Book loader). */
  series?: string[];
  concurrency?: number;
  dryRun?: boolean;
  /** Run the public_data_points sync afterwards (default true). */
  publicSync?: boolean;
}

export interface HistoryStats {
  series: number;
  updateCalls: number;
  pointsSent: number;
  pointsInserted: number;
  pseudoSeries: number;
  errors: Array<{ series: string; error: string }>;
}

interface Target {
  name: string;
  xseriesId: number;
  observedLoaderId: number;
  pseudoLoaderId: number | null;
}

async function targets(only?: string[]): Promise<Target[]> {
  const rows = await rawQuery<{
    name: string;
    xseries_id: number;
    loader_id: number;
    eval: string;
  }>(
    `SELECT s.name, s.xseries_id, d.id AS loader_id, d.eval
       FROM series s
       JOIN data_sources d ON d.series_id = s.id
      WHERE s.universe = ? AND d.eval LIKE 'Series.load_from_databook(%'`,
    [DATABOOK],
  );
  const by = new Map<string, Target>();
  for (const r of rows) {
    let t = by.get(r.name);
    if (!t) {
      by.set(
        r.name,
        (t = {
          name: r.name,
          xseriesId: r.xseries_id,
          observedLoaderId: 0,
          pseudoLoaderId: null,
        }),
      );
    }
    if (r.eval === observedEval(r.name)) t.observedLoaderId = r.loader_id;
    else if (r.eval === pseudoEval(r.name)) t.pseudoLoaderId = r.loader_id;
  }
  const want = only ? new Set(only) : null;
  return [...by.values()].filter(
    (t) => t.observedLoaderId && (!want || want.has(t.name)),
  );
}

export async function loadHistory(
  opts: HistoryOptions = {},
): Promise<HistoryStats> {
  const index = getVintageIndex();
  const list = await targets(opts.series);
  const editionFilter = opts.editions ? new Set(opts.editions) : null;
  const stats: HistoryStats = {
    series: list.length,
    updateCalls: 0,
    pointsSent: 0,
    pointsInserted: 0,
    pseudoSeries: 0,
    errors: [],
  };
  log.info(
    { series: list.length, dryRun: !!opts.dryRun },
    "Data Book history load starting",
  );

  let done = 0;
  // Concurrent updateData calls on different series can still deadlock on
  // data_points index locks; a series is safe to replay (identical points
  // are discarded, older vintages skipped), so retry it.
  const work = async (t: Target) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await loadSeries(t);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/deadlock/i.test(msg) && attempt < 4) continue;
        stats.errors.push({ series: t.name, error: msg });
        break;
      }
    }
    if (++done % 500 === 0)
      log.info({ done, of: list.length }, "Data Book history load progress");
  };

  const loadSeries = async (t: Target) => {
    const byEdition = index.get(t.name);
    if (!byEdition) return;
    const editions = [...byEdition.keys()].sort((a, b) => a - b);
    const sent = new Map<string, number>();
    for (const edition of editions) {
      const data = byEdition.get(edition)!;
      const changed = new Map<string, number>();
      for (const [date, value] of data) {
        if (sent.get(date) !== value) changed.set(date, value);
        sent.set(date, value);
      }
      if (editionFilter && !editionFilter.has(edition)) continue;
      if (changed.size === 0) continue;
      stats.updateCalls++;
      stats.pointsSent += changed.size;
      if (opts.dryRun) continue;
      const res = await SeriesCollection.updateData({
        xseriesId: t.xseriesId,
        data: changed,
        dataSourceId: t.observedLoaderId,
        pseudoHistory: false,
        vintageAt: vintageDate(edition),
      });
      stats.pointsInserted += res.inserted;
    }

    if (t.pseudoLoaderId) {
      const observed = new Series({ name: t.name });
      observed.frequency = "year";
      observed.data = latestObserved(byEdition);
      const filled = observed.fillMissingLinear().data;
      if (filled.size > 0) {
        stats.pseudoSeries++;
        if (!opts.dryRun) {
          await SeriesCollection.updateData({
            xseriesId: t.xseriesId,
            data: filled,
            dataSourceId: t.pseudoLoaderId,
            pseudoHistory: true,
            vintageAt: vintageDate(editions[editions.length - 1]),
          });
        }
      }
    }
  };

  // Bounded concurrency; order only matters within a series.
  const limit = Math.max(1, opts.concurrency ?? 4);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) await work(list[next++]);
    }),
  );

  if (!opts.dryRun && opts.publicSync !== false)
    await DataPointCollection.updatePublicDataPoints(DATABOOK);
  log.info(
    { ...stats, errors: stats.errors.length },
    "Data Book history load complete",
  );
  return stats;
}
