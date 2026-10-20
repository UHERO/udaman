/**
 * BEA:
 *   Series.load_api_bea('A', 'Regional', TableName: 'CAINC5N', LineCode: 201, GeoFips: 15007, Year: 'ALL')
 *     → Series.load_from_extract("bea", { dataset: "Regional", table: "CAINC5N", line: "201", geo: "15007", frequency: "A" })
 *   Series.load_api_bea('Q', 'NIPA', { TableName: 'T20100', LineNumber: '1', Frequency: 'Q', Year: 'ALL' })
 *     → Series.load_from_extract("bea", { dataset: "NIPA", table: "T20100", line: "1", frequency: "Q" })
 *
 * The first argument is the frequency; GeoFips is padded to five digits.
 * Only Year 'ALL' converts (the extract keeps every year). UNIT_MULT is
 * dropped: it is not a GetData parameter, and the legacy client only
 * passed it on to the API, which ignores it. Steps and flags: ./lib.ts.
 *
 *   bun run scripts/migrate-api/bea.ts plan | stage | check | execute | restore <csv>
 */
import { fail, ok, runMigration, unknownKeys } from "./lib";
import type { MigrationSpec } from "./lib";

const KEYS = [
  "TableName",
  "LineCode",
  "LineNumber",
  "GeoFips",
  "Year",
  "Frequency",
  "UNIT_MULT",
];

export const spec: MigrationSpec = {
  handle: "bea",
  methods: ["load_api_bea"],
  convert({ positional: [freq, ds, ...rest], options: o }) {
    if (rest.length) return fail("unexpected arguments");
    const unknown = unknownKeys(o, KEYS);
    if (unknown.length)
      return fail(`unsupported parameter ${unknown.join(", ")}`);
    const frequency = (freq ?? "").trim().toUpperCase();
    if (!["A", "Q", "M"].includes(frequency))
      return fail(`frequency "${freq ?? ""}"`);
    const dataset = ["Regional", "NIPA"].find(
      (d) => d.toLowerCase() === (ds ?? "").trim().toLowerCase(),
    );
    if (!dataset) return fail(`dataset "${ds ?? ""}"`);
    if (o.Year !== undefined && o.Year.trim().toUpperCase() !== "ALL")
      return fail(`Year "${o.Year}" (only ALL)`);
    if (
      o.Frequency !== undefined &&
      o.Frequency.trim().toUpperCase() !== frequency
    )
      return fail(`Frequency "${o.Frequency}" is not the series' ${frequency}`);
    const table = (o.TableName ?? "").trim().toUpperCase();
    if (!table) return fail("no TableName");
    const line = (
      dataset === "NIPA" ? (o.LineNumber ?? o.LineCode) : o.LineCode
    )?.trim();
    if (!line || !/^\d+$/.test(line))
      return fail(`no ${dataset === "NIPA" ? "LineNumber" : "LineCode"}`);
    if (dataset === "NIPA") return ok({ dataset, table, line, frequency });
    const fips = (o.GeoFips ?? "").trim();
    if (!/^\d{1,5}$/.test(fips)) return fail(`GeoFips "${o.GeoFips ?? ""}"`);
    return ok({ dataset, table, line, geo: fips.padStart(5, "0"), frequency });
  },
};

if (import.meta.main) await runMigration(spec);
