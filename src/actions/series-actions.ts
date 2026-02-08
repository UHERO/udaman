"use server";

import { notFound } from "next/navigation";
import { createLogger } from "@/core/observability/logger";
import {
  getSeries as fetchSeries,
  getSeriesById as fetchSeriesById,
  getSourceMap as fetchSourceMap,
  deleteSeriesDataPoints as deleteDataPointsCtrl,
} from "@catalog/controllers/series";
import type {
  SourceMapNode,
  Universe,
} from "@catalog/types/shared";

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
  return result.data;
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
