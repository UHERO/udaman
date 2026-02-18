"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateDataListPayload,
  UpdateDataListPayload,
} from "@catalog/collections/data-list-collection";
import {
  addDataListMeasurement as addDataListMeasurementCtrl,
  createDataList as createDataListCtrl,
  deleteDataList as deleteDataListCtrl,
  getDataListForEdit as getDataListForEditCtrl,
  getDataListsWithCounts as fetchDataLists,
  getDataListSuperTable as getDataListSuperTableCtrl,
  moveMeasurement as moveMeasurementCtrl,
  removeDataListMeasurement as removeDataListMeasurementCtrl,
  replaceAllMeasurements as replaceAllMeasurementsCtrl,
  setMeasurementIndent as setMeasurementIndentCtrl,
  updateDataList as updateDataListCtrl,
} from "@catalog/controllers/data-lists";
import DataListCollection from "@catalog/collections/data-list-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import type { CreateMeasurementPayload } from "@catalog/collections/measurement-collection";
import { createMeasurement as createMeasurementCtrl } from "@catalog/controllers/measurements";
import type { Universe } from "@catalog/types/shared";

import { addMultipleSeriesToClipboard } from "@/actions/clipboard-actions";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.data-lists");

export async function getDataLists(params?: { universe?: Universe }) {
  log.info({ universe: params?.universe }, "getDataLists action called");
  const result = await fetchDataLists({ u: params?.universe });
  log.info({ count: result.data.length }, "getDataLists action completed");
  return result.data;
}

export async function createDataList(payload: CreateDataListPayload) {
  await requirePermission("data-list", "create");
  log.info("createDataList action called");
  const result = await createDataListCtrl({ payload });
  revalidatePath("/data-list");
  log.info({ id: result.data.id }, "createDataList action completed");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateDataList(
  id: number,
  payload: UpdateDataListPayload,
) {
  await requirePermission("data-list", "update");
  log.info({ id }, "updateDataList action called");
  const result = await updateDataListCtrl({ id, payload });
  revalidatePath("/data-list");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteDataList(id: number) {
  await requirePermission("data-list", "delete");
  log.info({ id }, "deleteDataList action called");
  const result = await deleteDataListCtrl({ id });
  revalidatePath("/data-list");
  log.info({ id }, "deleteDataList action completed");
  return { message: result.message };
}

export async function getDataListSuperTableData(params: {
  id: number;
  universe: Universe;
  freq?: string;
  geo?: string;
  sa?: string;
}) {
  log.info({ id: params.id }, "getDataListSuperTableData action called");
  return getDataListSuperTableCtrl(params);
}

export async function getDataListForEdit(id: number) {
  log.info({ id }, "getDataListForEdit action called");
  const { dataList, measurements, ownerEmail, users } =
    await getDataListForEditCtrl({ id });
  return {
    dataList: {
      ...dataList.toJSON(),
      ownedBy: dataList.ownedBy,
      ownerEmail,
    },
    measurements,
    users,
  };
}

export async function getMeasurementsForUniverse(universe: Universe) {
  log.info({ universe }, "getMeasurementsForUniverse action called");
  const measurements = await MeasurementCollection.list({ universe });
  return measurements.map((m) => ({
    id: m.id,
    prefixAndName: m.prefixAndName,
  }));
}

export async function moveMeasurementAction(
  dataListId: number,
  measurementId: number,
  direction: "up" | "down",
) {
  await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId, direction }, "moveMeasurement action called");
  await moveMeasurementCtrl({ dataListId, measurementId, direction });
  revalidatePath("/data-list");
  return { message: "Measurement moved" };
}

export async function setMeasurementIndentAction(
  dataListId: number,
  measurementId: number,
  direction: "in" | "out",
) {
  await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId, direction }, "setMeasurementIndent action called");
  await setMeasurementIndentCtrl({ dataListId, measurementId, direction });
  revalidatePath("/data-list");
  return { message: "Indent updated" };
}

export async function removeMeasurementAction(
  dataListId: number,
  measurementId: number,
) {
  await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId }, "removeMeasurement action called");
  await removeDataListMeasurementCtrl({ dataListId, measurementId });
  revalidatePath("/data-list");
  return { message: "Measurement removed" };
}

export async function addMeasurementAction(
  dataListId: number,
  measurementId: number,
) {
  await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId }, "addMeasurement action called");
  await addDataListMeasurementCtrl({ dataListId, measurementId });
  revalidatePath("/data-list");
  return { message: "Measurement added" };
}

export async function createMeasurementForDataList(
  dataListId: number,
  payload: CreateMeasurementPayload,
) {
  await requirePermission("data-list", "create");
  log.info({ dataListId }, "createMeasurementForDataList action called");
  const result = await createMeasurementCtrl({ payload });
  await addDataListMeasurementCtrl({
    dataListId,
    measurementId: result.data.id,
  });
  revalidatePath("/data-list");
  return { message: "Measurement created and added to data list" };
}

export async function replaceAllMeasurementsAction(
  dataListId: number,
  prefixes: string[],
  universe: Universe,
) {
  await requirePermission("data-list", "update");
  log.info(
    { dataListId, prefixCount: prefixes.length },
    "replaceAllMeasurements action called",
  );
  const result = await replaceAllMeasurementsCtrl({
    dataListId,
    prefixes,
    universe,
  });
  revalidatePath("/data-list");
  return result;
}

export async function addAllSeriesToClipboardAction(dataListId: number) {
  log.info({ dataListId }, "addAllSeriesToClipboard action called");
  const seriesIds = await DataListCollection.getAllSeriesIds(dataListId);
  if (seriesIds.length === 0) {
    return { message: "No series found in this data list" };
  }
  const result = await addMultipleSeriesToClipboard(seriesIds);
  return { message: result.message };
}
