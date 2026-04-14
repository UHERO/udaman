import "server-only";

import ClipboardCollection from "@catalog/collections/clipboard-collection";
import type {
  ClipboardLoaderRow,
  ClipboardSeriesRow,
} from "@catalog/collections/clipboard-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { UpdateSeriesPayload } from "@catalog/collections/series-collection";

import { createLogger } from "@/core/observability/logger";
import {
  enqueueClipboardAction,
  enqueueClipboardLoaderReload,
} from "@/core/workers/enqueue";
import { mysql } from "@/lib/mysql/db";

const log = createLogger("catalog.clipboard");

/*************************************************************************
 * CLIPBOARD Controller
 *************************************************************************/

export async function getClipboard({ userId }: { userId: number }): Promise<{
  data: ClipboardSeriesRow[];
  count: number;
}> {
  log.info({ userId }, "fetching clipboard");
  const data = await ClipboardCollection.list(userId);
  log.info({ userId, count: data.length }, "clipboard fetched");
  return { data, count: data.length };
}

export async function addToClipboard({
  userId,
  seriesId,
}: {
  userId: number;
  seriesId: number;
}): Promise<{ message: string }> {
  log.info({ userId, seriesId }, "adding series to clipboard");
  await ClipboardCollection.addSeries(userId, seriesId);
  return { message: "Series added to clipboard" };
}

export async function addMultipleToClipboard({
  userId,
  seriesIds,
}: {
  userId: number;
  seriesIds: number[];
}): Promise<{ message: string; count: number }> {
  log.info(
    { userId, count: seriesIds.length },
    "adding multiple series to clipboard",
  );
  const count = await ClipboardCollection.addMultipleSeries(userId, seriesIds);
  log.info({ userId, added: count }, "series added to clipboard");
  return { message: `${count} series added to clipboard`, count };
}

export async function removeFromClipboard({
  userId,
  seriesId,
}: {
  userId: number;
  seriesId: number;
}): Promise<{ message: string }> {
  log.info({ userId, seriesId }, "removing series from clipboard");
  await ClipboardCollection.removeSeries(userId, seriesId);
  return { message: "Series removed from clipboard" };
}

export async function clearClipboard({
  userId,
}: {
  userId: number;
}): Promise<{ message: string; count: number }> {
  log.info({ userId }, "clearing clipboard");
  const count = await ClipboardCollection.clear(userId);
  log.info({ userId, removed: count }, "clipboard cleared");
  return { message: `${count} series removed from clipboard`, count };
}

// ─── Bulk metadata update ───────────────────────────────────────────

/**
 * Payload for bulk metadata update. Only fields present in the object
 * are applied — omitted fields are left unchanged on each series.
 */
export type BulkMetadataPayload = Omit<
  UpdateSeriesPayload,
  "name" | "geographyId" | "scratch"
>;

export async function bulkUpdateMetadata({
  userId,
  payload,
}: {
  userId: number;
  payload: BulkMetadataPayload;
}): Promise<{ message: string; updated: number; errors: string[] }> {
  const seriesIds = await ClipboardCollection.getSeriesIds(userId);

  if (seriesIds.length === 0) {
    return {
      message: "Clipboard is empty — no action taken",
      updated: 0,
      errors: [],
    };
  }

  const fieldCount = Object.keys(payload).length;
  if (fieldCount === 0) {
    return { message: "No fields selected for update", updated: 0, errors: [] };
  }

  log.info(
    { userId, seriesCount: seriesIds.length, fields: Object.keys(payload) },
    "bulk updating clipboard metadata",
  );

  let updated = 0;
  const errors: string[] = [];

  for (const id of seriesIds) {
    try {
      await SeriesCollection.update(id, payload);
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Series ${id}: ${msg}`);
      log.warn({ id, error: msg }, "bulk metadata update failed for series");
    }
  }

  const message =
    errors.length > 0
      ? `Updated ${updated} of ${seriesIds.length} series (${errors.length} failed)`
      : `Updated ${updated} series`;

  log.info(
    { userId, updated, errors: errors.length },
    "bulk metadata update complete",
  );
  return { message, updated, errors };
}

// ─── Clipboard actions ──────────────────────────────────────────────

export type ClipboardAction =
  | "reload"
  | "reload_with_deps"
  | "reset"
  | "clear_data"
  | "restrict"
  | "unrestrict"
  | "destroy"
  | "meta_update"
  | "export_csv"
  | "export_tsd"
  | "reload_loaders";

// ─── Clipboard loader search & targeted reload ──────────────────────

export async function searchClipboardLoaders({
  userId,
  pattern,
}: {
  userId: number;
  pattern: string;
}): Promise<{ data: ClipboardLoaderRow[] }> {
  log.info({ userId, pattern }, "searching clipboard loaders");
  const data = await ClipboardCollection.searchLoadersByEval(userId, pattern);
  log.info({ userId, pattern, count: data.length }, "clipboard loader search complete");
  return { data };
}

export async function reloadClipboardLoaders({
  userId,
  loaderIds,
}: {
  userId: number;
  loaderIds: number[];
}): Promise<{ message: string }> {
  if (loaderIds.length === 0) {
    return { message: "No loaders to reload" };
  }

  log.info({ userId, loaderCount: loaderIds.length }, "queueing clipboard loader reload");

  // Derive unique series IDs from loader IDs
  const seriesRows = await mysql<{ series_id: number }>`
    SELECT DISTINCT series_id FROM data_sources WHERE id IN ${mysql(loaderIds)}
  `;
  const seriesIds = seriesRows.map((r) => r.series_id);

  // Insert reload_jobs record
  await mysql`
    INSERT INTO reload_jobs (user_id, params, created_at)
    VALUES (${userId}, ${"reload_loaders"}, NOW())
  `;
  const [{ insertId }] = await mysql<{ insertId: number }>`
    SELECT LAST_INSERT_ID() AS insertId
  `;

  // Insert reload_job_series join rows
  for (const sid of seriesIds) {
    await mysql`
      INSERT INTO reload_job_series (reload_job_id, series_id)
      VALUES (${insertId}, ${sid})
    `;
  }

  await enqueueClipboardLoaderReload({
    reloadJobId: insertId,
    loaderIds,
  });

  log.info(
    { userId, reloadJobId: insertId, loaderCount: loaderIds.length },
    "Clipboard loader reload queued",
  );

  return { message: `Reload queued for ${loaderIds.length} loaders` };
}

/** Actions that get queued via BullMQ + tracked in reload_jobs */
const QUEUED_ACTIONS = new Set<ClipboardAction>([
  "reload",
  "reload_with_deps",
  "reset",
  "clear_data",
  "restrict",
  "unrestrict",
  "destroy",
]);

export async function doClipboardAction({
  userId,
  action,
}: {
  userId: number;
  action: ClipboardAction;
}): Promise<{ message: string }> {
  log.info({ userId, action }, "executing clipboard action");

  // Inline actions that don't need queueing
  if (!QUEUED_ACTIONS.has(action)) {
    switch (action) {
      case "meta_update":
        return { message: "Use the Bulk Metadata Update dialog" };
      case "export_csv":
        return { message: "CSV export is handled via download" };
      case "export_tsd":
        return { message: "TSD export is handled via download" };
      default:
        return { message: `Unknown action: ${action}` };
    }
  }

  const seriesIds = await ClipboardCollection.getSeriesIds(userId);

  if (seriesIds.length === 0) {
    return { message: "Clipboard is empty — no action taken" };
  }

  // Insert reload_jobs record
  await mysql`
    INSERT INTO reload_jobs (user_id, params, created_at)
    VALUES (${userId}, ${action}, NOW())
  `;
  const [{ insertId }] = await mysql<{ insertId: number }>`
    SELECT LAST_INSERT_ID() AS insertId
  `;

  // Insert reload_job_series join rows
  for (const sid of seriesIds) {
    await mysql`
      INSERT INTO reload_job_series (reload_job_id, series_id)
      VALUES (${insertId}, ${sid})
    `;
  }

  // Enqueue BullMQ job with high priority
  await enqueueClipboardAction({
    reloadJobId: insertId,
    action: action as Exclude<
      ClipboardAction,
      "meta_update" | "export_csv" | "export_tsd" | "reload_loaders"
    >,
    seriesIds,
  });

  log.info(
    { userId, action, reloadJobId: insertId, seriesCount: seriesIds.length },
    "Clipboard action queued",
  );

  const label = action.replace(/_/g, " ");
  const message =
    action === "reload_with_deps"
      ? `Reload with deps queued for ${seriesIds.length} series (dependents will be added)`
      : `Clipboard ${label} queued for ${seriesIds.length} series`;
  return { message };
}
