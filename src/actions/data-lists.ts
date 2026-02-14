"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateDataListPayload,
  UpdateDataListPayload,
} from "@catalog/collections/data-list-collection";
import {
  createDataList as createDataListCtrl,
  deleteDataList as deleteDataListCtrl,
  getDataListsWithCounts as fetchDataLists,
  updateDataList as updateDataListCtrl,
} from "@catalog/controllers/data-lists";
import type { Universe } from "@catalog/types/shared";

import { createLogger } from "@/core/observability/logger";

const log = createLogger("action.data-lists");

export async function getDataLists(params?: { universe?: Universe }) {
  log.info({ universe: params?.universe }, "getDataLists action called");
  const result = await fetchDataLists({ u: params?.universe });
  log.info({ count: result.data.length }, "getDataLists action completed");
  return result.data;
}

export async function createDataList(payload: CreateDataListPayload) {
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
  log.info({ id }, "updateDataList action called");
  const result = await updateDataListCtrl({ id, payload });
  revalidatePath("/data-list");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteDataList(id: number) {
  log.info({ id }, "deleteDataList action called");
  const result = await deleteDataListCtrl({ id });
  revalidatePath("/data-list");
  log.info({ id }, "deleteDataList action completed");
  return { message: result.message };
}
