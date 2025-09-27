"use server";

import { notFound } from "next/navigation";
import { udamanFetch } from "@/actions/action-utils";
import type { measurements, series } from "@prisma/client";
import {
  DataLoader,
  DataPoint,
  SeriesMetadata,
  SourceMapNode,
  Universe,
} from "@shared/types/shared";

/** Used in series summary page */
export async function getSeries(params: {
  universe?: Universe;
}): Promise<series[]> {
  const universe = params.universe ?? "UHERO";
  const result = await udamanFetch<{
    data: series[];
    meta: {
      offset: number;
      limit: number;
      count: number;
    };
  }>(`/series?u=${universe}`);
  return result.data;
}

export async function getSeriesById(
  id: number,
  params: { universe?: Universe }
) {
  const universe = params.universe ?? "UHERO";
  const searchParams = new URLSearchParams({ u: universe });
  const response = await udamanFetch<{
    data: {
      metadata: SeriesMetadata;
      dataPoints: DataPoint[];
      measurement: measurements[];
      loaders: DataLoader[];
      aliases: series[];
    };
  }>(`/series/${id}?${searchParams.toString()}`);
  return response.data;
}

export async function getSourceMap(
  id: number,
  queryParams: { name: string | null }
): Promise<SourceMapNode[]> {
  const { name } = queryParams;
  if (name === null) return notFound();
  const searchParams = new URLSearchParams({ name });
  const url = `/series/${id}/source-map?${searchParams.toString()}`;

  const response = await udamanFetch<{
    data: SourceMapNode[];
  }>(url);
  return response.data;
}

export async function deleteSeriesDataPoints(
  id: number,
  queryParams: {
    universe: string;
    date: string;
    deleteBy: "observationDate" | "vintageDate" | "none";
  }
): Promise<SourceMapNode[]> {
  const { universe, date, deleteBy } = queryParams;

  const searchParams = new URLSearchParams({ u: universe, date, deleteBy });
  const url = `/series/${id}/delete?${searchParams.toString()}`;
  const response = await udamanFetch<{ data: SourceMapNode[] }>(url, {
    method: "DELETE",
  });
  return response.data;
}
