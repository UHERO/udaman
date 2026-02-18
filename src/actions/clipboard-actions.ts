"use server";

import { revalidatePath } from "next/cache";
import {
  addMultipleToClipboard as addMultipleCtrl,
  addToClipboard as addToClipboardCtrl,
  bulkUpdateMetadata as bulkUpdateMetadataCtrl,
  clearClipboard as clearClipboardCtrl,
  doClipboardAction as doClipboardActionCtrl,
  getClipboard as fetchClipboard,
  removeFromClipboard as removeFromClipboardCtrl,
} from "@catalog/controllers/clipboard";
import type {
  BulkMetadataPayload,
  ClipboardAction,
} from "@catalog/controllers/clipboard";

import { createLogger } from "@/core/observability/logger";
import { getCurrentUserId } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.clipboard");

export async function getClipboardSeries() {
  const userId = await getCurrentUserId();
  log.info({ userId }, "getClipboardSeries action called");
  const result = await fetchClipboard({ userId });
  return result;
}

export async function addSeriesToClipboard(seriesId: number) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "addSeriesToClipboard action called");
  const result = await addToClipboardCtrl({ userId, seriesId });
  return result;
}

export async function addMultipleSeriesToClipboard(seriesIds: number[]) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info(
    { userId, count: seriesIds.length },
    "addMultipleSeriesToClipboard action called",
  );
  const result = await addMultipleCtrl({ userId, seriesIds });
  return result;
}

export async function removeSeriesFromClipboard(seriesId: number) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "removeSeriesFromClipboard action called");
  const result = await removeFromClipboardCtrl({ userId, seriesId });
  return result;
}

export async function clearClipboard() {
  await requirePermission("clipboard", "delete");
  const userId = await getCurrentUserId();
  log.info({ userId }, "clearClipboard action called");
  const result = await clearClipboardCtrl({ userId });
  return result;
}

export async function executeClipboardAction(action: ClipboardAction) {
  await requirePermission("clipboard", "execute");
  const userId = await getCurrentUserId();
  log.info({ userId, action }, "executeClipboardAction called");
  const result = await doClipboardActionCtrl({ userId, action });
  return result;
}

export async function bulkUpdateClipboardMetadata(
  payload: BulkMetadataPayload,
) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info(
    { userId, fields: Object.keys(payload) },
    "bulkUpdateClipboardMetadata called",
  );
  const result = await bulkUpdateMetadataCtrl({ userId, payload });
  return result;
}
