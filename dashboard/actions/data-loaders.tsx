"use server";

import { Universe } from "@shared/types/shared";

import { apiRequest, withErrorHandling } from "@/lib/action-utils";

interface DataLoaderFormPayload {
  code: string;
  priority: number;
  scale: number;
  presaveHook: string;
  clearBeforeLoad: boolean;
  pseudoHistory: boolean;
}

interface DataLoaderParams {
  seriesId: number;
  universe: Universe;
}
export async function createDataLoader(
  params: DataLoaderParams,
  payload: DataLoaderFormPayload
) {
  const { seriesId, universe } = params;

  const searchParams = new URLSearchParams({
    u: universe,
    seriesId: String(seriesId),
  });

  return withErrorHandling(async () => {
    const response = await apiRequest<{
      data: DataLoaderFormPayload;
    }>(`/data-loaders/new?${searchParams}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.data;
  });
}
