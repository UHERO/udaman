/**
 * One-off cleanup for false "0" data points loaded from the BEA API.
 *
 * The bug: BEA returns flagged non-observations as `DataValue: "0"` with a
 * NoteRef code like "(NA) 3 *". Before the api-clients/bea.ts fix these
 * zeros could be persisted as real data points. The fixed client now drops
 * flagged rows entirely, so a fresh eval of each loader yields only valid
 * dates — any stored zero from that loader on a date ABSENT from the fresh
 * result is a confirmed false zero.
 *
 * For every enabled loader whose eval calls load_api_bea and which has
 * zero-valued data points, this script re-runs the loader's eval (read-only,
 * hits the BEA API with the new NA filtering) and reports / deletes the
 * stored zeros the fresh result no longer contains. Zeros the API still
 * returns as valid observations are left untouched, as are zero-valued
 * vintages under a non-zero current point (they're real revision history).
 *
 * After deleting, repairDataPoints runs per series (a date left with rows
 * but no current point is an invalid state); any date where repair promotes
 * an older non-zero vintage back to current is reported for review. Public
 * data points are re-synced for each modified series.
 *
 * Usage:
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts              # dry run
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --limit 20   # dry run, first 20 loaders
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --execute    # actually delete
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT =
  limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

type LoaderRow = {
  id: number;
  eval: string;
  series_id: number;
  series_name: string;
  xseries_id: number;
  universe: string;
};

type ZeroRow = {
  date: Date | string;
  current: number;
};

function toDateStr(d: Date | string): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

const loaders = await mysql<LoaderRow>`
  SELECT ds.id, ds.eval, s.id AS series_id, s.name AS series_name,
         s.xseries_id, s.universe
  FROM data_sources ds
  JOIN series s ON s.id = ds.series_id
  WHERE ds.eval LIKE '%load_api_bea%'
    AND ds.disabled = 0
    AND EXISTS (
      SELECT 1 FROM data_points dp
      WHERE dp.data_source_id = ds.id AND dp.value = 0
    )
  ORDER BY ds.id
`;

console.log(
  `${loaders.length} enabled BEA loaders with zero-valued data points` +
    (isFinite(LIMIT) ? ` (processing first ${LIMIT})` : "") +
    (EXECUTE ? " — EXECUTE MODE" : " — dry run"),
);

let processed = 0;
let evalFailures = 0;
let totalFalseZeros = 0;
let totalDeleted = 0;
let loadersWithFalseZeros = 0;
const resurrectedDates: string[] = [];

for (const loader of loaders) {
  if (processed >= LIMIT) break;
  processed++;

  const zeros = await mysql<ZeroRow>`
    SELECT date, current FROM data_points
    WHERE data_source_id = ${loader.id} AND value = 0
  `;
  if (zeros.length === 0) continue;

  // Re-run the loader's eval with the fixed BEA client. Its result is
  // exactly what the loader would persist today — flagged (NA/D/…) dates
  // are absent.
  let freshDates: Set<string>;
  try {
    const result = await EvalExecutor.run(loader.eval, loader.universe);
    if (result.data.size === 0) {
      console.log(
        `  [skip] loader ${loader.id} (${loader.series_name}): eval returned no data — not deleting`,
      );
      evalFailures++;
      continue;
    }
    freshDates = new Set(
      [...result.data.entries()]
        .filter(([, v]) => v != null)
        .map(([d]) => d),
    );
  } catch (e) {
    console.log(
      `  [skip] loader ${loader.id} (${loader.series_name}): eval failed — ${e instanceof Error ? e.message : e}`,
    );
    evalFailures++;
    continue;
  }

  const falseZeroDates = [
    ...new Set(
      zeros.map((z) => toDateStr(z.date)).filter((d) => !freshDates.has(d)),
    ),
  ].sort();

  if (falseZeroDates.length === 0) continue;
  loadersWithFalseZeros++;
  totalFalseZeros += falseZeroDates.length;

  console.log(
    `  loader ${loader.id} (${loader.series_name}): ${falseZeroDates.length} false-zero dates ` +
      `[${falseZeroDates[0]} … ${falseZeroDates[falseZeroDates.length - 1]}], ` +
      `${zeros.length - falseZeroDates.length} legitimate zeros kept`,
  );

  if (!EXECUTE) continue;

  const del = await mysql`
    DELETE FROM data_points
    WHERE data_source_id = ${loader.id}
      AND value = 0
      AND date IN ${mysql(falseZeroDates)}
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totalDeleted += Number((del as any).affectedRows ?? falseZeroDates.length);

  // Restore invariants: promote latest remaining vintage on dates that
  // lost their current point, and report those resurrections for review.
  await SeriesCollection.repairDataPoints({ id: loader.xseries_id });
  const promoted = await mysql<{ date: Date | string }>`
    SELECT date FROM data_points
    WHERE xseries_id = ${loader.xseries_id}
      AND current = 1
      AND date IN ${mysql(falseZeroDates)}
  `;
  for (const p of promoted) {
    const d = toDateStr(p.date);
    resurrectedDates.push(`${loader.series_name} @ ${d}`);
    console.log(
      `    [review] ${loader.series_name} @ ${d}: older non-zero vintage promoted to current`,
    );
  }

  await DataPointCollection.updatePublicDataPointsForSeries(
    loader.series_id,
    loader.universe,
  );
}

console.log("─".repeat(60));
console.log(
  `${processed} loaders processed, ${loadersWithFalseZeros} with false zeros, ` +
    `${totalFalseZeros} false-zero dates found, ${evalFailures} skipped on eval failure`,
);
if (EXECUTE) {
  console.log(`${totalDeleted} data point rows deleted`);
  console.log(
    `${resurrectedDates.length} dates had an older vintage promoted to current (review above)`,
  );
} else {
  console.log("Dry run — nothing deleted. Re-run with --execute to delete.");
}
process.exit(0);
