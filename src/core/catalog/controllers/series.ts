import "server-only";
import DataPointCollection from "@catalog/collections/data-point-collection";
import GeographyCollection from "@catalog/collections/geography-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import Series from "@catalog/models/series";
import EvalExecutor from "@catalog/utils/eval-executor";

import { createLogger } from "@/core/observability/logger";

import Measurements from "../models/measurements";
import type {
  AnalyzeResult,
  CompareResult,
  Universe,
} from "../types/shared";

const log = createLogger("catalog.series");

/*************************************************************************
 * SERIES Controller
 *************************************************************************/

export async function getSeries({
  offset,
  limit,
  universe,
}: {
  offset?: number;
  limit?: number;
  universe: Universe;
}) {
  log.info({ offset, limit, universe }, "fetching series summary list");
  const data = await SeriesCollection.getSummaryList({
    offset,
    limit,
    universe,
  });
  log.info({ count: data.length, universe }, "series summary list fetched");
  return { data, offset, limit };
}

export async function getSeriesById({ id }: { id: number }) {
  log.info({ id }, "fetching series by id");

  // Fetch metadata first — we need xs_id for the data points query
  const metadata = await SeriesCollection.getSeriesMetadata({ id });

  const [measurement, dataPoints, loaders] = await Promise.all([
    Measurements.getSeriesMeasurements({ seriesId: id }),
    DataPointCollection.getBySeriesId({ xseriesId: metadata.xs_id }),
    LoaderCollection.getBySeriesId(id),
  ]);

  const aliases = await SeriesCollection.getAliases({
    sId: id,
    xsId: metadata.xs_id,
  });

  log.info({ id, dataPointCount: dataPoints.length }, "series fetched");

  return {
    data: {
      aliases: aliases.map((d) => d.toJSON()),
      dataPoints: dataPoints,
      loaders: loaders.map((d) => d.toJSON()),
      measurement: measurement,
      metadata: metadata,
    },
  };
}

export async function getSourceMap({ name }: { name: string }) {
  log.info({ name }, "fetching source map");
  const data = await LoaderCollection.getDependencyTree(name);
  return { data };
}

export async function deleteSeriesDataPoints({
  id,
  u,
  date,
  deleteBy,
}: {
  id: number;
  u: Universe;
  date?: string;
  deleteBy: "observationDate" | "vintageDate" | "none";
}) {
  log.info({ id, universe: u, deleteBy, date }, "deleting series data points");
  const data = await SeriesCollection.deleteDataPoints({
    id,
    u,
    date,
    deleteBy,
  });
  log.info({ id, deleteBy }, "series data points deleted");
  return { data };
}

export async function getSeriesWithNullField({
  universe,
  field,
  page,
  perPage,
}: {
  universe: string;
  field: string;
  page?: number;
  perPage?: number;
}) {
  log.info({ universe, field, page }, "fetching series with null field");
  const result = await SeriesCollection.getWithNullField(
    universe,
    field,
    page,
    perPage,
  );
  log.info(
    { universe, field, totalCount: result.totalCount },
    "series with null field fetched",
  );
  return result;
}

export async function getQuarantinedSeries({
  universe,
  page,
  perPage,
}: {
  universe: string;
  page?: number;
  perPage?: number;
}) {
  log.info({ universe, page }, "fetching quarantined series");
  const result = await SeriesCollection.getQuarantined(universe, page, perPage);
  log.info(
    { universe, totalCount: result.totalCount },
    "quarantined series fetched",
  );
  return result;
}

export async function unquarantineSeries({ seriesId }: { seriesId: number }) {
  log.info({ seriesId }, "unquarantining series");
  await SeriesCollection.unquarantine(seriesId);
  log.info({ seriesId }, "series unquarantined");
}

export async function emptyQuarantine({ universe }: { universe: string }) {
  log.info({ universe }, "emptying quarantine");
  const count = await SeriesCollection.emptyQuarantine(universe);
  log.info({ universe, count }, "quarantine emptied");
  return count;
}

export async function updateSeries({
  id,
  payload,
}: {
  id: number;
  payload: import("@catalog/collections/series-collection").UpdateSeriesPayload;
}) {
  log.info({ id }, "updating series");
  const result = await SeriesCollection.update(id, payload);
  log.info({ id, name: result.name }, "series updated");
  return { message: "Series updated", data: result };
}

export async function duplicateSeries({
  sourceId,
  payload,
  copyLoaders,
}: {
  sourceId: number;
  payload: import("@catalog/collections/series-collection").CreateSeriesPayload;
  copyLoaders: boolean;
}) {
  log.info({ sourceId, name: payload.name, copyLoaders }, "duplicating series");
  const newSeries = await SeriesCollection.create(payload);

  if (copyLoaders) {
    const loaders = await LoaderCollection.getEnabledBySeriesId(sourceId);
    for (const loader of loaders) {
      await LoaderCollection.create({
        seriesId: newSeries.id!,
        code: loader.eval ?? "",
        universe: payload.universe ?? "UHERO",
        priority: loader.priority,
        scale: Number(loader.scale) || 1,
        presaveHook: loader.presaveHook ?? "",
        clearBeforeLoad: loader.clearBeforeLoad,
        pseudoHistory: loader.pseudoHistory,
      });
    }
    log.info(
      { sourceId, newId: newSeries.id, loadersCopied: loaders.length },
      "loaders copied",
    );
  }

  log.info(
    { sourceId, newId: newSeries.id, name: newSeries.name },
    "series duplicated",
  );
  return { message: "Series duplicated", data: newSeries };
}

export async function deleteSeries({
  id,
  force,
}: {
  id: number;
  force?: boolean;
}) {
  log.info({ id, force }, "deleting series");
  await SeriesCollection.delete(id, { force });
  log.info({ id }, "series deleted");
  return { message: "Series deleted" };
}

export async function searchSeries({
  term,
  universe = "uhero",
  limit,
}: {
  term: string;
  universe: string;
  limit?: number;
}) {
  log.info({ term, universe, limit }, "search series");
  const results = await SeriesCollection.search({
    text: term,
    universe,
    limit,
  });
  const ids = results
    .map((s) => s.id)
    .filter((id): id is number => id !== null);
  const summaries = await SeriesCollection.getSummaryByIds(ids);
  log.info({ found: summaries.length }, "search series");
  return summaries;
}

// ─── Analyze / Transform ─────────────────────────────────────────────

/** Convert a Series' data Map to sorted [date, value] tuples. */
function mapToTuples(data: Map<string, number>): [string, number][] {
  return [...data.entries()]
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b));
}

export async function analyzeSeries({
  id,
}: {
  id: number;
}): Promise<AnalyzeResult> {
  log.info({ id }, "analyzing series");

  const series = await SeriesCollection.getById(id);
  await SeriesCollection.loadCurrentData(series);

  const yoySeries = series.yoy();
  const diffSeries = series.diff();
  const ytdSeries = series.ytd();

  const siblings = await SeriesCollection.getFrequencySiblings(series);

  log.info({ id, observations: series.observationCount }, "series analyzed");

  return {
    series: series.toAnalyzeJSON(),
    yoy: mapToTuples(yoySeries.data),
    levelChange: mapToTuples(diffSeries.data),
    ytd: mapToTuples(ytdSeries.data),
    stats: {
      mean: series.mean(),
      median: series.median(),
      standardDeviation: series.standardDeviation(),
    },
    siblings,
    unitLabel: series.unitLabel,
    unitShortLabel: series.unitShortLabel,
  };
}

export async function transformSeries({
  evalStr,
}: {
  evalStr: string;
}): Promise<AnalyzeResult> {
  log.info({ evalStr }, "transforming series expression");

  // Preprocess: pad spaces around operators, wrap valid series names as "NAME".ts
  const padded = evalStr.replace(/([+*/()-])/g, " $1 ").trim();
  const tokens = padded.split(/\s+/).filter(Boolean);
  const evalStatement = tokens
    .map((t) => (Series.isValidName(t) ? `"${t}".ts` : t))
    .join(" ");

  const result = await EvalExecutor.run(evalStatement);

  const yoySeries = result.yoy();
  const diffSeries = result.diff();
  const ytdSeries = result.ytd();

  // Extract series names from the original expression for linking
  const seriesNames = tokens.filter((t) => Series.isValidName(t));
  const seriesLinks =
    seriesNames.length > 0
      ? await SeriesCollection.getIdsByNames(seriesNames)
      : {};

  // Load the most recent value for each referenced series
  const seriesLastValues: Record<string, number> = {};
  for (const name of seriesNames) {
    try {
      const s = await SeriesCollection.getByName(name);
      await SeriesCollection.loadCurrentData(s);
      const lastDate = s.lastObservation;
      if (lastDate) {
        const val = s.data.get(lastDate);
        if (val != null) seriesLastValues[name] = val;
      }
    } catch {
      // series not found — skip
    }
  }

  // Get the last value of the computed result
  const resultLastDate = result.lastObservation;
  const resultValue = resultLastDate
    ? (result.data.get(resultLastDate) ?? null)
    : null;

  log.info(
    { evalStr, observations: result.observationCount },
    "series transformed",
  );

  return {
    series: {
      ...result.toAnalyzeJSON(),
      name: evalStr,
    },
    yoy: mapToTuples(yoySeries.data),
    levelChange: mapToTuples(diffSeries.data),
    ytd: mapToTuples(ytdSeries.data),
    stats: {
      mean: result.mean(),
      median: result.median(),
      standardDeviation: result.standardDeviation(),
    },
    seriesLinks,
    seriesLastValues,
    resultValue,
    resultDate: resultLastDate ?? null,
  };
}

// ─── Compare (multi-series) ─────────────────────────────────────────

export async function compareSeries({
  names,
}: {
  names: string[];
}): Promise<CompareResult> {
  log.info({ names }, "comparing series");

  const entries = await Promise.all(
    names.map(async (name) => {
      const s = await SeriesCollection.getByName(name);
      await SeriesCollection.loadCurrentData(s);
      const json = s.toAnalyzeJSON();
      return {
        name,
        data: json.data,
        decimals: json.decimals,
        frequencyCode: json.frequencyCode,
        unitShortLabel: s.unitShortLabel,
      };
    }),
  );

  const seriesLinks = await SeriesCollection.getIdsByNames(names);

  log.info(
    { count: entries.length, names },
    "series compared",
  );

  return { series: entries, seriesLinks };
}

// ─── Compare suggestions ────────────────────────────────────────────

/**
 * Given a series name, find all geo variants that exist in the DB.
 * Returns the list of existing names (preserving geo list_order), or null if ≤1.
 */
export async function getCompareAllGeos({
  name,
  universe,
}: {
  name: string;
  universe: string;
}): Promise<string[] | null> {
  log.info({ name, universe }, "getCompareAllGeos");

  const parsed = Series.parseName(name);
  const geos = await GeographyCollection.list({
    universe: universe as Universe,
  });

  const candidates = geos
    .filter((g) => g.handle)
    .map((g) => {
      try {
        return Series.buildName(parsed.prefix, g.handle!, parsed.freq);
      } catch {
        return null;
      }
    })
    .filter((n): n is string => n !== null);

  if (candidates.length === 0) return null;

  const existing = await SeriesCollection.getIdsByNames(candidates);
  // Preserve geo list_order by filtering candidates (already ordered)
  const result = candidates.filter((n) => n in existing);

  return result.length > 1 ? result : null;
}

/**
 * Given a series name, find its SA/NSA counterpart.
 * Returns [name, counterpart] if counterpart exists, null otherwise.
 */
export async function getCompareSANS({
  name,
}: {
  name: string;
}): Promise<string[] | null> {
  log.info({ name }, "getCompareSANS");

  const parsed = Series.parseName(name);
  let counterpartPrefix: string;

  if (/NS$/i.test(parsed.prefix)) {
    counterpartPrefix = parsed.prefix.replace(/NS$/i, "");
  } else {
    counterpartPrefix = parsed.prefix + "NS";
  }

  let counterpartName: string;
  try {
    counterpartName = Series.buildName(
      counterpartPrefix,
      parsed.geo,
      parsed.freq,
    );
  } catch {
    return null;
  }

  const existing = await SeriesCollection.getIdsByNames([counterpartName]);
  if (!(counterpartName in existing)) return null;

  return [name, counterpartName];
}
