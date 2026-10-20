/**
 * FRED: Series.load_api_fred("MORTGAGE30US", "Q", "avg")
 *   → Series.load_from_extract("fred", { series_id: "MORTGAGE30US", frequency: "Q", aggregation: "avg" })
 *
 * The aggregation is kept when the statement gives one (FRED's default,
 * avg, otherwise, as before). A statement without a frequency (FRED's
 * native one) is left alone. Steps and flags: ./lib.ts.
 *
 *   bun run scripts/migrate-api/fred.ts plan | stage | check | execute | restore <csv>
 */
import {
  FRED_AGGREGATIONS,
  FRED_FREQUENCY,
} from "@catalog/utils/api-clients/fred";

import { fail, ok, runMigration, unknownKeys } from "./lib";
import type { MigrationSpec } from "./lib";

export const spec: MigrationSpec = {
  handle: "fred",
  methods: ["load_api_fred"],
  convert({ positional: [id, freq, agg, ...rest], options }) {
    if (rest.length || unknownKeys(options, []).length)
      return fail("unexpected arguments");
    const seriesId = (id ?? "").trim().toUpperCase();
    const frequency = (freq ?? "").trim().toUpperCase();
    if (!seriesId) return fail("no series id");
    if (!FRED_FREQUENCY[frequency])
      return fail(`frequency "${freq ?? ""}" (FRED's native frequency)`);
    const filters: Record<string, string> = {
      series_id: seriesId,
      frequency,
    };
    if (agg !== undefined && agg.trim() !== "") {
      const aggregation = agg.trim().toLowerCase();
      if (!(FRED_AGGREGATIONS as readonly string[]).includes(aggregation))
        return fail(`aggregation "${agg}"`);
      filters.aggregation = aggregation;
    }
    return ok(filters);
  },
};

if (import.meta.main) await runMigration(spec);
