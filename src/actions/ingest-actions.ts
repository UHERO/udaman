"use server";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import {
  acceptExtractionRun,
  getDownloaderDetail,
  getDownloaderForm,
  getExtractorDetail,
  getExtractorForm,
  getIngestFormOptions,
  getIngestOverview,
  IngestInputError,
  releaseClaim,
  saveDownloader,
  saveExtractor,
  triggerExtract,
  triggerFetch,
} from "@catalog/controllers/ingest";
import type {
  DownloaderDetail,
  DownloaderFormData,
  ExtractorDetail,
  ExtractorFormData,
  IngestFormOptions,
  IngestOverview,
} from "@catalog/controllers/ingest";

import { createLogger } from "@/core/observability/logger";
import type { ActionResult } from "@/lib/action-result";
import { PermissionDeniedError } from "@/lib/auth/authorization";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.ingest");

/**
 * Run a write action: expected failures (not allowed, bad input, not
 * found) come back as `ok: false` so the message survives Next's
 * production redaction; anything else is logged and rethrown.
 */
async function act<T extends object>(
  name: string,
  action: "create" | "update" | "delete",
  fn: (userId: number) => Promise<T>,
): Promise<ActionResult<T>> {
  let userId = 0;
  try {
    ({ userId } = await requirePermission("ingest", action));
    return { ok: true, ...(await fn(userId)) };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return {
        ok: false,
        error: "You don't have permission to do that.",
        denied: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (
      err instanceof IngestInputError ||
      /does not exist|not found/i.test(message)
    ) {
      return { ok: false, error: message };
    }
    log.error({ err: message, userId }, `${name} failed`);
    AppLogCollection.logError(err, { userId, name });
    throw err;
  }
}

// ─── Reads (pages) ─────────────────────────────────────────────────

export async function fetchIngestOverview(): Promise<IngestOverview> {
  await requirePermission("ingest", "read");
  return getIngestOverview();
}

export async function fetchDownloaderDetail(
  handle: string,
  runId?: number | null,
): Promise<DownloaderDetail> {
  await requirePermission("ingest", "read");
  return getDownloaderDetail(handle, runId);
}

export async function fetchExtractorDetail(
  handle: string,
  runId?: number | null,
): Promise<ExtractorDetail> {
  await requirePermission("ingest", "read");
  return getExtractorDetail(handle, runId);
}

export async function fetchIngestFormOptions(): Promise<IngestFormOptions> {
  await requirePermission("ingest", "read");
  return getIngestFormOptions();
}

export async function fetchDownloaderForm(
  handle: string,
): Promise<DownloaderFormData> {
  await requirePermission("ingest", "read");
  return getDownloaderForm(handle);
}

export async function fetchExtractorForm(
  handle: string,
): Promise<ExtractorFormData> {
  await requirePermission("ingest", "read");
  return getExtractorForm(handle);
}

// ─── Writes ────────────────────────────────────────────────────────

export async function fetchNowAction(
  handle: string,
  opts: { force?: boolean; full?: boolean } = {},
) {
  return act("ingest.fetch", "update", (userId) =>
    triggerFetch(handle, opts, userId),
  );
}

export async function extractNowAction(
  handle: string,
  opts: { force?: boolean } = {},
) {
  return act("ingest.extract", "update", (userId) =>
    triggerExtract(handle, opts, userId),
  );
}

export async function acceptRunAction(runId: number) {
  return act("ingest.accept", "update", (userId) =>
    acceptExtractionRun(runId, userId),
  );
}

export async function releaseClaimAction(
  kind: "downloader" | "extractor",
  handle: string,
) {
  return act("ingest.release-claim", "update", () =>
    releaseClaim(kind, handle),
  );
}

export async function saveDownloaderAction(
  existingHandle: string | null,
  form: DownloaderFormData,
) {
  return act(
    "ingest.save-downloader",
    existingHandle ? "update" : "create",
    () => saveDownloader(existingHandle, form),
  );
}

export async function saveExtractorAction(
  existingHandle: string | null,
  form: ExtractorFormData,
) {
  return act(
    "ingest.save-extractor",
    existingHandle ? "update" : "create",
    () => saveExtractor(existingHandle, form),
  );
}
