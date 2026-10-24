/**
 * Assign data_sources.max_lag_days to enabled nightly source loaders (api,
 * download, file) from their own arrival history (Loader.suggestLagLimit:
 * worst lag just before a new point arrived + mean gap between arrivals,
 * over up to the last 10 points). Analysis behind the formula:
 * docs/2026-10-24-loader-lag-limits.md.
 *
 * Skipped, with the reason in the report:
 *   - fewer than 5 recent points that arrived separately (bulk reload /
 *     clear_before_load: no cadence to measure)
 *   - no new point in over a year (discontinued; listed for review instead
 *     of alerting every night)
 *   - a lag limit already set (manual settings win; --overwrite replaces)
 *   - derived loaders (arithmetic on other series): they repeat their
 *     source's alert; --include-derived assigns them too
 *
 * Loaders already behind are set too and marked "set (already late)" in
 * the report: they alert on the next run and are worth reviewing.
 *
 * Writes skip updated_at on purpose: the public sweep reads a bumped
 * data_sources.updated_at as "data changed" (see updateFields).
 *
 * Dry run by default; nothing is written without --execute.
 *
 * Usage:
 *   bun run scripts/set-loader-lag-limits.ts [--execute] [--include-derived]
 *     [--overwrite] [--today YYYY-MM-DD] [--report out.csv]
 *
 * --today evaluates as of that date, ignoring points that arrived later
 * (for a DB snapshot, e.g. a local copy of prod).
 */
import Loader from "@catalog/models/loader";
import { hstToday } from "@catalog/utils/time";
import { mysql } from "@database/mysql";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const EXECUTE = flag("--execute");
const INCLUDE_DERIVED = flag("--include-derived");
const OVERWRITE = flag("--overwrite");
const TODAY = opt("--today") ?? hstToday();
const REPORT = opt("--report");
const DEAD_AFTER_DAYS = 365;

type Row = {
  id: number;
  eval: string | null;
  pseudo_history: number;
  max_lag_days: number | null;
  series_name: string;
  xseries_id: number;
  frequency: string | null;
};

type Outcome = {
  id: number;
  series: string;
  type: string;
  frequency: string;
  action: string;
  limit: number | null;
  lastDate: string;
  lastArrival: string;
  lagToday: number | null;
};

async function evaluate(r: Row): Promise<Outcome> {
  const type = Loader.getLoaderType(r.eval ?? "", Boolean(r.pseudo_history));
  const base = {
    id: r.id,
    series: r.series_name,
    type,
    frequency: r.frequency ?? "",
    limit: null,
    lastDate: "",
    lastArrival: "",
    lagToday: null,
  };
  if (!INCLUDE_DERIVED && type === "other") {
    return { ...base, action: "skip: derived" };
  }
  if (r.max_lag_days != null && !OVERWRITE) {
    return { ...base, limit: r.max_lag_days, action: "skip: already set" };
  }

  const pts = await mysql<{ date: string; arrival: string }>`
    SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date,
           DATE_FORMAT(MIN(created_at), '%Y-%m-%d %H:%i:%s') AS arrival
    FROM data_points
    WHERE xseries_id = ${r.xseries_id} AND data_source_id = ${r.id}
    GROUP BY date
    HAVING MIN(created_at) < ${TODAY} + INTERVAL 1 DAY
    ORDER BY date DESC
    LIMIT 10
  `;
  const points = [...pts].reverse();
  const last = points.at(-1);
  if (!last) return { ...base, action: "skip: no points" };

  const lagToday = Loader.lagDays(last.date, r.frequency, TODAY);
  const seen = {
    ...base,
    lastDate: last.date,
    lastArrival: last.arrival,
    lagToday,
  };
  const sinceArrival = Loader.lagDays(last.arrival.slice(0, 10), null, TODAY);
  if (sinceArrival > DEAD_AFTER_DAYS) {
    return { ...seen, action: "skip: no new point in over a year" };
  }
  const limit = Loader.suggestLagLimit(points, r.frequency);
  if (limit === null) {
    return {
      ...seen,
      action:
        points.length < 5
          ? "skip: fewer than 5 points"
          : "skip: points arrived together",
    };
  }
  return {
    ...seen,
    limit,
    action: lagToday > limit ? "set (already late)" : "set",
  };
}

async function main() {
  console.log(
    `${EXECUTE ? "" : "[DRY RUN] "}as of ${TODAY}${INCLUDE_DERIVED ? ", including derived" : ", source loaders"}`,
  );

  const rows = await mysql<Row>`
    SELECT ds.id, ds.eval, ds.pseudo_history, ds.max_lag_days,
           s.name AS series_name, s.xseries_id, xs.frequency
    FROM data_sources ds
    JOIN series s ON s.id = ds.series_id
    JOIN xseries xs ON xs.id = s.xseries_id
    WHERE ds.disabled = 0 AND ds.reload_nightly = 1
  `;
  console.log(`${rows.length} enabled nightly loaders`);

  const outcomes: Outcome[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < rows.length) outcomes.push(await evaluate(rows[next++]));
    }),
  );

  const tally = new Map<string, number>();
  for (const o of outcomes) tally.set(o.action, (tally.get(o.action) ?? 0) + 1);
  console.table(Object.fromEntries([...tally].sort((a, b) => b[1] - a[1])));

  if (REPORT) {
    const cols = [
      "id",
      "series",
      "type",
      "frequency",
      "action",
      "limit",
      "lastDate",
      "lastArrival",
      "lagToday",
    ] as const;
    const csv = [
      cols.join(","),
      ...outcomes
        .sort((a, b) => a.series.localeCompare(b.series))
        .map((o) => cols.map((c) => o[c] ?? "").join(",")),
    ].join("\n");
    await Bun.write(REPORT, csv + "\n");
    console.log(`Report: ${REPORT}`);
  }

  const toSet = outcomes.filter((o) => o.action.startsWith("set"));
  if (EXECUTE) {
    for (const o of toSet) {
      await mysql`UPDATE data_sources SET max_lag_days = ${o.limit} WHERE id = ${o.id}`;
    }
    console.log(`Set max_lag_days on ${toSet.length} loaders`);
  } else {
    console.log(`Would set max_lag_days on ${toSet.length} loaders`);
  }
  process.exit(0);
}

await main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
