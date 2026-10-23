/**
 * Re-run every aggregate loader whose source is daily or weekly, after the
 * 2026-10-22 Series.aggregate fixes:
 *   - week sources are spread over their days before aggregating (Rails
 *     aggregate_data_by), instead of bucketing each week by its label date;
 *   - a leading or trailing period the source data only partly covers is
 *     dropped (Rails' strict day count), instead of emitted as a partial
 *     sum/avg.
 *
 * A reload overwrites changed values but never removes a date the loader no
 * longer produces, so each loader is evaluated first: its current points
 * dated before the new output's first date or after its last are stale
 * partial periods. In
 * execute mode those rows (this loader's vintages only) are deleted, the
 * xseries is repaired, the loader reloaded, and public data points re-synced.
 * Other dates the loader no longer produces are reported, never deleted.
 *
 * Dry run by default; nothing is written without --execute.
 *
 * Usage:
 *   bun run scripts/reaggregate-day-week-sources.ts            # dry run
 *   bun run scripts/reaggregate-day-week-sources.ts --execute
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");

// "X@G.D".ts.aggregate(...), "X@G.W".ts.aggregate(...), or an explicit
// week→day interpolation feeding an aggregate.
const DAY_WEEK_SOURCE =
  /\.[DW]"\.ts\.aggregate\(|_days_interpolation\.aggregate\(/;

const ymd = (v: Date | string) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

async function main() {
  console.log(EXECUTE ? "" : "[DRY RUN]");

  const rows = await mysql<{ id: number; series_id: number }>`
    SELECT id, series_id FROM data_sources
    WHERE disabled = 0 AND eval LIKE '%aggregate(%' AND series_id IS NOT NULL
  `;

  let changedLoaders = 0;
  let staleRows = 0;
  let errors = 0;

  for (const r of rows) {
    const loader = await LoaderCollection.getById(r.id);
    if (!DAY_WEEK_SOURCE.test(loader.eval ?? "")) continue;
    const series = await SeriesCollection.getById(r.series_id);
    const label = `${series.name} [${loader.id}]`;
    try {
      const result = await EvalExecutor.run(loader.eval!, loader.universe);
      const next = result.scaledData(parseFloat(loader.scale));
      const outDates = [...next.keys()].sort();
      const firstDate = outDates[0];
      const lastDate = outDates[outDates.length - 1];

      const current = await mysql<{ date: Date | string; value: number }>`
        SELECT date, value FROM data_points
        WHERE xseries_id = ${series.xseriesId}
          AND data_source_id = ${loader.id}
          AND current = 1
      `;
      const stale: string[] = [];
      const missing: string[] = [];
      let changed = 0;
      for (const p of current) {
        const d = ymd(p.date);
        const v = next.get(d);
        if (v == null) {
          if (firstDate == null || d < firstDate || d > lastDate) stale.push(d);
          else missing.push(d);
        } else if (
          Math.abs(v - Number(p.value)) >
          1e-6 * Math.max(1, Math.abs(v))
        ) {
          changed++;
        }
      }
      if (stale.length === 0 && changed === 0 && missing.length === 0) continue;

      changedLoaders++;
      staleRows += stale.length;
      console.log(
        `${EXECUTE ? "FIX " : "will"} ${label}: ${changed} values change` +
          (stale.length ? `, stale ${stale.sort().join(" ")}` : "") +
          (missing.length
            ? `, NOT produced (kept): ${missing.sort().join(" ")}`
            : ""),
      );

      if (!EXECUTE) continue;

      if (stale.length > 0) {
        await mysql`
          DELETE FROM data_points
          WHERE xseries_id = ${series.xseriesId}
            AND data_source_id = ${loader.id}
            AND date IN ${mysql(stale)}
        `;
        await SeriesCollection.repairDataPoints({ id: series.xseriesId! });
      }
      const res = await LoaderCollection.reload({ loader, clearFirst: false });
      if (res.status === "error") {
        console.error(`ERR  ${label}: ${res.message}`);
        errors++;
      }
      const aliases = await mysql<{ id: number; universe: string }>`
        SELECT id, universe FROM series WHERE xseries_id = ${series.xseriesId}
      `;
      for (const a of aliases)
        await DataPointCollection.updatePublicDataPointsForSeries(
          a.id,
          a.universe,
        );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ERR  ${label}: ${msg}`);
      errors++;
    }
  }

  console.log(
    `\nDone. ${changedLoaders} loaders ${EXECUTE ? "reloaded" : "would change"}, ` +
      `${staleRows} stale partial-period dates ${EXECUTE ? "removed" : "to remove"}, errors: ${errors}`,
  );
  process.exit(errors ? 1 : 0);
}

await main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
