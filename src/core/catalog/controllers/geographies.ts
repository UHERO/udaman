import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import Geographies from "../models/geographies";

const log = createLogger("catalog.geographies");

/*************************************************************************
 * GEOGRAPHIES Controller
 *************************************************************************/

export async function getGeographies({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching geographies");
  const data = await Geographies.list({ universe: u });
  log.info({ count: (data as any[]).length }, "geographies fetched");
  return { data };
}

export async function getGeography({ id }: { id: number }) {
  log.info({ id }, "fetching geography");
  const data = await Geographies.getById(id);
  return { data };
}
