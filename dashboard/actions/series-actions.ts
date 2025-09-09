"use server";

import type {
  data_points,
  measurements,
  series,
  xseries,
} from "@prisma/client";
import { apiRequest, withErrorHandling } from "lib/action-utils";
import { ActionResult } from "lib/types";

interface SeriesListResponse {
  data: series[];
  meta: {
    offset: number;
    limit: number;
    count: number;
  };
}

interface SeriesResponse {
  data: series;
}

export async function getSeries(): Promise<ActionResult<series[]>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<SeriesListResponse>("/series");
    return response.data;
  });
}

export async function getSeriesById(id: number): Promise<
  ActionResult<{
    metadata: xseries;
    dataPoints: data_points[];
    measurement: measurements;
  }>
> {
  return withErrorHandling(async () => {
    const response = await apiRequest<{
      data: {
        series: series;
        dataPoint: data_points[];
        measurement: measurements;
      };
    }>(`/series/${id}`);
    return response.data;
  });
}

export async function createSeries(
  formData: FormData
): Promise<ActionResult<Series>> {
  return withErrorHandling(async () => {
    const seriesData = {
      name: formData.get("name") as string,
      dataPortalName: formData.get("dataPortalName") as string,
      // ... other fields
    };

    const response = await apiRequest<SeriesResponse>("/series", {
      method: "POST",
      body: JSON.stringify(seriesData),
    });

    return response.data;
  });
}

// export async function getSeriesSummaries() {
//   // SELECT `xseries`.* FROM `xseries` WHERE `xseries`.`id` = ? LIMIT ?  [["id", 405962], ["LIMIT", 1]]
// }
