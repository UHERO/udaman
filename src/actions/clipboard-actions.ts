"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId } from "@/lib/auth";
import {
  getClipboard as fetchClipboard,
  addToClipboard as addToClipboardCtrl,
  addMultipleToClipboard as addMultipleCtrl,
  removeFromClipboard as removeFromClipboardCtrl,
  clearClipboard as clearClipboardCtrl,
  doClipboardAction as doClipboardActionCtrl,
  bulkUpdateMetadata as bulkUpdateMetadataCtrl,
} from "@catalog/controllers/clipboard";
import type { ClipboardAction, BulkMetadataPayload } from "@catalog/controllers/clipboard";

const log = createLogger("action.clipboard");

export async function getClipboardSeries() {
  const userId = await getCurrentUserId();
  log.info({ userId }, "getClipboardSeries action called");
  const result = await fetchClipboard({ userId });
  return result;
}

export async function addSeriesToClipboard(seriesId: number) {
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "addSeriesToClipboard action called");
  const result = await addToClipboardCtrl({ userId, seriesId });
  return result;
}

export async function addMultipleSeriesToClipboard(seriesIds: number[]) {
  const userId = await getCurrentUserId();
  log.info({ userId, count: seriesIds.length }, "addMultipleSeriesToClipboard action called");
  const result = await addMultipleCtrl({ userId, seriesIds });
  return result;
}

export async function removeSeriesFromClipboard(seriesId: number) {
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "removeSeriesFromClipboard action called");
  const result = await removeFromClipboardCtrl({ userId, seriesId });
  return result;
}

export async function clearClipboard() {
  const userId = await getCurrentUserId();
  log.info({ userId }, "clearClipboard action called");
  const result = await clearClipboardCtrl({ userId });
  return result;
}

export async function executeClipboardAction(action: ClipboardAction) {
  const userId = await getCurrentUserId();
  log.info({ userId, action }, "executeClipboardAction called");
  const result = await doClipboardActionCtrl({ userId, action });
  return result;
}

export async function bulkUpdateClipboardMetadata(payload: BulkMetadataPayload) {
  const userId = await getCurrentUserId();
  log.info({ userId, fields: Object.keys(payload) }, "bulkUpdateClipboardMetadata called");
  const result = await bulkUpdateMetadataCtrl({ userId, payload });
  return result;
}
