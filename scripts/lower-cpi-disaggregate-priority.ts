/**
 * For every series matching the search `cpi #disaggregate` that has exactly
 * two enabled loaders, set the loader whose eval contains "disaggregate" to a
 * lower priority than the other loader.
 *
 * Priority semantics: higher number wins (see SeriesCollection data-point
 * priority checks). So "lower priority" means a smaller number than the
 * sibling loader.
 *
 * Usage: bun run scripts/lower-cpi-disaggregate-priority.ts [--dry-run] [--universe=UHERO] [--gap=10]
 */
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";

const DRY_RUN = process.argv.includes("--dry-run");
const argVal = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const UNIVERSE = argVal("universe") ?? "UHERO";
const GAP = Number(argVal("gap") ?? 10);
const SEARCH = "cpi #disaggregate";

async function main() {
  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Searching "${SEARCH}" in ${UNIVERSE}, gap=${GAP}`,
  );

  const series = await SeriesCollection.search({
    text: SEARCH,
    universe: UNIVERSE,
  });
  console.log(`Found ${series.length} series\n`);

  let updated = 0;
  let alreadyLower = 0;
  let skipped = 0;
  let errors = 0;

  for (const s of series) {
    try {
      if (s.id == null) continue;
      const loaders = await LoaderCollection.getEnabledBySeriesId(s.id);
      if (loaders.length !== 2) {
        console.log(`SKIP ${s.name}: ${loaders.length} enabled loaders`);
        skipped++;
        continue;
      }

      const disagg = loaders.filter((l) => /disaggregate/i.test(l.eval ?? ""));
      if (disagg.length !== 1) {
        console.log(
          `SKIP ${s.name}: ${disagg.length} loaders with "disaggregate" in eval`,
        );
        skipped++;
        continue;
      }

      const target = disagg[0];
      const other = loaders.find((l) => l.id !== target.id)!;

      if (target.priority < other.priority) {
        console.log(
          `OK   ${s.name}: disaggregate loader ${target.id} (${target.priority}) already below loader ${other.id} (${other.priority})`,
        );
        alreadyLower++;
        continue;
      }

      const newPriority = other.priority - GAP;
      console.log(
        `SET  ${s.name}: loader ${target.id} priority ${target.priority} -> ${newPriority} (other loader ${other.id} = ${other.priority})`,
      );
      if (!DRY_RUN) {
        await LoaderCollection.update(target.id, { priority: newPriority });
      }
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ERR  ${s.name}: ${msg}`);
      errors++;
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? "Would update" : "Updated"}: ${updated}, already lower: ${alreadyLower}, skipped: ${skipped}, errors: ${errors}`,
  );
  process.exit(errors ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
