"use server";

import { Series } from "@shared/types";
import { apiRequest, withErrorHandling } from "lib/action-utils";
import { ActionResult } from "lib/types";

interface SeriesListResponse {
  data: Series[];
  meta: {
    offset: number;
    limit: number;
    count: number;
  };
}

interface SeriesResponse {
  data: Series;
}

export async function getSeries(): Promise<ActionResult<Series[]>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<SeriesListResponse>("/series");
    console.log("ENV TEST", process.env.DB_HOST);
    return response.data;
  });
}

export async function getSeriesById(id: string): Promise<ActionResult<Series>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<SeriesResponse>(`/series/${id}`);
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
