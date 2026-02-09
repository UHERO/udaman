"use server";

import { notFound } from "next/navigation";
import { createLogger } from "@/core/observability/logger";
import {
  getSeries as fetchSeries,
  getSeriesById as fetchSeriesById,
  getSourceMap as fetchSourceMap,
  deleteSeriesDataPoints as deleteDataPointsCtrl,
  searchSeries,
} from "@catalog/controllers/series";
import type {
  SourceMapNode,
  Universe,
} from "@catalog/types/shared";
import { getGeographies } from "@/core/catalog/controllers/geographies";
import { getUnits } from "@/core/catalog/controllers/units";
import { getSources } from "@/core/catalog/controllers/sources";
import { getSourceDetails } from "@/core/catalog/controllers/source-details";

const log = createLogger("action.series");

/** Used in series summary page */
export async function getSeries(params: {
  universe?: Universe;
}) {
  const universe = params.universe ?? "UHERO";
  log.info({ universe }, "getSeries action called");
  const result = await fetchSeries({ universe });
  log.info({ count: result.data.length }, "getSeries action completed");
  return result.data;
}

export async function getSeriesById(id: number, _params?: { universe?: Universe }) {
  log.info({ id }, "getSeriesById action called");
  const result = await fetchSeriesById({ id });
  log.info({ id, dataPointCount: result.data.dataPoints.length }, "getSeriesById action completed");
  return {
    ...result.data,
    aliases: result.data.aliases.map((a) => a.toJSON()),
  };
}

export async function getSourceMap(
  _id: number,
  queryParams: { name: string | null }
): Promise<SourceMapNode[]> {
  const { name } = queryParams;
  if (name === null) return notFound();
  log.info({ name }, "getSourceMap action called");
  const result = await fetchSourceMap({ name });
  return result.data as SourceMapNode[];
}

export async function deleteSeriesDataPoints(
  id: number,
  queryParams: {
    universe: string;
    date: string;
    deleteBy: "observationDate" | "vintageDate" | "none";
  }
) {
  const { universe, date, deleteBy } = queryParams;
  log.info({ id, universe, deleteBy, date }, "deleteSeriesDataPoints action called");
  const result = await deleteDataPointsCtrl({
    id,
    u: universe as Universe,
    date,
    deleteBy,
  });
  log.info({ id }, "deleteSeriesDataPoints action completed");
  return result.data;
}

export async function searchSeriesAction(term: string, universe: string) {
  return await searchSeries({ term, universe });
}

/** Returns 
 * - Geographies
 * - Units
 * - Sources
 * - Source Details
 * 
 * Seasonal Adjustments and Frequencies can be kept in a constants.ts file somewhere.
 */
export async function getFormOptions({ universe }: { universe: Universe }) {
  const [geographies, units, sources, sourceDetails] = await Promise.all([
    getGeographies({ u: universe }),
    getUnits({ u: universe }),
    getSources({ u: universe }),
    getSourceDetails({ u: universe })
  ]);

  return {
    geographies: geographies.data.map(d => d.toJSON()),
    units: units.data.map(d => d.toJSON()),
    sources: sources.data.map(d => d.toJSON()),
    sourceDetails: sourceDetails.data.map(d => d.toJSON()),
  }
}