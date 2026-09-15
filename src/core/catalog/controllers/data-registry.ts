import "server-only";

import { createLogger } from "@/core/observability/logger";

import DataRegistryCollection from "../collections/data-registry-collection";
import type {
  CreateDataRegistryPayload,
  UpdateDataRegistryPayload,
} from "../collections/data-registry-collection";

const log = createLogger("catalog.data-registry");

/*************************************************************************
 * DATA REGISTRY Controller
 *************************************************************************/

export async function getDataRegistryEntries() {
  log.info("fetching data registry entries");
  const data = await DataRegistryCollection.list();
  log.info({ count: data.length }, "data registry entries fetched");
  return { data };
}

export async function getDataRegistryEntry({ id }: { id: number }) {
  log.info({ id }, "fetching data registry entry");
  const data = await DataRegistryCollection.getById(id);
  return { data };
}

export async function createDataRegistryEntry({
  payload,
}: {
  payload: CreateDataRegistryPayload;
}) {
  log.info({ payload }, "creating data registry entry");
  const data = await DataRegistryCollection.create(payload);
  log.info({ id: data.id }, "data registry entry created");
  return { message: "Data registry entry created", data };
}

export async function updateDataRegistryEntry({
  id,
  payload,
}: {
  id: number;
  payload: UpdateDataRegistryPayload;
}) {
  log.info({ id, payload }, "updating data registry entry");
  const data = await DataRegistryCollection.update(id, payload);
  log.info({ id }, "data registry entry updated");
  return { message: "Data registry entry updated", data };
}

export async function deleteDataRegistryEntry({ id }: { id: number }) {
  log.info({ id }, "deleting data registry entry");
  await DataRegistryCollection.delete(id);
  log.info({ id }, "data registry entry deleted");
  return { message: "Data registry entry deleted" };
}
