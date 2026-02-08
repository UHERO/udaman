"use server";

import { createLogger } from "@/core/observability/logger";
import { getGeographies as fetchGeographies } from "@catalog/controllers/geographies";
import type { Geography, Universe } from "@catalog/types/shared";

const log = createLogger("action.geographies");

export async function getGeographies(params?: {
  universe?: Universe;
}): Promise<Geography[]> {
  log.info({ universe: params?.universe }, "getGeographies action called");
  const result = await fetchGeographies({ u: params?.universe });
  log.info({ count: (result.data as Geography[]).length }, "getGeographies action completed");
  return result.data as Geography[];
}
