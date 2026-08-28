/**
 * Rewrite loader evals from `interpolate` / `census_interpolate` to
 * `disaggregate` (the tempdisagg port, see src/core/timeseries/README.md).
 *
 * Mapping (only these exact call shapes are touched):
 *   .interpolate(:F)              → .disaggregate(:F)          (average, the default)
 *   .interpolate(:F, :average)    → .disaggregate(:F)
 *   .interpolate(:F, :sum)        → .disaggregate(:F, :sum)
 *   .census_interpolate(:F)       → .disaggregate(:F)
 *   ("X@G.A".ts / 4).census_interpolate(:quarter)
 *                                 → "X@G.A".ts.disaggregate(:quarter, :sum)
 *     "divide a flow by the ratio, then interpolate so sub-periods average
 *     to it" is exactly "sub-periods sum to the annual". The divisor must
 *     equal the frequency ratio implied by the series name (4 for A→Q,
 *     12 for A→M, 3 for Q→M, …); anything else is left for hand review.
 *
 * `linear_interpolate`, `fill_interpolate_to`, `trms_interpolate_to_quarterly`
 * and anything else are left alone. Every affected data source is printed
 * with its target series name and the before/after eval. Nothing is written
 * unless `--execute` is passed.
 *
 * Usage:
 *   bun run src/core/scripts/migrate-interpolate-to-disaggregate.ts            # dry run
 *   bun run src/core/scripts/migrate-interpolate-to-disaggregate.ts --execute  # write
 *   bun run src/core/scripts/migrate-interpolate-to-disaggregate.ts --only NBIR@HI.Q,POP@HI.Q
 */
import { mysql, rawQuery } from "@/lib/mysql/db";

const EXECUTE = process.argv.includes("--execute");
const onlyIdx = process.argv.indexOf("--only");
const ONLY =
  onlyIdx >= 0 ? new Set(process.argv[onlyIdx + 1].split(",")) : null;

type Row = { id: number; eval: string; target: string | null };

const CALL =
  /\.(census_interpolate|interpolate)\(\s*(:[a-z]+)\s*(?:,\s*:(average|sum)\s*)?\)/g;

/** `("NAME".ts / N).interpolate(:freq[, :average])` */
const DIVIDED_CALL =
  /\(\s*("([^"]+)"\.ts)\s*\/\s*(\d+)\s*\)\.(?:census_interpolate|interpolate)\(\s*:([a-z]+)\s*(?:,\s*:average\s*)?\)/g;

const MONTHS: Record<string, number> = {
  A: 12,
  S: 6,
  Q: 3,
  M: 1,
  year: 12,
  semi: 6,
  quarter: 3,
  month: 1,
};

/** Ratio implied by the source series name's frequency suffix and target. */
function ratioFor(seriesName: string, targetFreq: string): number | null {
  const src = MONTHS[seriesName.split(".").pop() ?? ""];
  const tgt = MONTHS[targetFreq];
  return src && tgt && src % tgt === 0 ? src / tgt : null;
}

export function rewriteEval(evalStr: string): string {
  return evalStr
    .replace(
      DIVIDED_CALL,
      (m, ts: string, name: string, divisor: string, freq: string) =>
        Number(divisor) === ratioFor(name, freq)
          ? `${ts}.disaggregate(:${freq}, :sum)`
          : m,
    )
    .replace(CALL, (_m, _fn: string, freq: string, conv?: string) =>
      conv === "sum"
        ? `.disaggregate(${freq}, :sum)`
        : `.disaggregate(${freq})`,
    );
}

async function main() {
  const rows = await mysql<Row>`
    SELECT d.id, d.eval, s.name AS target
    FROM data_sources d
    LEFT JOIN series s ON s.id = d.series_id
    WHERE d.eval LIKE '%.interpolate(%' OR d.eval LIKE '%.census_interpolate(%'
    ORDER BY s.name, d.id
  `;

  const changes: Array<Row & { next: string }> = [];
  const untouched: Row[] = [];
  for (const r of rows) {
    if (ONLY && !ONLY.has(r.target ?? "")) continue;
    const next = rewriteEval(r.eval);
    // A division that survived the rewrite means the divisor didn't match
    // the frequency ratio — don't rename the call underneath it.
    const suspicious = /\/\s*\d+\s*\)\.disaggregate\(/.test(next);
    if (next === r.eval || suspicious) untouched.push(r);
    else changes.push({ ...r, next });
  }

  console.log(
    `${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${rows.length} data sources matched, ${changes.length} to rewrite, ${untouched.length} unchanged\n`,
  );
  for (const c of changes) {
    console.log(`[${c.id}] ${c.target ?? "(no series)"}`);
    console.log(`  - ${c.eval}`);
    console.log(`  + ${c.next}`);
  }
  if (untouched.length) {
    console.log(
      "\nMatched but not rewritten (unrecognised call shape — check by hand):",
    );
    for (const u of untouched)
      console.log(`[${u.id}] ${u.target ?? "(no series)"}  ${u.eval}`);
  }

  if (!EXECUTE) {
    console.log("\nDry run: nothing written. Re-run with --execute to apply.");
    return;
  }

  let n = 0;
  for (const c of changes) {
    await rawQuery(
      "UPDATE data_sources SET eval = ?, updated_at = NOW() WHERE id = ? AND eval = ?",
      [c.next, c.id, c.eval],
    );
    n++;
  }
  console.log(`\nUpdated ${n} data sources.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
