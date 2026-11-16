/*************************************************************************
 * Dry run: evaluate a load statement in memory and diff the result against
 * the data points it would replace. Nothing is written to data_points.
 *
 * Caveat: evaluating may still fetch and cache source files (downloads,
 * API responses), exactly as a real reload would before inserting.
 *************************************************************************/

import LoaderCollection from "@catalog/collections/loader-collection";
import EvalExecutor from "@catalog/utils/eval-executor";
import { isoDate } from "@catalog/utils/time";
import { mysql } from "@database/mysql";

export interface DryRunResult {
  ok: boolean;
  error?: string;
  eval: string;
  scale: number;
  comparedAgainst:
    | "this loader's current points"
    | "this loader's latest points (another loader supplies the current values)"
    | "the series' current points";
  newPointCount: number;
  currentPointCount: number;
  firstDate: string | null;
  lastDate: string | null;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  /** Largest relative change among changed points, e.g. 0.12 = 12%. */
  maxRelativeChange: number | null;
  samples: {
    added: Array<{ date: string; value: number }>;
    removed: Array<{ date: string; value: number }>;
    changed: Array<{ date: string; old: number; new: number }>;
  };
}

const EPS = 1e-9;

export async function dryRunLoad(opts: {
  /** Existing loader: diff against its own current points. */
  loaderId?: number;
  /** New/alternate eval; defaults to the loader's eval. */
  eval?: string;
  /** For a proposed new loader: diff against the series' current points. */
  seriesId?: number;
  scale?: number;
}): Promise<DryRunResult> {
  const loader = opts.loaderId
    ? await LoaderCollection.getById(opts.loaderId)
    : null;
  const seriesId = loader?.seriesId ?? opts.seriesId ?? null;
  if (!seriesId) throw new Error("dryRunLoad needs a loaderId or seriesId");
  const evalStr = opts.eval ?? loader?.eval ?? "";
  if (!evalStr.trim()) throw new Error("Nothing to evaluate: empty eval");
  const scale = opts.scale ?? (loader ? Number(loader.scale) : 1);

  const seriesRows = await mysql<{
    name: string;
    universe: string;
    xseries_id: number;
  }>`SELECT name, universe, xseries_id FROM series WHERE id = ${seriesId} LIMIT 1`;
  const series = seriesRows[0];
  if (!series) throw new Error(`Series ${seriesId} not found`);

  const current = loader
    ? await mysql<{ date: Date | string; value: number | null }>`
        SELECT date, value FROM data_points
        WHERE xseries_id = ${series.xseries_id} AND data_source_id = ${loader.id}
          AND current = 1`
    : await mysql<{ date: Date | string; value: number | null }>`
        SELECT date, value FROM data_points
        WHERE xseries_id = ${series.xseries_id} AND current = 1`;
  const cur = new Map<string, number>();
  for (const r of current)
    if (r.value != null) cur.set(isoDate(r.date), Number(r.value));
  // A loader whose values were superseded by a higher-priority loader has no
  // current points; compare against its own latest version per date instead.
  let supersededBaseline = false;
  if (loader && cur.size === 0) {
    const latest = await mysql<{ date: Date | string; value: number | null }>`
      SELECT dp.date, dp.value FROM data_points dp
      JOIN (
        SELECT date, MAX(created_at) AS created_at FROM data_points
        WHERE xseries_id = ${series.xseries_id} AND data_source_id = ${loader.id}
        GROUP BY date
      ) m ON m.date = dp.date AND m.created_at = dp.created_at
      WHERE dp.xseries_id = ${series.xseries_id} AND dp.data_source_id = ${loader.id}`;
    for (const r of latest)
      if (r.value != null) cur.set(isoDate(r.date), Number(r.value));
    supersededBaseline = cur.size > 0;
  }

  const base: DryRunResult = {
    ok: false,
    eval: evalStr,
    scale,
    comparedAgainst: !loader
      ? "the series' current points"
      : supersededBaseline
        ? "this loader's latest points (another loader supplies the current values)"
        : "this loader's current points",
    newPointCount: 0,
    currentPointCount: cur.size,
    firstDate: null,
    lastDate: null,
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    maxRelativeChange: null,
    samples: { added: [], removed: [], changed: [] },
  };

  let next: Map<string, number>;
  try {
    const context = evalStr.includes("load_from_extract")
      ? { seriesName: series.name }
      : {};
    const result = await EvalExecutor.run(
      evalStr,
      (loader?.universe ?? series.universe) as never,
      context,
    );
    next = result.scaledData(scale);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }

  const dates = [...next.keys()].sort();
  const out: DryRunResult = {
    ...base,
    ok: true,
    newPointCount: next.size,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
  let maxRel = 0;
  for (const [date, value] of next) {
    const old = cur.get(date);
    if (old === undefined) {
      out.added++;
      if (out.samples.added.length < 8) out.samples.added.push({ date, value });
    } else if (Math.abs(old - value) > EPS * Math.max(1, Math.abs(old))) {
      out.changed++;
      const rel = Math.abs(value - old) / Math.max(Math.abs(old), EPS);
      maxRel = Math.max(maxRel, rel);
      if (out.samples.changed.length < 10)
        out.samples.changed.push({ date, old, new: value });
    } else {
      out.unchanged++;
    }
  }
  for (const [date, value] of cur) {
    if (!next.has(date)) {
      out.removed++;
      if (out.samples.removed.length < 8)
        out.samples.removed.push({ date, value });
    }
  }
  out.maxRelativeChange = out.changed ? maxRel : null;
  // Newest samples are the most useful to a reviewer.
  out.samples.added.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}
