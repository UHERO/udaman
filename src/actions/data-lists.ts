"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateDataListPayload,
  UpdateDataListPayload,
} from "@catalog/collections/data-list-collection";
import DataListCollection from "@catalog/collections/data-list-collection";
import MeasurementCollection from "@catalog/collections/measurement-collection";
import type { CreateMeasurementPayload } from "@catalog/collections/measurement-collection";
import {
  addDataListMeasurement as addDataListMeasurementCtrl,
  createDataList as createDataListCtrl,
  deleteDataList as deleteDataListCtrl,
  getDataListsWithCounts as fetchDataLists,
  getDataListForEdit as getDataListForEditCtrl,
  getDataListSuperTable as getDataListSuperTableCtrl,
  moveMeasurement as moveMeasurementCtrl,
  removeDataListMeasurement as removeDataListMeasurementCtrl,
  replaceAllMeasurements as replaceAllMeasurementsCtrl,
  setMeasurementIndent as setMeasurementIndentCtrl,
  updateDataList as updateDataListCtrl,
} from "@catalog/controllers/data-lists";
import { createMeasurement as createMeasurementCtrl } from "@catalog/controllers/measurements";
import type { Universe } from "@catalog/types/shared";

import { addMultipleSeriesToClipboard } from "@/actions/clipboard-actions";
import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.data-lists");

export async function getDataLists(params?: { universe?: Universe }) {
  await requirePermission("data-list", "read");
  log.info({ universe: params?.universe }, "getDataLists action called");
  const result = await fetchDataLists({ u: params?.universe });
  log.info({ count: result.data.length }, "getDataLists action completed");
  return result.data;
}

export async function createDataList(payload: CreateDataListPayload) {
  const { userId } = await requirePermission("data-list", "create");
  log.info("createDataList action called");
  try {
    const result = await createDataListCtrl({ payload });
    revalidatePath("/data-list");
    log.info({ id: result.data.id }, "createDataList action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createDataList failed");
    AppLogCollection.logError(err, { userId, name: "data-list.create" });
    throw err;
  }
}

export async function updateDataList(
  id: number,
  payload: UpdateDataListPayload,
) {
  const { userId } = await requirePermission("data-list", "update");
  log.info({ id }, "updateDataList action called");
  try {
    const result = await updateDataListCtrl({ id, payload });
    revalidatePath("/data-list");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateDataList failed");
    AppLogCollection.logError(err, { userId, name: "data-list.update" });
    throw err;
  }
}

export async function deleteDataList(id: number) {
  const { userId } = await requirePermission("data-list", "delete");
  log.info({ id }, "deleteDataList action called");
  try {
    const result = await deleteDataListCtrl({ id });
    revalidatePath("/data-list");
    log.info({ id }, "deleteDataList action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteDataList failed");
    AppLogCollection.logError(err, { userId, name: "data-list.delete" });
    throw err;
  }
}

export async function getDataListSuperTableData(params: {
  id: number;
  universe: Universe;
  freq?: string;
  geo?: string;
  sa?: string;
}) {
  await requirePermission("data-list", "read");
  log.info({ id: params.id }, "getDataListSuperTableData action called");
  return getDataListSuperTableCtrl(params);
}

export async function getDataListForEdit(id: number) {
  await requirePermission("data-list", "read");
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
  await requirePermission("measurement", "read");
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
  const { userId } = await requirePermission("data-list", "update");
  log.info(
    { dataListId, measurementId, direction },
    "moveMeasurement action called",
  );
  try {
    await moveMeasurementCtrl({ dataListId, measurementId, direction });
    revalidatePath("/data-list");
    return { message: "Measurement moved" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "moveMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "data-list.move_measurement" });
    throw err;
  }
}

export async function setMeasurementIndentAction(
  dataListId: number,
  measurementId: number,
  direction: "in" | "out",
) {
  const { userId } = await requirePermission("data-list", "update");
  log.info(
    { dataListId, measurementId, direction },
    "setMeasurementIndent action called",
  );
  try {
    await setMeasurementIndentCtrl({ dataListId, measurementId, direction });
    revalidatePath("/data-list");
    return { message: "Indent updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "setMeasurementIndent failed");
    AppLogCollection.logError(err, { userId, name: "data-list.set_indent" });
    throw err;
  }
}

export async function removeMeasurementAction(
  dataListId: number,
  measurementId: number,
) {
  const { userId } = await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId }, "removeMeasurement action called");
  try {
    await removeDataListMeasurementCtrl({ dataListId, measurementId });
    revalidatePath("/data-list");
    return { message: "Measurement removed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "removeMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "data-list.remove_measurement" });
    throw err;
  }
}

export async function addMeasurementAction(
  dataListId: number,
  measurementId: number,
) {
  const { userId } = await requirePermission("data-list", "update");
  log.info({ dataListId, measurementId }, "addMeasurement action called");
  try {
    await addDataListMeasurementCtrl({ dataListId, measurementId });
    revalidatePath("/data-list");
    return { message: "Measurement added" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "addMeasurement failed");
    AppLogCollection.logError(err, { userId, name: "data-list.add_measurement" });
    throw err;
  }
}

export async function createMeasurementForDataList(
  dataListId: number,
  payload: CreateMeasurementPayload,
) {
  const { userId } = await requirePermission("data-list", "create");
  log.info({ dataListId }, "createMeasurementForDataList action called");
  try {
    const result = await createMeasurementCtrl({ payload });
    await addDataListMeasurementCtrl({
      dataListId,
      measurementId: result.data.id,
    });
    revalidatePath("/data-list");
    return { message: "Measurement created and added to data list" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createMeasurementForDataList failed");
    AppLogCollection.logError(err, { userId, name: "data-list.create_measurement" });
    throw err;
  }
}

export async function replaceAllMeasurementsAction(
  dataListId: number,
  prefixes: string[],
  universe: Universe,
) {
  const { userId } = await requirePermission("data-list", "update");
  log.info(
    { dataListId, prefixCount: prefixes.length },
    "replaceAllMeasurements action called",
  );
  try {
    const result = await replaceAllMeasurementsCtrl({
      dataListId,
      prefixes,
      universe,
    });
    revalidatePath("/data-list");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "replaceAllMeasurements failed");
    AppLogCollection.logError(err, { userId, name: "data-list.replace_measurements" });
    throw err;
  }
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
