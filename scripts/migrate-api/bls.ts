/**
 * BLS: Series.load_api_bls("CUURS24BSA0", "M") and load_api_bls_NEW(…)
 *   → Series.load_from_extract("bls", { series_id: "CUURS24BSA0", frequency: "M" })
 *
 * Both legacy methods read the same API (load_api_bls_NEW only the last 20
 * years), so either becomes the full-history extract. A call with an
 * explicit year range is left alone. Steps and flags: ./lib.ts.
 *
 *   bun run scripts/migrate-api/bls.ts plan | stage | check | execute | restore <csv>
 */
import { fail, ok, runMigration, unknownKeys } from "./lib";
import type { MigrationSpec } from "./lib";

export const spec: MigrationSpec = {
  handle: "bls",
  methods: ["load_api_bls", "load_api_bls_NEW"],
  convert({ positional: [id, freq, ...rest], options }) {
    if (rest.length) return fail("explicit year range");
    if (unknownKeys(options, []).length) return fail("unexpected options");
    const seriesId = (id ?? "").trim().toUpperCase();
    const frequency = (freq ?? "").trim().toUpperCase();
    if (!seriesId) return fail("no series id");
    if (!["A", "S", "Q", "M"].includes(frequency))
      return fail(`frequency "${freq ?? ""}"`);
    return ok({ series_id: seriesId, frequency });
  },
};

if (import.meta.main) await runMigration(spec);
