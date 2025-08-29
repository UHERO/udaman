"use server";

import { SeriesFull } from "@shared/types";
import { apiRequest, withErrorHandling } from "lib/action-utils";
import { ActionResult } from "lib/types";

interface SeriesListResponse {
  data: SeriesFull[];
  meta: {
    offset: number;
    limit: number;
    count: number;
  };
}

interface SeriesResponse {
  data: SeriesFull;
}

export async function getSeries(): Promise<ActionResult<SeriesFull[]>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<SeriesListResponse>("/series");
    return response.data;
  });
}

export async function getSeriesById(
  id: string
): Promise<ActionResult<SeriesFull>> {
  return withErrorHandling(async () => {
    const response = await apiRequest<SeriesResponse>(`/series/${id}`);
    return response.data;
  });
}

export async function createSeries(
  formData: FormData
): Promise<ActionResult<SeriesFull>> {
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
