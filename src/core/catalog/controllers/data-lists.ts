import { createLogger } from "@/core/observability/logger";

import DataListCollection from "../collections/data-list-collection";
import type {
  CreateDataListPayload,
  UpdateDataListPayload,
} from "../collections/data-list-collection";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.data-lists");

/*************************************************************************
 * DATA LISTS Controller
 *************************************************************************/

export async function getDataLists({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching data lists");
  const data = await DataListCollection.list({ universe: u });
  log.info({ count: data.length }, "data lists fetched");
  return { data };
}

export async function getDataListsWithCounts({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching data lists with counts");
  const data = await DataListCollection.listWithCounts({ universe: u });
  log.info({ count: data.length }, "data lists with counts fetched");
  return { data };
}

export async function getDataList({ id }: { id: number }) {
  log.info({ id }, "fetching data list");
  const data = await DataListCollection.getById(id);
  return { data };
}

export async function getDataListMeasurements({ id }: { id: number }) {
  log.info({ id }, "fetching data list measurements");
  const data = await DataListCollection.getMeasurementIds(id);
  log.info({ count: data.length }, "data list measurements fetched");
  return { data };
}

export async function addDataListMeasurement({
  dataListId,
  measurementId,
  listOrder,
  indent,
}: {
  dataListId: number;
  measurementId: number;
  listOrder?: number;
  indent?: string;
}) {
  log.info({ dataListId, measurementId }, "adding measurement to data list");
  await DataListCollection.addMeasurement(
    dataListId,
    measurementId,
    listOrder,
    indent,
  );
  log.info({ dataListId, measurementId }, "measurement added to data list");
}

export async function removeDataListMeasurement({
  dataListId,
  measurementId,
}: {
  dataListId: number;
  measurementId: number;
}) {
  log.info(
    { dataListId, measurementId },
    "removing measurement from data list",
  );
  await DataListCollection.removeMeasurement(dataListId, measurementId);
  log.info({ dataListId, measurementId }, "measurement removed from data list");
}

export async function createDataList({
  payload,
}: {
  payload: CreateDataListPayload;
}) {
  log.info({ payload }, "creating data list");
  const data = await DataListCollection.create(payload);
  log.info({ id: data.id }, "data list created");
  return { message: "Data list created", data };
}

export async function updateDataList({
  id,
  payload,
}: {
  id: number;
  payload: UpdateDataListPayload;
}) {
  log.info({ id, payload }, "updating data list");
  const data = await DataListCollection.update(id, payload);
  log.info({ id }, "data list updated");
  return { message: "Data list updated", data };
}

export async function deleteDataList({ id }: { id: number }) {
  log.info({ id }, "deleting data list");
  await DataListCollection.delete(id);
  log.info({ id }, "data list deleted");
  return { message: "Data list deleted" };
}
