import "server-only";

import ClipboardCollection from "@catalog/collections/clipboard-collection";
import type { ClipboardSeriesRow } from "@catalog/collections/clipboard-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { UpdateSeriesPayload } from "@catalog/collections/series-collection";

import { createLogger } from "@/core/observability/logger";

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
    case "reload": {
      log.info(
        { userId, count: seriesIds.length },
        "reloading clipboard series",
      );
      await SeriesCollection.batchReload({
        seriesIds,
        suffix: "clipboard",
        nightly: false,
      });
      return {
        message: `Reload started for ${seriesIds.length} series`,
      };
    }

    case "reset": {
      let resetCount = 0;
      for (const sid of seriesIds) {
        try {
          const loaders = await LoaderCollection.getBySeriesId(sid);
          for (const loader of loaders) {
            await LoaderCollection.reset(loader.id!);
            resetCount++;
          }
        } catch (e) {
          log.warn(
            { id: sid, error: e instanceof Error ? e.message : String(e) },
            "reset failed for series loader",
          );
        }
      }
      return {
        message: `Reset ${resetCount} loaders across ${seriesIds.length} series`,
      };
    }

    case "clear_data": {
      let cleared = 0;
      for (const sid of seriesIds) {
        try {
          const series = await SeriesCollection.getById(sid);
          if (series.xseriesId) {
            await SeriesCollection.deleteAllDataPoints({
              id: series.xseriesId,
              u: series.universe,
            });
          }
          cleared++;
        } catch (e) {
          log.warn(
            { id: sid, error: e instanceof Error ? e.message : String(e) },
            "clear data failed for series",
          );
        }
      }
      return {
        message: `Cleared data points for ${cleared} of ${seriesIds.length} series`,
      };
    }

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
          log.warn(
            { id, error: e instanceof Error ? e.message : String(e) },
            `${action} failed for series`,
          );
        }
      }
      return { message: `${label} ${updated} of ${seriesIds.length} series` };
    }

    case "destroy": {
      const failed: number[] = [];
      // Two-pass: first attempt, then retry failures (mirrors Rails approach)
      for (const sid of seriesIds) {
        try {
          await SeriesCollection.delete(sid);
        } catch {
          failed.push(sid);
        }
      }
      // Second pass for failures (dependency ordering may resolve after first pass)
      const stillFailed: number[] = [];
      for (const sid of failed) {
        try {
          await SeriesCollection.delete(sid);
        } catch (e) {
          stillFailed.push(sid);
          log.warn(
            { id: sid, error: e instanceof Error ? e.message : String(e) },
            "destroy failed for series on second pass",
          );
        }
      }
      await ClipboardCollection.clear(userId);
      const destroyed = seriesIds.length - stillFailed.length;
      return stillFailed.length > 0
        ? {
            message: `Destroyed ${destroyed} of ${seriesIds.length} series (${stillFailed.length} failed)`,
          }
        : { message: `Destroyed ${destroyed} series` };
    }

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
