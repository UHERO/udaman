/**
 * Diagnostic script: find series with stale data points from arithmetic loaders.
 *
 * When a loader eval does arithmetic between two series (e.g.
 * "A@HI.Q".ts - "B@HON.Q".ts), the result should only contain dates where
 * ALL constituent series have data. A prior bug left stale current data points
 * for non-overlapping dates.
 *
 * This script:
 *   1. Finds all enabled loaders whose eval contains arithmetic between series
 *   2. Extracts constituent series names from the eval
 *   3. Compares the target series' current data (from that loader) against
 *      the intersection of constituent series' date sets
 *   4. Reports dates where the target has data but a constituent does not
 *
 * Usage:
 *   LOG_LEVEL=warn bun run src/core/scripts/find-stale-arithmetic-data.ts           # report only
 *   LOG_LEVEL=warn bun run src/core/scripts/find-stale-arithmetic-data.ts --execute # mark stale points non-current
 *   LOG_LEVEL=warn bun run src/core/scripts/find-stale-arithmetic-data.ts --verbose # show per-series detail
 */
import EvalParser, { type EvalNode } from "@catalog/utils/eval-parser";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");
const VERBOSE = process.argv.includes("--verbose");

// ─── Types ──────────────────────────────────────────────────────────

type LoaderRow = {
  id: number;
  series_id: number;
  eval: string;
  target_name: string;
  target_xseries_id: number;
};

type DateRow = { date: Date | string };

// ─── AST helpers ────────────────────────────────────────────────────

/** Recursively check if an AST node contains an arithmetic operation. */
function hasArithmetic(node: EvalNode): boolean {
  if (node.type === "arithmetic") return true;
  if (node.type === "instance_method") return hasArithmetic(node.target);
  return false;
}

/** Recursively collect all series_ref names from an AST node. */
function collectSeriesRefs(node: EvalNode, refs: Set<string>): void {
  switch (node.type) {
    case "series_ref":
      refs.add(node.name);
      break;
    case "arithmetic":
      collectSeriesRefs(node.left, refs);
      collectSeriesRefs(node.right, refs);
      break;
    case "instance_method":
      collectSeriesRefs(node.target, refs);
      for (const arg of node.args) {
        if (arg.type === "expression") collectSeriesRefs(arg.node, refs);
        if (arg.type === "series_ref") refs.add(arg.name);
      }
      break;
    case "static_method":
      for (const arg of node.args) {
        if (arg.type === "expression") collectSeriesRefs(arg.node, refs);
        if (arg.type === "series_ref") refs.add(arg.name);
      }
      break;
  }
}

function fmtDate(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n${"=".repeat(60)}\n  Find stale arithmetic data points\n${"=".repeat(60)}\n`,
  );
  if (!EXECUTE) {
    console.log(
      "  (dry run — pass --execute to mark stale points non-current)\n",
    );
  }

  // 1. Find all enabled loaders with eval expressions
  const loaders = await mysql<LoaderRow>`
    SELECT ds.id, ds.series_id, ds.eval,
           s.name AS target_name,
           s.xseries_id AS target_xseries_id
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    WHERE ds.disabled = 0
      AND ds.eval IS NOT NULL
      AND ds.eval != ''
      AND ds.series_id IS NOT NULL
  `;

  console.log(
    `Found ${loaders.length} enabled loaders with eval expressions.\n`,
  );

  // 2. Filter to loaders whose eval contains arithmetic between series
  type ArithmeticLoader = LoaderRow & { constituentNames: string[] };
  const arithmeticLoaders: ArithmeticLoader[] = [];

  for (const loader of loaders) {
    try {
      const ast = EvalParser.parse(loader.eval);
      if (!hasArithmetic(ast)) continue;

      const refs = new Set<string>();
      collectSeriesRefs(ast, refs);
      if (refs.size < 2) continue; // Need at least 2 series for arithmetic to matter

      arithmeticLoaders.push({
        ...loader,
        constituentNames: [...refs],
      });
    } catch {
      // Parse errors — skip
    }
  }

  console.log(
    `Of those, ${arithmeticLoaders.length} involve arithmetic between 2+ series.\n`,
  );

  // 3. For each arithmetic loader, compare target data vs constituent intersection
  let totalStale = 0;
  let affectedSeries = 0;

  for (const loader of arithmeticLoaders) {
    // Get current dates for each constituent series
    const constituentDateSets: Map<string, Set<string>> = new Map();
    let allFound = true;

    for (const name of loader.constituentNames) {
      const rows = await mysql<DateRow>`
        SELECT dp.date
        FROM data_points dp
        JOIN xseries x ON x.id = dp.xseries_id
        JOIN series s ON s.xseries_id = x.id
        WHERE s.name = ${name} AND dp.current = 1 AND dp.value IS NOT NULL
      `;

      if (rows.length === 0) {
        if (VERBOSE) {
          console.log(
            `  [skip] Loader ${loader.id} (${loader.target_name}): constituent ${name} has no current data`,
          );
        }
        allFound = false;
        break;
      }

      const dates = new Set(rows.map((r) => fmtDate(r.date)));
      constituentDateSets.set(name, dates);
    }

    if (!allFound) continue;

    // Compute intersection of all constituent date sets
    const sets = Array.from(constituentDateSets.values());
    const intersection = new Set<string>(
      Array.from(sets[0]).filter((d) => sets.every((s) => s.has(d))),
    );

    // Get current data points for the target series FROM THIS LOADER
    const targetRows = await mysql<DateRow>`
      SELECT dp.date
      FROM data_points dp
      WHERE dp.xseries_id = ${loader.target_xseries_id}
        AND dp.data_source_id = ${loader.id}
        AND dp.current = 1
    `;

    const targetDates = targetRows.map((r) => fmtDate(r.date));

    // Find stale dates: in target but NOT in intersection
    const staleDates = targetDates.filter((d) => !intersection.has(d));

    if (staleDates.length === 0) continue;

    affectedSeries++;
    totalStale += staleDates.length;

    console.log(`  Loader ${loader.id} → ${loader.target_name}`);
    console.log(
      `    Eval: ${loader.eval.length > 80 ? loader.eval.slice(0, 77) + "..." : loader.eval}`,
    );
    console.log(`    Constituents: ${loader.constituentNames.join(", ")}`);
    console.log(`    Intersection dates: ${intersection.size}`);
    console.log(`    Target dates (from this loader): ${targetDates.length}`);
    console.log(`    Stale dates: ${staleDates.length}`);

    if (VERBOSE && staleDates.length <= 20) {
      console.log(`    Stale: ${staleDates.sort().join(", ")}`);
    } else if (VERBOSE) {
      const sorted = staleDates.sort();
      console.log(
        `    Stale range: ${sorted[0]} … ${sorted[sorted.length - 1]}`,
      );
    }

    // Mark stale points non-current if --execute
    if (EXECUTE) {
      for (const dateStr of staleDates) {
        await mysql`
          UPDATE data_points SET current = 0
          WHERE xseries_id = ${loader.target_xseries_id}
            AND date = ${dateStr}
            AND data_source_id = ${loader.id}
            AND current = 1
        `;
      }
      console.log(`    → Marked ${staleDates.length} points non-current`);
    }

    console.log();
  }

  // Summary
  console.log(`${"─".repeat(60)}`);
  console.log(`Summary:`);
  console.log(`  Arithmetic loaders checked: ${arithmeticLoaders.length}`);
  console.log(`  Affected series: ${affectedSeries}`);
  console.log(`  Total stale data points: ${totalStale}`);

  if (totalStale > 0 && !EXECUTE) {
    console.log(`\n  Run with --execute to mark stale points non-current.`);
  } else if (totalStale > 0 && EXECUTE) {
    console.log(`\n  All stale points marked non-current.`);
  } else {
    console.log(`\n  No stale data found.`);
  }

  console.log();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
