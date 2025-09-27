"use server";

import { udamanFetch } from "@/actions/action-utils";
import { Universe } from "@shared/types/shared";

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

  const response = await udamanFetch<{
    data: DataLoaderFormPayload;
  }>(`/data-loaders/new?${searchParams}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.data;
}
