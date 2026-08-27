"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  addMultipleToClipboard as addMultipleCtrl,
  addToClipboard as addToClipboardCtrl,
  bulkUpdateMetadata as bulkUpdateMetadataCtrl,
  clearClipboard as clearClipboardCtrl,
  doClipboardAction as doClipboardActionCtrl,
  getClipboard as fetchClipboard,
  reloadClipboardLoaders as reloadClipboardLoadersCtrl,
  removeFromClipboard as removeFromClipboardCtrl,
  searchClipboardLoaders as searchClipboardLoadersCtrl,
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
  await requirePermission("clipboard", "read");
  const userId = await getCurrentUserId();
  log.info({ userId }, "getClipboardSeries action called");
  const result = await fetchClipboard({ userId });
  return result;
}

export async function addSeriesToClipboard(seriesId: number) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "addSeriesToClipboard action called");
  try {
    const result = await addToClipboardCtrl({ userId, seriesId });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "addSeriesToClipboard failed");
    AppLogCollection.logError(err, { userId, name: "clipboard.add_series" });
    throw err;
  }
}

export async function addMultipleSeriesToClipboard(seriesIds: number[]) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info(
    { userId, count: seriesIds.length },
    "addMultipleSeriesToClipboard action called",
  );
  try {
    const result = await addMultipleCtrl({ userId, seriesIds });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "addMultipleSeriesToClipboard failed");
    AppLogCollection.logError(err, { userId, name: "clipboard.add_multiple" });
    throw err;
  }
}

export async function removeSeriesFromClipboard(seriesId: number) {
  await requirePermission("clipboard", "update");
  const userId = await getCurrentUserId();
  log.info({ userId, seriesId }, "removeSeriesFromClipboard action called");
  try {
    const result = await removeFromClipboardCtrl({ userId, seriesId });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "removeSeriesFromClipboard failed");
    AppLogCollection.logError(err, { userId, name: "clipboard.remove_series" });
    throw err;
  }
}

export async function clearClipboard() {
  await requirePermission("clipboard", "delete");
  const userId = await getCurrentUserId();
  log.info({ userId }, "clearClipboard action called");
  try {
    const result = await clearClipboardCtrl({ userId });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "clearClipboard failed");
    AppLogCollection.logError(err, { userId, name: "clipboard.clear" });
    throw err;
  }
}

export async function executeClipboardAction(action: ClipboardAction) {
  await requirePermission("clipboard", "execute");
  const userId = await getCurrentUserId();
  log.info({ userId, action }, "executeClipboardAction called");
  try {
    const result = await doClipboardActionCtrl({ userId, action });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "executeClipboardAction failed");
    AppLogCollection.logError(err, { userId, name: "clipboard.execute" });
    throw err;
  }
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
  try {
    const result = await bulkUpdateMetadataCtrl({ userId, payload });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "bulkUpdateClipboardMetadata failed");
    AppLogCollection.logError(err, {
      userId,
      name: "clipboard.bulk_update_metadata",
    });
    throw err;
  }
}

export async function searchClipboardLoaders(pattern: string) {
  await requirePermission("clipboard", "read");
  const userId = await getCurrentUserId();
  log.info({ userId, pattern }, "searchClipboardLoaders action called");
  const result = await searchClipboardLoadersCtrl({ userId, pattern });
  return result;
}

export async function reloadClipboardLoaders(loaderIds: number[]) {
  await requirePermission("clipboard", "execute");
  const userId = await getCurrentUserId();
  log.info(
    { userId, loaderCount: loaderIds.length },
    "reloadClipboardLoaders action called",
  );
  try {
    const result = await reloadClipboardLoadersCtrl({ userId, loaderIds });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "reloadClipboardLoaders failed");
    AppLogCollection.logError(err, {
      userId,
      name: "clipboard.reload_loaders",
    });
    throw err;
  }
}
