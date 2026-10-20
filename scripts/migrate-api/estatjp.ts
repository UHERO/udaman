/**
 * Japan e-Stat:
 *   Series.load_api_estatjp('0003005798', area: '00000', tab: '01', cat01: '000', cat02: '08', cat03: '0')
 *     → Series.load_from_extract("estatjp", { stats_data_id: "0003005798", tab: "01", cat01: "000", cat02: "08", cat03: "0", area: "00000" })
 *
 * Codes are copied as written. A classification the statement leaves out
 * stays out; the check fails it if that leaves the extract ambiguous.
 * Steps and flags: ./lib.ts.
 *
 *   bun run scripts/migrate-api/estatjp.ts plan | stage | check | execute | restore <csv>
 */
import { ESTAT_CLASSES } from "@/core/ingest/sources/estatjp";

import { fail, ok, runMigration, unknownKeys } from "./lib";
import type { MigrationSpec } from "./lib";

export const spec: MigrationSpec = {
  handle: "estatjp",
  methods: ["load_api_estatjp"],
  convert({ positional: [id, ...rest], options }) {
    if (rest.length) return fail("unexpected arguments");
    const unknown = unknownKeys(options, ESTAT_CLASSES);
    if (unknown.length)
      return fail(`unsupported classification ${unknown.join(", ")}`);
    const statsDataId = (id ?? "").trim();
    if (!/^\d+$/.test(statsDataId)) return fail(`statsDataId "${id ?? ""}"`);
    const filters: Record<string, string> = { stats_data_id: statsDataId };
    for (const c of ESTAT_CLASSES)
      if (options[c] !== undefined) filters[c] = options[c].trim();
    return ok(filters);
  },
};

if (import.meta.main) await runMigration(spec);
