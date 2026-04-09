/**
 * One-off cleanup for data points written by the broken day→lower-freq
 * aggregate behavior. The bug: `Series.aggregate` used
 * `freqPerFreq(srcFreq, targetFreq)` to decide whether to prune incomplete
 * periods, but `freqPerFreq("day", ...)` returns null, so every grouped
 * period — including in-progress months/weeks — was emitted.
 *
 * This script finds every loader whose eval is a day→lower-freq aggregate,
 * looks up the source series's current max date, and reports / deletes any
 * target rows in `data_points` + `public_data_points` whose period's last
 * calendar day is past that max date (i.e. periods the fixed code would
 * not emit). It intentionally leaves alone any period whose last day is
 * already in the source — those values were either correct when written
 * or will be overwritten by the next loader run.
 *
 * Usage:
 *   bun run src/core/scripts/cleanup-partial-aggregates.ts           # dry run
 *   bun run src/core/scripts/cleanup-partial-aggregates.ts --execute # actually delete
 */
import { mysql } from "@database/mysql";

type LoaderRow = {
  id: number;
  series_id: number;
  eval: string;
  target_name: string;
  target_xseries_id: number;
  target_freq: string;
};

type DataPointRow = {
  xseries_id: number;
  date: Date | string;
  value: number | null;
  data_source_id: number;
};

const EXECUTE = process.argv.includes("--execute");

// ─── Date helpers (mirror src/core/catalog/models/series.ts) ─────────

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeFreq(freq: string): string {
  const f = freq.toLowerCase().replace(/ly$/, "");
  const map: Record<string, string> = {
    d: "day",
    w: "week",
    m: "month",
    q: "quarter",
    s: "semi",
    a: "year",
    y: "year",
  };
  return map[f] ?? f;
}

/** Normalize a DB date column (Bun's mysql driver returns Date objects for
 *  DATE/DATETIME columns) to a plain YYYY-MM-DD string. */
function toDateStr(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    // Use local-time components, not toISOString(), to avoid UTC-shift when a
    // DATE column like "2026-04-08" comes back as a local-midnight Date that
    // lands on the previous day in UTC.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function lastDayOfPeriod(periodStartStr: string, freq: string): string {
  const f = normalizeFreq(freq);
  const [yStr, mStr, dStr] = periodStartStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  switch (f) {
    case "year":
      return fmtDate(y, 12, 31);
    case "semi":
      return m === 1 ? fmtDate(y, 6, 30) : fmtDate(y, 12, 31);
    case "quarter": {
      const lastMonth = m + 2;
      return fmtDate(y, lastMonth, daysInMonth(y, lastMonth - 1));
    }
    case "month":
      return fmtDate(y, m, daysInMonth(y, m - 1));
    case "week": {
      const d = Number(dStr);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + 6);
      return dt.toISOString().slice(0, 10);
    }
    default:
      return periodStartStr;
  }
}

// ─── Parse loader eval ───────────────────────────────────────────────

/** Extract the source series name and target frequency from an aggregate eval. */
function parseAggregateEval(
  evalStr: string,
): { sourceName: string; targetFreq: string } | null {
  // Matches: "NAME".ts.aggregate(:freq, :op) or .ts.aggregate(:freq)
  const re =
    /"([^"]+)"\.ts\.aggregate\s*\(\s*:(\w+)(?:\s*,\s*:\w+)?\s*\)/;
  const m = evalStr.match(re);
  if (!m) return null;
  return { sourceName: m[1], targetFreq: normalizeFreq(m[2]) };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `=== Cleanup partial-aggregate data points (${EXECUTE ? "EXECUTE" : "DRY RUN"}) ===\n`,
  );

  // Find all day-source aggregate loaders that ran under the TS port (2026+).
  const loaders = await mysql<LoaderRow>`
    SELECT ds.id, ds.series_id, ds.eval,
           s.name AS target_name, s.xseries_id AS target_xseries_id,
           x.frequency AS target_freq
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    JOIN xseries x ON x.id = s.xseries_id
    WHERE ds.eval REGEXP '@[A-Z0-9_]+\\\\.D["\\\\.]'
      AND ds.eval LIKE '%.aggregate%'
      AND ds.last_run_at >= '2026-04-01'
    ORDER BY s.name
  `;

  console.log(`Found ${loaders.length} candidate loaders\n`);

  let totalDataPointsToDelete = 0;
  let totalPublicDataPointsToDelete = 0;
  const deleteSpecs: Array<{
    loader: LoaderRow;
    sourceMaxDate: string;
    stalePeriods: string[];
  }> = [];

  for (const loader of loaders) {
    const parsed = parseAggregateEval(loader.eval);
    if (!parsed) {
      console.log(
        `  [skip] loader #${loader.id} ${loader.target_name}: couldn't parse eval: ${loader.eval}`,
      );
      continue;
    }

    // Look up the source series and its current max date from data_points.
    const sourceRows = await mysql<{
      id: number;
      xseries_id: number;
    }>`
      SELECT s.id, s.xseries_id
      FROM series s
      WHERE s.name = ${parsed.sourceName}
      LIMIT 1
    `;
    if (sourceRows.length === 0) {
      console.log(
        `  [skip] ${loader.target_name}: source ${parsed.sourceName} not found`,
      );
      continue;
    }
    const source = sourceRows[0];

    const maxRows = await mysql<{ max_date: Date | string | null }>`
      SELECT MAX(date) AS max_date
      FROM data_points
      WHERE xseries_id = ${source.xseries_id}
        AND current = 1
        AND value IS NOT NULL
    `;
    const sourceMaxDate = toDateStr(maxRows[0]?.max_date);
    if (!sourceMaxDate) {
      console.log(
        `  [skip] ${loader.target_name}: source ${parsed.sourceName} has no data`,
      );
      continue;
    }

    // Find target data_points written by this loader whose period's last
    // day is after the source max date — i.e. the period isn't closed yet.
    const targetRows = await mysql<DataPointRow>`
      SELECT xseries_id, date, value, data_source_id
      FROM data_points
      WHERE data_source_id = ${loader.id}
        AND current = 1
      ORDER BY date
    `;

    const stale: string[] = [];
    for (const row of targetRows) {
      const dateStr = toDateStr(row.date);
      if (!dateStr) continue;
      const lastDay = lastDayOfPeriod(dateStr, parsed.targetFreq);
      if (sourceMaxDate < lastDay) {
        stale.push(dateStr);
      }
    }

    if (stale.length === 0) continue;

    console.log(
      `  ${loader.target_name} (loader #${loader.id}, src ${parsed.sourceName} max ${sourceMaxDate}, target ${parsed.targetFreq})`,
    );
    console.log(`    stale periods: ${stale.join(", ")}`);

    // Count all data_points rows (including historical current=0) for these dates
    const dpCount = await mysql<{ n: number }>`
      SELECT COUNT(*) AS n
      FROM data_points
      WHERE data_source_id = ${loader.id}
        AND date IN ${mysql(stale)}
    `;

    // public_data_points is keyed by series_id; delete for every series row
    // sharing the xseries (covers all universes).
    const seriesRows = await mysql<{ id: number }>`
      SELECT id FROM series WHERE xseries_id = ${loader.target_xseries_id}
    `;
    const seriesIds = seriesRows.map((r) => r.id);
    const pdpCount = await mysql<{ n: number }>`
      SELECT COUNT(*) AS n
      FROM public_data_points
      WHERE series_id IN ${mysql(seriesIds)}
        AND date IN ${mysql(stale)}
    `;

    console.log(
      `    data_points rows: ${dpCount[0]?.n ?? 0}, public_data_points rows: ${pdpCount[0]?.n ?? 0}`,
    );

    totalDataPointsToDelete += dpCount[0]?.n ?? 0;
    totalPublicDataPointsToDelete += pdpCount[0]?.n ?? 0;

    deleteSpecs.push({ loader, sourceMaxDate, stalePeriods: stale });
  }

  console.log(`\n=== Summary ===`);
  console.log(`Loaders with stale rows: ${deleteSpecs.length}`);
  console.log(`data_points rows to delete: ${totalDataPointsToDelete}`);
  console.log(
    `public_data_points rows to delete: ${totalPublicDataPointsToDelete}`,
  );

  if (!EXECUTE) {
    console.log(`\n(dry run — pass --execute to actually delete)`);
    process.exit(0);
  }

  console.log(`\nExecuting deletes...`);
  for (const spec of deleteSpecs) {
    const seriesRows = await mysql<{ id: number }>`
      SELECT id FROM series WHERE xseries_id = ${spec.loader.target_xseries_id}
    `;
    const seriesIds = seriesRows.map((r) => r.id);

    const dpResult = await mysql`
      DELETE FROM data_points
      WHERE data_source_id = ${spec.loader.id}
        AND date IN ${mysql(spec.stalePeriods)}
    `;
    const pdpResult = await mysql`
      DELETE FROM public_data_points
      WHERE series_id IN ${mysql(seriesIds)}
        AND date IN ${mysql(spec.stalePeriods)}
    `;
    console.log(
      `  ${spec.loader.target_name}: deleted ${(dpResult as unknown as { affectedRows?: number }).affectedRows ?? "?"} data_points, ${(pdpResult as unknown as { affectedRows?: number }).affectedRows ?? "?"} public_data_points`,
    );
  }

  console.log(`\nDone.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
