/**
 * Delete recent vintages (data_points rows) for a set of series AND every
 * series that transitively depends on them.
 *
 * 1. Run the Udaman search (default `#const_hon@ha`, expected to match 4
 *    series) to get the base set.
 * 2. Expand to all transitive dependents via
 *    SeriesCollection.getAllDependencies (same structured-dependencies walk
 *    Rails used).
 * 3. For each series, delete data_points rows whose vintage timestamp
 *    (`created_at`) is after --after. This is the same semantics as the
 *    "vintage date" option on the series delete page:
 *    `created_at > '<after>'`, compared as HST wall-clock. A bare date means
 *    midnight, so `--after=2026-09-01` removes everything loaded on or after
 *    Sept 1; pass a full `YYYY-MM-DD HH:MM:SS` to be more precise.
 * 4. Repair invariants (every date with rows must have a current row —
 *    the newest surviving vintage is promoted) and re-sync public data points.
 *
 * Dry run by default: prints what would be deleted per series. Nothing is
 * written without --execute. In execute mode the script refuses to run if the
 * base search does not match exactly --expect series (default 4), as a guard
 * against a search that drifted.
 *
 * Usage:
 *   bun run scripts/delete-vintages-after-date.ts                       # dry run
 *   bun run scripts/delete-vintages-after-date.ts --execute             # delete
 *   bun run scripts/delete-vintages-after-date.ts --search='#const_hon@ha' --after=2026-09-01
 *   bun run scripts/delete-vintages-after-date.ts --no-deps             # base series only
 *   bun run scripts/delete-vintages-after-date.ts --expect=4 --universe=UHERO
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { Universe } from "@catalog/types/shared";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");
const NO_DEPS = process.argv.includes("--no-deps");
const argVal = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const SEARCH = argVal("search") ?? "#const_hon@ha";
const AFTER = argVal("after") ?? "2026-09-01";
const UNIVERSE = (argVal("universe") ?? "UHERO") as Universe;
const EXPECT = Number(argVal("expect") ?? 4);

if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(AFTER)) {
  console.error(`--after must be YYYY-MM-DD or "YYYY-MM-DD HH:MM:SS", got "${AFTER}"`);
  process.exit(1);
}

type Row = {
  cnt: number;
  current_cnt: number;
  min_created: Date | string | null;
  max_created: Date | string | null;
  dates: number;
};

const fmt = (v: Date | string | null) =>
  v == null ? "-" : v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 19) : String(v);

async function main() {
  console.log(
    `${EXECUTE ? "" : "[DRY RUN] "}search="${SEARCH}" universe=${UNIVERSE} after="${AFTER}" deps=${!NO_DEPS}`,
  );

  // 1. Base series from the search
  const base = await SeriesCollection.search({ text: SEARCH, universe: UNIVERSE });
  console.log(`\nBase series (${base.length}):`);
  for (const s of base) console.log(`  ${s.id}\t${s.name}\txseries=${s.xseriesId}`);

  if (base.length === 0) {
    console.log("Nothing matched. Exiting.");
    process.exit(0);
  }
  if (EXECUTE && base.length !== EXPECT) {
    console.error(
      `\nRefusing to execute: search matched ${base.length} series, expected ${EXPECT}. ` +
        `Re-run with --expect=${base.length} if that is intended.`,
    );
    process.exit(1);
  }

  // 2. Expand to transitive dependents
  const baseIds = base.map((s) => s.id!).filter((id) => id != null);
  const allIds = NO_DEPS ? baseIds : await SeriesCollection.getAllDependencies(baseIds);
  const depIds = allIds.filter((id) => !baseIds.includes(id));

  const dependents = [];
  for (const id of depIds) dependents.push(await SeriesCollection.getById(id));
  dependents.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\nDependent series (${dependents.length}):`);
  for (const s of dependents) console.log(`  ${s.id}\t${s.name}\txseries=${s.xseriesId}`);

  const targets = [...base, ...dependents];

  // 3. Inspect / delete per xseries (aliases share an xseries; delete once)
  console.log(`\nVintages with created_at > '${AFTER}':`);
  const seenXseries = new Set<number>();
  let totalRows = 0;
  let totalCurrent = 0;
  let touched = 0;
  let errors = 0;
  const promotedReport: string[] = [];

  for (const s of targets) {
    const xid = s.xseriesId;
    if (s.id == null || xid == null) {
      console.log(`  SKIP ${s.name}: no xseries id`);
      continue;
    }
    if (seenXseries.has(xid)) {
      console.log(`  ---- ${s.name}: alias of an xseries already handled`);
      continue;
    }
    seenXseries.add(xid);

    try {
      const [row] = await mysql<Row>`
        SELECT COUNT(*) AS cnt,
               COALESCE(SUM(current = 1), 0) AS current_cnt,
               COUNT(DISTINCT date) AS dates,
               MIN(created_at) AS min_created,
               MAX(created_at) AS max_created
        FROM data_points
        WHERE xseries_id = ${xid} AND created_at > ${AFTER}
      `;
      const cnt = Number(row?.cnt ?? 0);
      const cur = Number(row?.current_cnt ?? 0);
      if (cnt === 0) {
        console.log(`  none ${s.name}`);
        continue;
      }
      console.log(
        `  ${EXECUTE ? "DEL " : "will"} ${s.name}: ${cnt} rows (${cur} current, ${row.dates} dates) ` +
          `created ${fmt(row.min_created)} .. ${fmt(row.max_created)}`,
      );
      totalRows += cnt;
      totalCurrent += cur;
      touched++;

      if (!EXECUTE) continue;

      // Dates that will lose their current row; used to report promotions.
      const affected = await mysql<{ date: Date | string }>`
        SELECT DISTINCT date FROM data_points
        WHERE xseries_id = ${xid} AND created_at > ${AFTER} AND current = 1
      `;
      const affectedDates = affected.map((r) =>
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      );

      await SeriesCollection.deleteDataPointsByVintage({ id: xid, u: UNIVERSE, date: AFTER });
      await SeriesCollection.repairDataPoints({ id: xid });

      if (affectedDates.length > 0) {
        const promoted = await mysql<{ date: Date | string }>`
          SELECT date FROM data_points
          WHERE xseries_id = ${xid} AND current = 1 AND date IN ${mysql(affectedDates)}
        `;
        const gone = affectedDates.length - promoted.length;
        console.log(
          `       ${promoted.length} dates fell back to an older vintage, ${gone} dates now have no data`,
        );
        if (promoted.length > 0) promotedReport.push(`${s.name}: ${promoted.length} dates`);
      }

      await DataPointCollection.updatePublicDataPointsForSeries(s.id, s.universe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERR  ${s.name}: ${msg}`);
      errors++;
    }
  }

  console.log(
    `\nDone. ${EXECUTE ? "Deleted" : "Would delete"} ${totalRows} rows (${totalCurrent} current) ` +
      `across ${touched} of ${seenXseries.size} xseries, errors: ${errors}`,
  );
  if (promotedReport.length > 0) {
    console.log("Older vintages promoted back to current (review):");
    for (const line of promotedReport) console.log(`  ${line}`);
  }
  process.exit(errors ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
