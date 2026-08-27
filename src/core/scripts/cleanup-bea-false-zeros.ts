/**
 * One-off cleanup for false data points rooted in BEA's flagged
 * non-observations (`DataValue: "0"` + NoteRef "(NA)", "(D)", …).
 *
 * ── Default pass (BEA loaders) ──────────────────────────────────────
 * Two corruptions on loaders that call load_api_bea directly:
 *
 *  1. False zeros — the flagged "0" persisted as a real data point.
 *  2. Scaled sentinels — the legacy pipeline turned flagged rows into a
 *     1.0e15 sentinel, and a non-sentinel-aware scaling step (e.g.
 *     scale=0.001) produced values like 1.0e12 that slipped past
 *     updateData's exact `=== 1e15` check (e.g. YLAD@HAW.A).
 *
 * Sentinel artifacts (value = 1e15 × loader scale, computed in SQL so
 * decimal math stays exact) are deleted unconditionally — they are
 * markers, never real observations. Stored zeros are deleted only when a
 * fresh eval of the loader (which hits the BEA API with the fixed,
 * NA-filtering client) no longer returns that date.
 *
 * ── --derived pass ──────────────────────────────────────────────────
 * Calculated loaders (sums, convert_to_real, ratios, mtd, …) ingested
 * the scaled sentinels from their BEA-loaded inputs and persisted huge
 * derived garbage (~1e11 and far beyond). For every enabled loader with
 * data points ABS(value) >= threshold (default 1e11), this pass re-runs
 * the loader's eval and deletes each suspect row ONLY if the fresh
 * result does not reproduce its value (absent date or different value).
 * Rows the eval still reproduces are reported as [still-dirty] and kept
 * — that means the loader's inputs haven't been cleaned yet, so run the
 * default pass (and reload sources) BEFORE --derived. Legitimately huge
 * series (e.g. yen-denominated) reproduce their values and are safe.
 *
 * Garbage propagates through dependency chains (BEA → sum → real → …),
 * and evals read their inputs' STORED data, so each cleanup round only
 * reaches one level deeper. With --execute the pass loops automatically
 * until a round deletes nothing, handling arbitrarily deep chains in a
 * single invocation. A dry run shows only the first wave — deeper levels
 * appear as [still-dirty] until their inputs are actually cleaned.
 *
 * Both passes then run repairDataPoints per series (a date left with
 * rows but no current point is an invalid state); dates where repair
 * promotes an older vintage back to current are reported for review.
 * Public data points are re-synced for each modified series.
 *
 * Usage:
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts                       # dry run, BEA pass
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --limit 20            # dry run, first 20 loaders
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --execute             # BEA pass, delete
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --derived             # dry run, derived pass
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --derived --execute   # derived pass, delete
 *   bun run src/core/scripts/cleanup-bea-false-zeros.ts --derived --threshold 1e10
 */
import DataPointCollection from "@catalog/collections/data-point-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");
const DERIVED = process.argv.includes("--derived");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT =
  limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;
const thresholdIdx = process.argv.indexOf("--threshold");
const THRESHOLD =
  thresholdIdx >= 0 ? parseFloat(process.argv[thresholdIdx + 1]) : 1e11;

type LoaderRow = {
  id: number;
  eval: string;
  series_id: number;
  series_name: string;
  xseries_id: number;
  universe: string;
};

type DateRow = { date: Date | string };

function toDateStr(d: Date | string): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

/** Value equality with relative tolerance — stored values are rounded to 6
 *  decimals, and at ~1e12 magnitudes exact float comparison is unreliable. */
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
}

let evalFailures = 0;
let totalDeleted = 0;
const resurrectedDates: string[] = [];

/** Delete rows, then restore invariants and re-sync public data points. */
async function finalizeLoader(
  loader: LoaderRow,
  affectedDates: string[],
): Promise<void> {
  await SeriesCollection.repairDataPoints({ id: loader.xseries_id });
  const promoted = await mysql<DateRow>`
    SELECT date FROM data_points
    WHERE xseries_id = ${loader.xseries_id}
      AND current = 1
      AND date IN ${mysql(affectedDates)}
  `;
  for (const p of promoted) {
    const d = toDateStr(p.date);
    resurrectedDates.push(`${loader.series_name} @ ${d}`);
    console.log(
      `    [review] ${loader.series_name} @ ${d}: older vintage promoted to current`,
    );
  }
  await DataPointCollection.updatePublicDataPointsForSeries(
    loader.series_id,
    loader.universe,
  );
}

/** Fresh eval of the loader → date→value map, or null on failure/empty. */
async function freshEval(
  loader: LoaderRow,
  label: string,
): Promise<Map<string, number> | null> {
  try {
    const result = await EvalExecutor.run(loader.eval, loader.universe);
    if (result.data.size === 0) {
      console.log(
        `  [skip-${label}] loader ${loader.id} (${loader.series_name}): eval returned no data`,
      );
      evalFailures++;
      return null;
    }
    return result.data;
  } catch (e) {
    console.log(
      `  [skip-${label}] loader ${loader.id} (${loader.series_name}): eval failed — ${e instanceof Error ? e.message : e}`,
    );
    evalFailures++;
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────── */
/*  Default pass: BEA loaders (false zeros + scaled sentinels)         */
/* ────────────────────────────────────────────────────────────────── */

async function beaPass(): Promise<void> {
  const loaders = await mysql<LoaderRow>`
    SELECT ds.id, ds.eval, s.id AS series_id, s.name AS series_name,
           s.xseries_id, s.universe
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    WHERE ds.eval LIKE '%load_api_bea%'
      AND ds.disabled = 0
      AND EXISTS (
        SELECT 1 FROM data_points dp
        WHERE dp.data_source_id = ds.id
          AND (dp.value = 0 OR dp.value = 1e15 * COALESCE(ds.scale, 1))
      )
    ORDER BY ds.id
  `;

  console.log(
    `${loaders.length} enabled BEA loaders with zero or sentinel-artifact data points` +
      (isFinite(LIMIT) ? ` (processing first ${LIMIT})` : "") +
      (EXECUTE ? " — EXECUTE MODE" : " — dry run"),
  );

  let processed = 0;
  let totalFalseZeros = 0;
  let totalArtifacts = 0;
  let loadersTouched = 0;

  for (const loader of loaders) {
    if (processed >= LIMIT) break;
    processed++;

    // Sentinel artifacts: 1e15 × scale, never a real observation
    const artifactRows = await mysql<DateRow>`
      SELECT dp.date
      FROM data_points dp
      JOIN data_sources ds ON ds.id = dp.data_source_id
      WHERE dp.data_source_id = ${loader.id}
        AND dp.value = 1e15 * COALESCE(ds.scale, 1)
    `;
    const artifactDates = [
      ...new Set(artifactRows.map((r) => toDateStr(r.date))),
    ].sort();

    // False zeros: stored 0 on a date the fixed fetch no longer returns
    const zeros = await mysql<DateRow>`
      SELECT date FROM data_points
      WHERE data_source_id = ${loader.id} AND value = 0
    `;

    let falseZeroDates: string[] = [];
    if (zeros.length > 0) {
      const fresh = await freshEval(loader, "zeros");
      if (fresh) {
        const freshDates = new Set(
          [...fresh.entries()].filter(([, v]) => v != null).map(([d]) => d),
        );
        falseZeroDates = [
          ...new Set(
            zeros
              .map((z) => toDateStr(z.date))
              .filter((d) => !freshDates.has(d)),
          ),
        ].sort();
      }
    }

    if (artifactDates.length === 0 && falseZeroDates.length === 0) continue;
    loadersTouched++;
    totalArtifacts += artifactDates.length;
    totalFalseZeros += falseZeroDates.length;

    const parts: string[] = [];
    if (artifactDates.length > 0) {
      parts.push(
        `${artifactDates.length} sentinel artifacts [${artifactDates[0]} … ${artifactDates[artifactDates.length - 1]}]`,
      );
    }
    if (falseZeroDates.length > 0) {
      parts.push(
        `${falseZeroDates.length} false-zero dates [${falseZeroDates[0]} … ${falseZeroDates[falseZeroDates.length - 1]}], ` +
          `${zeros.length - falseZeroDates.length} legitimate zeros kept`,
      );
    }
    console.log(
      `  loader ${loader.id} (${loader.series_name}): ${parts.join("; ")}`,
    );

    if (!EXECUTE) continue;

    if (artifactDates.length > 0) {
      const del = await mysql`
        DELETE dp FROM data_points dp
        JOIN data_sources ds ON ds.id = dp.data_source_id
        WHERE dp.data_source_id = ${loader.id}
          AND dp.value = 1e15 * COALESCE(ds.scale, 1)
      `;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalDeleted += Number((del as any).affectedRows ?? artifactRows.length);
    }
    if (falseZeroDates.length > 0) {
      const del = await mysql`
        DELETE FROM data_points
        WHERE data_source_id = ${loader.id}
          AND value = 0
          AND date IN ${mysql(falseZeroDates)}
      `;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalDeleted += Number((del as any).affectedRows ?? falseZeroDates.length);
    }

    await finalizeLoader(loader, [
      ...new Set([...artifactDates, ...falseZeroDates]),
    ]);
  }

  console.log("─".repeat(60));
  console.log(
    `${processed} loaders processed, ${loadersTouched} with bad points, ` +
      `${totalArtifacts} sentinel artifacts + ${totalFalseZeros} false-zero dates found, ` +
      `${evalFailures} zero-comparisons skipped on eval failure`,
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  --derived pass: garbage propagated into calculated loaders         */
/* ────────────────────────────────────────────────────────────────── */

/** One round of the derived pass. Returns rows deleted this round —
 *  garbage propagates through dependency chains (A → B → C), and a
 *  loader's eval reads its inputs' STORED data, so a dependent's garbage
 *  only stops being "reproduced" after its inputs are cleaned. The caller
 *  loops rounds until convergence instead of relying on processing order
 *  (series.dependency_depth is unmaintained — 0 for these series). */
async function derivedPass(): Promise<number> {
  type SuspectRow = DateRow & { value: number; current: number };
  const deletedBefore = totalDeleted;

  const loaders = await mysql<LoaderRow>`
    SELECT ds.id, ds.eval, s.id AS series_id, s.name AS series_name,
           s.xseries_id, s.universe
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    WHERE ds.disabled = 0
      AND EXISTS (
        SELECT 1 FROM data_points dp
        WHERE dp.data_source_id = ds.id AND ABS(dp.value) >= ${THRESHOLD}
      )
    ORDER BY ds.id
  `;

  // Garbage rows nothing can re-eval — surface for manual review
  const [orphans] = await mysql<{ n: number; series_n: number }>`
    SELECT COUNT(*) AS n, COUNT(DISTINCT dp.xseries_id) AS series_n
    FROM data_points dp
    LEFT JOIN data_sources ds ON ds.id = dp.data_source_id
    WHERE ABS(dp.value) >= ${THRESHOLD}
      AND (ds.id IS NULL OR ds.disabled = 1)
  `;
  if (Number(orphans.n) > 0) {
    console.log(
      `[manual review] ${orphans.n} rows >= ${THRESHOLD} across ${orphans.series_n} series ` +
        `belong to missing/disabled loaders and cannot be verified by re-eval`,
    );
  }

  console.log(
    `${loaders.length} enabled loaders with data points ABS(value) >= ${THRESHOLD}` +
      (isFinite(LIMIT) ? ` (processing first ${LIMIT})` : "") +
      (EXECUTE ? " — EXECUTE MODE" : " — dry run"),
  );

  let processed = 0;
  let loadersTouched = 0;
  let totalGarbage = 0;
  let totalStillDirty = 0;

  for (const loader of loaders) {
    if (processed >= LIMIT) break;
    processed++;

    const suspects = await mysql<SuspectRow>`
      SELECT date, value, current FROM data_points
      WHERE data_source_id = ${loader.id} AND ABS(value) >= ${THRESHOLD}
    `;
    if (suspects.length === 0) continue;

    const fresh = await freshEval(loader, "derived");
    if (!fresh) continue;

    // A suspect row is garbage iff the fresh eval does not reproduce it.
    // Reproduced rows are either legitimately huge (keep, no report) when
    // still-produced-and-current, or a sign the loader's inputs are still
    // dirty. Group by date: only delete dates where every suspect row
    // failed reproduction, so we never orphan a partially-verified date.
    const garbageDates = new Set<string>();
    const stillDirtyDates = new Set<string>();
    for (const row of suspects) {
      const d = toDateStr(row.date);
      const freshValue = fresh.get(d);
      if (freshValue != null && approxEqual(freshValue, Number(row.value))) {
        stillDirtyDates.add(d);
      } else {
        garbageDates.add(d);
      }
    }
    for (const d of stillDirtyDates) garbageDates.delete(d);
    const garbage = [...garbageDates].sort();

    if (garbage.length === 0 && stillDirtyDates.size === 0) continue;
    if (stillDirtyDates.size > 0) {
      totalStillDirty += stillDirtyDates.size;
      console.log(
        `  [still-dirty] loader ${loader.id} (${loader.series_name}): ` +
          `${stillDirtyDates.size} dates still reproduced by eval — clean this loader's inputs first`,
      );
    }
    if (garbage.length === 0) continue;

    loadersTouched++;
    totalGarbage += garbage.length;
    console.log(
      `  loader ${loader.id} (${loader.series_name}): ${garbage.length} garbage dates ` +
        `[${garbage[0]} … ${garbage[garbage.length - 1]}] not reproduced by fresh eval`,
    );

    if (!EXECUTE) continue;

    const del = await mysql`
      DELETE FROM data_points
      WHERE data_source_id = ${loader.id}
        AND ABS(value) >= ${THRESHOLD}
        AND date IN ${mysql(garbage)}
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalDeleted += Number((del as any).affectedRows ?? garbage.length);

    await finalizeLoader(loader, garbage);
  }

  console.log("─".repeat(60));
  console.log(
    `${processed} loaders processed, ${loadersTouched} with deletable garbage, ` +
      `${totalGarbage} garbage dates found, ${totalStillDirty} still-dirty dates kept, ` +
      `${evalFailures} loaders skipped on eval failure`,
  );
  return totalDeleted - deletedBefore;
}

/* ────────────────────────────────────────────────────────────────── */

if (DERIVED) {
  if (EXECUTE) {
    // Garbage propagates through dependency chains; each round cleans one
    // level. Loop until a round deletes nothing.
    const MAX_ROUNDS = 10;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`═══ Derived pass, round ${round} ═══`);
      const deleted = await derivedPass();
      if (deleted === 0) {
        console.log(`Converged after ${round} round(s) — nothing deleted this round.`);
        break;
      }
      if (round === MAX_ROUNDS) {
        console.log(
          `Stopped at round cap (${MAX_ROUNDS}) with deletions still occurring — re-run to continue.`,
        );
      }
    }
  } else {
    await derivedPass();
    console.log(
      "Note: [still-dirty] rows whose inputs are themselves dirty become deletable once " +
        "those inputs are cleaned. --execute loops rounds automatically until convergence, " +
        "so multi-level dependency chains are handled in a single invocation.",
    );
  }
} else {
  await beaPass();
}

if (EXECUTE) {
  console.log(`${totalDeleted} data point rows deleted`);
  console.log(
    `${resurrectedDates.length} dates had an older vintage promoted to current (review above)`,
  );
} else {
  console.log("Dry run — nothing deleted. Re-run with --execute to delete.");
}
process.exit(0);
