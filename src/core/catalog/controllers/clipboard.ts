import { createLogger } from "@/core/observability/logger";
import ClipboardCollection from "@catalog/collections/clipboard-collection";
import type { ClipboardSeriesRow } from "@catalog/collections/clipboard-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { UpdateSeriesPayload } from "@catalog/collections/series-collection";

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
  log.info({ userId, count: seriesIds.length }, "adding multiple series to clipboard");
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
export type BulkMetadataPayload = Omit<UpdateSeriesPayload, "name" | "geographyId" | "scratch">;

export async function bulkUpdateMetadata({
  userId,
  payload,
}: {
  userId: number;
  payload: BulkMetadataPayload;
}): Promise<{ message: string; updated: number; errors: string[] }> {
  const seriesIds = await ClipboardCollection.getSeriesIds(userId);

  if (seriesIds.length === 0) {
    return { message: "Clipboard is empty — no action taken", updated: 0, errors: [] };
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

  const message = errors.length > 0
    ? `Updated ${updated} of ${seriesIds.length} series (${errors.length} failed)`
    : `Updated ${updated} series`;

  log.info({ userId, updated, errors: errors.length }, "bulk metadata update complete");
  return { message, updated, errors };
}

// ─── Clipboard actions (stubs) ──────────────────────────────────────

export type ClipboardAction =
  | "reload"
  | "reset"
  | "clear_data"
  | "restrict"
  | "unrestrict"
  | "destroy"
  | "meta_update"
  | "export_csv"
  | "export_tsd";

export async function doClipboardAction({
  userId,
  action,
}: {
  userId: number;
  action: ClipboardAction;
}): Promise<{ message: string }> {
  log.info({ userId, action }, "executing clipboard action");

  const seriesIds = await ClipboardCollection.getSeriesIds(userId);

  if (seriesIds.length === 0) {
    return { message: "Clipboard is empty — no action taken" };
  }

  switch (action) {
    case "reload":
      // TODO: Create ReloadJob, associate all clipboard series, queue
      return { message: `Reload not yet implemented (${seriesIds.length} series)` };

    case "reset":
      // TODO: Reset data sources for clipboard series
      return { message: `Reset not yet implemented (${seriesIds.length} series)` };

    case "clear_data":
      // TODO: Delete all data points for clipboard series
      return { message: `Clear data not yet implemented (${seriesIds.length} series)` };

    case "restrict":
    case "unrestrict": {
      const restricted = action === "restrict";
      const label = restricted ? "Restricted" : "Unrestricted";
      let updated = 0;
      for (const id of seriesIds) {
        try {
          await SeriesCollection.update(id, { restricted });
          updated++;
        } catch (e) {
          log.warn({ id, error: e instanceof Error ? e.message : String(e) }, `${action} failed for series`);
        }
      }
      return { message: `${label} ${updated} of ${seriesIds.length} series` };
    }

    case "destroy":
      // TODO: Destroy all clipboard series
      return { message: `Destroy not yet implemented (${seriesIds.length} series)` };

    case "meta_update":
      // TODO: Bulk metadata update form
      return { message: `Meta update not yet implemented (${seriesIds.length} series)` };

    case "export_csv":
      // TODO: Export clipboard series to CSV
      return { message: `CSV export not yet implemented (${seriesIds.length} series)` };

    case "export_tsd":
      // TODO: Export clipboard series to TSD
      return { message: `TSD export not yet implemented (${seriesIds.length} series)` };

    default:
      return { message: `Unknown action: ${action}` };
  }
}
