// actions/series-actions.ts
"use server";

import { apiRequest, withErrorHandling } from "lib/action-utils";
import { ActionResult } from "lib/types";

interface SeriesFull {
  id: number;
  xseries_id: number;
  geography_id: number;
  unit_id: number;
  source_id: number;
  source_detail_id: number | null;
  universe: string;
  decimals: number;
  name: string;
  dataPortalName: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  dependency_depth: number;
  source_link: string | null;
  investigation_notes: string | null;
  scratch: number;
}

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
    console.log("response.data", response);
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
