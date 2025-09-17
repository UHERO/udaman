"use server";

import type { measurements, series } from "@prisma/client";
import {
  DataLoader,
  DataPoints,
  SeriesMetadata,
  SourceMapNode,
} from "@shared/types/shared";
import { apiRequest, withErrorHandling } from "lib/action-utils";
import { ActionResult } from "lib/types";

export async function getSeries(): Promise<ActionResult<series[]>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<{
      data: series[];
      meta: {
        offset: number;
        limit: number;
        count: number;
      };
    }>("/series");
    return response.data;
  });
}

export async function getSeriesById(id: number) {
  return withErrorHandling(async () => {
    const response = await apiRequest<{
      data: {
        metadata: SeriesMetadata;
        dataPoints: DataPoints[];
        measurement: measurements[];
        loaders: DataLoader[];
      };
    }>(`/series/${id}`);
    return response.data;
  });
}

// export async function createSeries(formData: FormData) {
//   return withErrorHandling(async () => {
//     const seriesData = {
//       name: formData.get("name") as string,
//       dataPortalName: formData.get("dataPortalName") as string,
//       // ... other fields
//     };

//     const response = await apiRequest<{
//       data: series;
//     }>("/series", {
//       method: "POST",
//       body: JSON.stringify(seriesData),
//     });

//     return response.data;
//   });
// }

export async function getSourceMap(
  id: number
): Promise<ActionResult<SourceMapNode[]>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<{
      data: SourceMapNode[];
    }>(`/series/${id}/source-map`);
    console.log("Data ", response);
    return response.data;
  });
}
