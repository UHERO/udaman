import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import { CreateLoaderFormData } from "../types/sources";
import LoaderCollection from "@catalog/collections/loader-collection";

const log = createLogger("catalog.data-loaders");

/*************************************************************************
 * DATA LOADERS Controller
 * Previously "data sources" — renamed to avoid confusion with the
 * sources / source_details tables.
 *************************************************************************/

export async function getDataLoaders() {
  log.info("fetching all data loaders");
  const data = await LoaderCollection.list();
  log.info({ count: data.length }, "data loaders fetched");
  return { data };
}

export async function getDataLoader({ id }: { id: number }) {
  log.info({ id }, "fetching data loader by id");
  const data = await LoaderCollection.getById(id);
  log.info({ id }, "data loader fetched");
  return { data };
}

export async function createDataLoader({ seriesId, universe, payload }: {
  seriesId: number;
  universe: Universe;
  payload: CreateLoaderFormData;
}) {
  log.info({ seriesId, universe }, "creating data loader");
  const data = await LoaderCollection.create({
    ...payload,
    universe,
    seriesId,
  });
  log.info({ seriesId }, "data loader created");
  return { data };
}
