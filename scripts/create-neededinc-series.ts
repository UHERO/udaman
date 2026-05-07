/**
 * Creates or updates NEEDEDINC series for every zip/county geography
 * in the HHF universe, replacing factbook loaders with eval-based loaders.
 *
 * Source R formulas:
 *   i = (rate/100)/12
 *   monthly_sfr = (medpricebk_SFR * 0.8) * (i*(1+i)^360) / ((1+i)^360 - 1)
 *   monthly_cnd = (medpricebk_CND * 0.8) * (i*(1+i)^360) / ((1+i)^360 - 1)
 *   neededinc_sfr       = round(monthly_sfr * 12 / 0.3, 0)
 *   neededinc_cnd       = round(monthly_cnd * 12 / 0.3, 0)
 *   neededinc_rent      = round(medrent_acs * 12 / 0.3, 0)
 *   neededinc_rent_craig = round(medrent_craig * 12 / 0.3, 0)
 *
 * Rate series: RMORT@US.A (aliased into HHF universe)
 * 0.8 * 40 = 32 (combined LTV factor * income-to-rent ratio)
 *
 * Usage: bun run scripts/create-neededinc-series.ts [--dry-run]
 */
import { mysql } from "@/lib/mysql/db";
import LoaderCollection from "@catalog/collections/loader-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import SeriesCollection from "@catalog/collections/series-collection";

const DRY_RUN = process.argv.includes("--dry-run");
const UNIVERSE = "HHF";

// ─── Series definitions ──────────────────────────────────────────────

type SeriesDef = {
  prefix: string;
  evalTemplate: (geo: string) => string;
  decimals: number;
};

const SERIES_DEFS: SeriesDef[] = [
  {
    prefix: "NEEDEDINC_RENT",
    evalTemplate: (geo) => `"MEDRENT_ACS@${geo}.A".ts * 12 / 0.3`,
    decimals: 0,
  },
  {
    prefix: "NEEDEDINC_RENT_CRAIG",
    evalTemplate: (geo) => `"MEDRENT_CRAIG@${geo}.A".ts * 12 / 0.3`,
    decimals: 0,
  },
  {
    // neededinc_sfr = price * 0.8 * i * (1+i)^360 / ((1+i)^360 - 1) * 40
    // Combined: price * 32 * i * (1+i)^360 / ((1+i)^360 - 1)
    prefix: "NEEDEDINC_SFR",
    evalTemplate: (geo) =>
      `"MEDPRICEBK_SFR@${geo}.A".ts * 32 * ("RMORT@US.A".ts / 1200) * (("RMORT@US.A".ts / 1200 + 1) ** 360) / (("RMORT@US.A".ts / 1200 + 1) ** 360 - 1)`,
    decimals: 0,
  },
  {
    prefix: "NEEDEDINC_CND",
    evalTemplate: (geo) =>
      `"MEDPRICEBK_CND@${geo}.A".ts * 32 * ("RMORT@US.A".ts / 1200) * (("RMORT@US.A".ts / 1200 + 1) ** 360) / (("RMORT@US.A".ts / 1200 + 1) ** 360 - 1)`,
    decimals: 0,
  },
];

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  // 1. Get all zip/county geographies in HHF
  const geos = await mysql<{ id: number; handle: string }>`
    SELECT id, handle FROM geographies
    WHERE universe = ${UNIVERSE}
      AND geotype IN ('zipcode', 'county')
    ORDER BY handle
  `;

  if (geos.length === 0) {
    console.error("No zip/county geographies found in HHF universe");
    process.exit(1);
  }

  console.log(`Found ${geos.length} geographies (zip/county) in HHF`);

  // 2. Look up measurements for each prefix
  const measurementIds = new Map<string, number>();
  for (const def of SERIES_DEFS) {
    try {
      const m = await MeasurementCollection.getByPrefix(def.prefix, UNIVERSE);
      measurementIds.set(def.prefix, m.id);
      console.log(`Found measurement ${def.prefix} (id=${m.id})`);
    } catch {
      console.error(
        `Measurement ${def.prefix} not found in ${UNIVERSE} — run the seed first`,
      );
      process.exit(1);
    }
  }

  // 3. Dry run: preview what would be created
  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    for (const def of SERIES_DEFS) {
      console.log(`\n${def.prefix}:`);
      const sample = geos[0];
      const name = `${def.prefix}@${sample.handle}.A`;
      const evalCode = def.evalTemplate(sample.handle);
      console.log(`  e.g. ${name}`);
      console.log(`  eval: ${evalCode}`);
      console.log(`  × ${geos.length} geographies`);
    }
    console.log(
      `\nWould create/update up to ${SERIES_DEFS.length * geos.length} series. Run without --dry-run to execute.`,
    );
    process.exit(0);
  }

  // 4. Create or update series + loaders
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const def of SERIES_DEFS) {
    let created = 0;
    let updated = 0;
    let errors = 0;
    const measurementId = measurementIds.get(def.prefix)!;

    console.log(`\nProcessing ${def.prefix} series...`);

    for (const geo of geos) {
      const name = `${def.prefix}@${geo.handle}.A`;
      const evalCode = def.evalTemplate(geo.handle);

      try {
        // Check if series already exists
        const existing = await SeriesCollection.findByNameAndUniverse(
          name,
          UNIVERSE,
        );

        if (existing) {
          const seriesId = existing.id!;

          // Find and update existing HHF loader, or create one
          const loaders = await LoaderCollection.getBySeriesId(seriesId);
          const hhfLoader = loaders.find((l) => l.universe === UNIVERSE);

          if (hhfLoader) {
            if (hhfLoader.eval !== evalCode) {
              await LoaderCollection.update(hhfLoader.id, { eval: evalCode });
              updated++;
            }
            // eval already correct — nothing to do
          } else {
            await LoaderCollection.create({
              seriesId,
              code: evalCode,
              priority: 0,
              scale: 1,
              presaveHook: "",
              clearBeforeLoad: false,
              pseudoHistory: false,
              universe: UNIVERSE,
            });
            updated++;
          }

          // Ensure measurement link exists
          await MeasurementCollection.addSeries(measurementId, seriesId);
        } else {
          // Create new series
          const series = await SeriesCollection.create({
            universe: UNIVERSE,
            name,
            frequency: "year",
            geographyId: geo.id,
            decimals: def.decimals,
          });

          const seriesId = series.id!;
          await MeasurementCollection.addSeries(measurementId, seriesId);

          await LoaderCollection.create({
            seriesId,
            code: evalCode,
            priority: 0,
            scale: 1,
            presaveHook: "",
            clearBeforeLoad: false,
            pseudoHistory: false,
            universe: UNIVERSE,
          });

          created++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR ${name}: ${msg}`);
        errors++;
      }
    }

    console.log(
      `  ${def.prefix}: ${created} created, ${updated} updated, ${errors} errors`,
    );
    totalCreated += created;
    totalUpdated += updated;
    totalErrors += errors;
  }

  console.log(
    `\nDone. Created: ${totalCreated}, Updated: ${totalUpdated}, Errors: ${totalErrors}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
