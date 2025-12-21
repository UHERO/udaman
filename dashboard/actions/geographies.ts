"use server";

import { udamanFetch } from "@/actions/action-utils";
import { Geography, Universe } from "@shared/types/shared";

export async function getGeographies(params?: {
  universe?: Universe;
}): Promise<Geography[]> {
  const universe = params?.universe;
  const queryString = universe ? `?u=${universe}` : "";

  const result = await udamanFetch<{ data: Geography[] }>(
    `/geographies${queryString}`
  );

  return result.data;
}
