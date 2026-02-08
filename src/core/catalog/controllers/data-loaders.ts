import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import { CreateLoaderFormData } from "../types/sources";
import { DataLoaders } from "../models/data-loaders";

const log = createLogger("catalog.data-loaders");

/*************************************************************************
 * DATA LOADERS Controller
 * Previously "data sources" — renamed to avoid confusion with the
 * sources / source_details tables.
 *************************************************************************/

export async function getDataLoaders() {
  // TODO: implement list
  return { data: [] };
}

export async function getDataLoader({ id }: { id: number }) {
  // TODO: implement get by id
  return { data: null, id };
}

export async function createDataLoader({ seriesId, universe, payload }: {
  seriesId: number;
  universe: Universe;
  payload: CreateLoaderFormData;
}) {
  log.info({ seriesId, universe }, "creating data loader");
  const data = await DataLoaders.create({
    ...payload,
    universe,
    seriesId,
  });
  log.info({ seriesId }, "data loader created");
  return { data };
}
