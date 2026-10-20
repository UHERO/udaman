/**
 * EIA:
 *   Series.load_api_eia_aeo(route: "aeo/2025", scenario: "ref2025", seriesId: "prce_…")
 *     → Series.load_from_extract("eia", { route: "aeo/2025", scenario: "ref2025", series_id: "prce_…", frequency: "A" })
 *   Series.load_api_eia_steo(seriesId: "WTIPUUS")
 *     → Series.load_from_extract("eia", { route: "steo", series_id: "WTIPUUS", frequency: "M" })
 *
 * The frequency is what the legacy method requested (its frequency
 * option, else annual for AEO and monthly for STEO). A value_in other than
 * "value" is left alone. Steps and flags: ./lib.ts.
 *
 *   bun run scripts/migrate-api/eia.ts plan | stage | check | execute | restore <csv>
 */
import { fail, ok, runMigration, unknownKeys } from "./lib";
import type { MigrationSpec } from "./lib";

const FREQ: Record<string, string> = {
  annual: "A",
  quarterly: "Q",
  monthly: "M",
  weekly: "W",
  daily: "D",
};

export const spec: MigrationSpec = {
  handle: "eia",
  methods: ["load_api_eia_aeo", "load_api_eia_steo"],
  convert({ method, positional, options: o }) {
    const aeo = method === "load_api_eia_aeo";
    const keys = [
      "seriesId",
      "frequency",
      "value_in",
      ...(aeo ? ["route", "scenario"] : []),
    ];
    if (positional.length || unknownKeys(o, keys).length)
      return fail("unexpected arguments");
    if (o.value_in !== undefined && o.value_in !== "value")
      return fail(`value_in "${o.value_in}"`);
    const frequency =
      FREQ[(o.frequency ?? (aeo ? "annual" : "monthly")).toLowerCase()];
    if (!frequency) return fail(`frequency "${o.frequency}"`);
    const seriesId = (o.seriesId ?? "").trim();
    if (!seriesId) return fail("no seriesId");
    if (!aeo) return ok({ route: "steo", series_id: seriesId, frequency });
    const route = (o.route ?? "").trim();
    const scenario = (o.scenario ?? "").trim();
    if (!route || !scenario) return fail("no route or scenario");
    return ok({ route, scenario, series_id: seriesId, frequency });
  },
};

if (import.meta.main) await runMigration(spec);
