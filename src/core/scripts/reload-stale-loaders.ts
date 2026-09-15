/**
 * Find enabled loaders that are not on the nightly schedule and have not
 * run in the last 12 hours, then reload them.
 *
 * Usage:
 *   bun run src/core/scripts/reload-stale-loaders.ts                # dry run — list matching loaders
 *   bun run src/core/scripts/reload-stale-loaders.ts --execute      # actually reload each loader
 */
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { LoaderAttrs } from "@catalog/models/loader";
import Loader from "@catalog/models/loader";
import { mysql } from "@database/mysql";

const EXECUTE = process.argv.includes("--execute");

async function main() {
  console.log(
    `=== Reload stale loaders (${EXECUTE ? "EXECUTE" : "DRY RUN"}) ===\n`,
  );
  console.log(`Filter: enabled, not nightly, not run in last 12 hours\n`);

  const rows = await mysql<LoaderAttrs & { series_name: string }>`
    SELECT ds.*, s.name AS series_name
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    WHERE (ds.reload_nightly = 0 OR ds.reload_nightly IS NULL)
      AND ds.disabled = 0
      AND (ds.last_run_at IS NULL OR ds.last_run_at < NOW() - INTERVAL 12 HOUR)
    ORDER BY s.name
  `;

  console.log(`Found ${rows.length} matching loaders\n`);

  if (rows.length === 0) {
    process.exit(0);
  }

  for (const row of rows) {
    const evalStr = row.eval ? row.eval.slice(0, 80) : "(no eval)";
    console.log(
      `  Loader #${row.id} | ${(row as { series_name: string }).series_name} | ${evalStr}`,
    );
  }

  if (!EXECUTE) {
    console.log(`\n(dry run — pass --execute to actually reload)`);
    process.exit(0);
  }

  console.log(`\nReloading ${rows.length} loaders...\n`);

  let success = 0;
  let errors = 0;

  for (const row of rows) {
    const loader = new Loader(row);
    const seriesName = (row as { series_name: string }).series_name;
    try {
      const result = await LoaderCollection.reload({
        loader,
        clearFirst: false,
      });
      if (result.status === "success") {
        // Repair current/non-current after data changes
        if (loader.seriesId) {
          const xsRows = await mysql<{ xseries_id: number }>`
            SELECT xseries_id FROM series WHERE id = ${loader.seriesId} LIMIT 1
          `;
          if (xsRows[0]?.xseries_id) {
            await SeriesCollection.repairDataPoints({
              id: xsRows[0].xseries_id,
            });
          }
        }
        console.log(`  [ok]    #${loader.id} ${seriesName}: ${result.message}`);
        success++;
      } else if (result.status === "error") {
        console.log(`  [error] #${loader.id} ${seriesName}: ${result.message}`);
        errors++;
      } else {
        console.log(`  [skip]  #${loader.id} ${seriesName}: ${result.message}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  [error] #${loader.id} ${seriesName}: ${msg}`);
      errors++;
    }
  }

  console.log(`\n=== Done: ${success} succeeded, ${errors} failed ===`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
