/**
 * Re-date weekly aggregate series from Monday to Saturday.
 *
 * Until 2026-10-22 the TS Series.aggregate keyed weeks by their ISO Monday,
 * while Rails (and every legacy weekly series) keys a Sunday–Saturday week by
 * its ending Saturday. From the TS cutover (2026-04-06) on, every
 * `.aggregate(:week, ...)` loader wrote a full Monday-dated copy of its
 * history next to the Rails Saturday points, and stopped adding Saturdays.
 *
 * For every week-frequency series with an enabled loader whose eval
 * aggregates to :week, this script:
 *   1. deletes that xseries' Monday-dated data_points (all vintages),
 *   2. reloads the series' enabled loaders, which now write Saturdays,
 *   3. re-syncs public data points for every series row on the xseries.
 *
 * Only Monday rows on the matched xseries are touched. A series that has an
 * enabled loader which is NOT a weekly aggregate is skipped (its Monday
 * points might be legitimate) unless --include-mixed is passed.
 *
 * Dry run by default; nothing is written without --execute.
 *
 * Usage:
 *   bun run scripts/fix-weekly-aggregate-dates.ts                # dry run
 *   bun run scripts/fix-weekly-aggregate-dates.ts --execute
 *   bun run scripts/fix-weekly-aggregate-dates.ts --execute --include-mixed
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");
const INCLUDE_MIXED = process.argv.includes("--include-mixed");

const WEEKLY_AGGREGATE = /\.aggregate\(\s*:week\b/;

type Target = {
  seriesId: number;
  name: string;
  xseriesId: number;
};

async function main() {
  console.log(`${EXECUTE ? "" : "[DRY RUN] "}include-mixed=${INCLUDE_MIXED}`);

  // Week-frequency series with at least one enabled weekly-aggregate loader.
  // LIKE narrows in SQL; the regex is the real test.
  const candidates = await mysql<{
    series_id: number;
    name: string;
    xseries_id: number;
    eval: string;
  }>`
    SELECT s.id AS series_id, s.name, s.xseries_id, ds.eval
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    JOIN xseries x ON x.id = s.xseries_id
    WHERE x.frequency = 'week'
      AND ds.disabled = 0
      AND ds.eval LIKE '%aggregate%:week%'
    ORDER BY s.name
  `;

  const targets = new Map<number, Target>(); // keyed by xseries
  for (const c of candidates) {
    if (!WEEKLY_AGGREGATE.test(c.eval)) continue;
    if (targets.has(c.xseries_id)) continue;
    targets.set(c.xseries_id, {
      seriesId: c.series_id,
      name: c.name,
      xseriesId: c.xseries_id,
    });
  }
  console.log(`Found ${targets.size} weekly-aggregate xseries\n`);

  let totalRows = 0;
  let totalCurrent = 0;
  let fixed = 0;
  let clean = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of targets.values()) {
    try {
      const loaders = await LoaderCollection.getEnabledBySeriesId(t.seriesId);
      const others = loaders.filter(
        (l) => !WEEKLY_AGGREGATE.test(l.eval ?? ""),
      );
      if (others.length > 0 && !INCLUDE_MIXED) {
        console.log(
          `SKIP ${t.name}: ${others.length} other enabled loader(s): ` +
            others.map((l) => `${l.id} ${l.eval}`).join(" | "),
        );
        skipped++;
        continue;
      }

      const [row] = await mysql<{
        cnt: number;
        current_cnt: number;
        min_date: Date | string | null;
        max_date: Date | string | null;
      }>`
        SELECT COUNT(*) AS cnt,
               COALESCE(SUM(current = 1), 0) AS current_cnt,
               MIN(date) AS min_date,
               MAX(date) AS max_date
        FROM data_points
        WHERE xseries_id = ${t.xseriesId} AND DAYOFWEEK(date) = 2
      `;
      const cnt = Number(row?.cnt ?? 0);
      const cur = Number(row?.current_cnt ?? 0);
      if (cnt === 0) {
        console.log(`OK   ${t.name}: no Monday points`);
        clean++;
        continue;
      }
      const d = (v: Date | string | null) =>
        v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
      console.log(
        `${EXECUTE ? "FIX " : "will"} ${t.name}: ${cnt} Monday rows (${cur} current) ` +
          `${d(row.min_date)} .. ${d(row.max_date)}`,
      );
      totalRows += cnt;
      totalCurrent += cur;
      fixed++;

      if (!EXECUTE) continue;

      // Every vintage on a Monday goes, so no date is left without a
      // current row — no repairDataPoints needed.
      await mysql`
        DELETE FROM data_points
        WHERE xseries_id = ${t.xseriesId} AND DAYOFWEEK(date) = 2
      `;

      for (const loader of loaders) {
        const res = await LoaderCollection.reload({
          loader,
          clearFirst: false,
        });
        console.log(`       loader ${loader.id}: ${res.status} ${res.message}`);
        if (res.status === "error") errors++;
      }

      const aliases = await mysql<{ id: number; universe: string }>`
        SELECT id, universe FROM series WHERE xseries_id = ${t.xseriesId}
      `;
      for (const a of aliases)
        await DataPointCollection.updatePublicDataPointsForSeries(
          a.id,
          a.universe,
        );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ERR  ${t.name}: ${msg}`);
      errors++;
    }
  }

  console.log(
    `\nDone. ${EXECUTE ? "Deleted" : "Would delete"} ${totalRows} rows (${totalCurrent} current) ` +
      `across ${fixed} xseries; already clean: ${clean}, skipped: ${skipped}, errors: ${errors}`,
  );
  process.exit(errors ? 1 : 0);
}

await main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
