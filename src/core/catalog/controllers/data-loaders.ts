import "server-only";

import LoaderCollection from "@catalog/collections/loader-collection";
import type { ReloadResult } from "@catalog/collections/loader-collection";
import type { SerializedLoader } from "@catalog/models/loader";

import { createLogger } from "@/core/observability/logger";

import { Universe } from "../types/shared";
import { CreateLoaderFormData, UpdateLoaderFormData } from "../types/sources";

const log = createLogger("catalog.data-loaders");
interface ControllerResponse<T> {
  data: T;
  message: string;
}
/*************************************************************************
 * DATA LOADERS Controller
 * Previously "data sources" — renamed to avoid confusion with the
 * sources / source_details tables.
 *************************************************************************/

export async function getDataLoaders() {
  log.info("fetching all data loaders");
  const data = await LoaderCollection.list();
  log.info({ count: data.length }, "data loaders fetched");
  return { message: "data loaders fetched", data: data.map((d) => d.toJSON()) };
}

export async function getDataLoader({ id }: { id: number }) {
  log.info({ id }, "fetching data loader by id");
  const data = await LoaderCollection.getById(id);
  log.info({ id }, "data loader fetched");
  return { message: "data loader fetched", data: data.toJSON() };
}

export async function createDataLoader({
  seriesId,
  universe,
  payload,
}: {
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
  return { message: "data loader created", data: data.toJSON() };
}

export async function loadDataPoints({
  id,
  clearFirst = false,
}: {
  id: number;
  clearFirst?: boolean;
}): Promise<ControllerResponse<ReloadResult>> {
  log.info({ id }, "loading data points for loader");
  const loader = await LoaderCollection.getById(id);
  const result = await LoaderCollection.reload({ loader, clearFirst });
  log.info({ id, status: result.status }, "data points load completed");
  return { message: result.message, data: result };
}

export async function clearLoaderDataPoints({
  id,
}: {
  id: number;
}): Promise<ControllerResponse<boolean>> {
  log.info({ id }, "clearing data points for loader");
  const loader = await LoaderCollection.getById(id);
  await LoaderCollection.deleteDataPoints(loader);
  log.info({ id }, "data points cleared");
  return { message: "data points cleared", data: true };
}

export async function deleteDataLoader({
  id,
}: {
  id: number;
}): Promise<ControllerResponse<boolean>> {
  log.info({ id }, "deleting data loader");
  await LoaderCollection.delete(id);
  log.info({ id }, "data loader deleted");
  return { message: "data loader deleted", data: true };
}

export async function disableDataLoader({
  id,
}: {
  id: number;
}): Promise<ControllerResponse<SerializedLoader>> {
  log.info({ id }, "disabling data loader");
  const loader = await LoaderCollection.disable(id);
  log.info({ id }, "data loader disabled");
  return { message: "data loader disabled", data: loader.toJSON() };
}

export async function enableDataLoader({
  id,
}: {
  id: number;
}): Promise<ControllerResponse<SerializedLoader>> {
  log.info({ id }, "enabling data loader");
  const loader = await LoaderCollection.update(id, { disabled: false });
  log.info({ id }, "data loader enabled");
  return { message: "data loader enabled", data: loader.toJSON() };
}

export async function updateDataLoader({
  id,
  payload,
}: {
  id: number;
  payload: UpdateLoaderFormData;
}): Promise<ControllerResponse<SerializedLoader>> {
  log.info({ id }, "updating data loader");
  const { scale, ...rest } = payload;
  const loader = await LoaderCollection.update(id, {
    ...rest,
    ...(scale !== undefined ? { scale: String(scale) } : {}),
  });
  log.info({ id }, "data loader updated");
  return { message: "data loader updated", data: loader.toJSON() };
}
