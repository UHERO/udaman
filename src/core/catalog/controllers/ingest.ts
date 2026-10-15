/*************************************************************************
 * INGEST Controller — data downloaders, extractors and their runs
 * (src/core/ingest). Reads for the UI, and the actions people take: run a
 * fetch or an extraction, accept a soft-failed run, edit config rows.
 *************************************************************************/

import DataDownloaderCollection from "@catalog/collections/data-downloader-collection";
import DataExtractorCollection from "@catalog/collections/data-extractor-collection";
import type { ExtractorInputSpec } from "@catalog/collections/data-extractor-collection";
import ExtractionRunCollection from "@catalog/collections/extraction-run-collection";
import FetchRunCollection from "@catalog/collections/fetch-run-collection";
import RawArtifactCollection from "@catalog/collections/raw-artifact-collection";
import {
  INGEST_STRATEGIES,
  isIngestStrategy,
} from "@catalog/models/data-downloader";
import type {
  IngestStrategy,
  SerializedDataDownloader,
} from "@catalog/models/data-downloader";
import type DataExtractor from "@catalog/models/data-extractor";
import type { SerializedDataExtractor } from "@catalog/models/data-extractor";
import type { SerializedExtractionRun } from "@catalog/models/extraction-run";
import type { SerializedExtractorInput } from "@catalog/models/extractor-input";
import type { SerializedFetchRun } from "@catalog/models/fetch-run";
import type { SerializedRawArtifact } from "@catalog/models/raw-artifact";
import { toHstSql } from "@catalog/utils/time";
import { parseExpression } from "cron-parser";

import { missingPathFor, readMissing } from "@/core/ingest/extract-file";
import { assertSourceKey, sourceKeys, SOURCES } from "@/core/ingest/registry";
import type { MissingPeriod, MissingReason } from "@/core/ingest/types";
import { logControllerCall } from "@/core/observability/app-events";
import { createLogger } from "@/core/observability/logger";
import {
  enqueueIngestExtract,
  enqueueIngestFetch,
} from "@/core/workers/enqueue";

const log = createLogger("catalog.ingest");

/** A mistake the person can fix (bad config, bad state): shown, not logged as a crash. */
export class IngestInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestInputError";
  }
}

// ─── Overview ──────────────────────────────────────────────────────

export type DownloaderSummary = SerializedDataDownloader & {
  keys: number;
  vintages: number;
  bytes: number;
  lastFetch: SerializedFetchRun | null;
  extractors: string[];
};

export type ExtractorSummary = SerializedDataExtractor & {
  inputs: SerializedExtractorInput[];
  lastRun: SerializedExtractionRun | null;
  serving: SerializedExtractionRun | null;
  dimensions: string[];
};

export type IngestOverview = {
  downloaders: DownloaderSummary[];
  extractors: ExtractorSummary[];
};

function dimensionsOf(e: DataExtractor): string[] {
  const source = SOURCES[e.sourceKey];
  return source ? [...source.dimensions(e)] : [];
}

export async function getIngestOverview(): Promise<IngestOverview> {
  logControllerCall("ingest", "getIngestOverview", {});
  const [downloaders, extractors, counts, lastFetch, lastRun] =
    await Promise.all([
      DataDownloaderCollection.list(),
      DataExtractorCollection.list(),
      RawArtifactCollection.countsByDownloader(),
      FetchRunCollection.latestByDownloader(),
      ExtractionRunCollection.latestByExtractor(),
    ]);
  const inputsOf = new Map(
    await Promise.all(
      extractors.map(
        async (e) =>
          [e.id, await DataExtractorCollection.getInputs(e.id)] as const,
      ),
    ),
  );
  const serving = new Map(
    await Promise.all(
      extractors.map(
        async (e) =>
          [e.id, await ExtractionRunCollection.latestOk(e.id)] as const,
      ),
    ),
  );
  return {
    downloaders: downloaders.map((d) => {
      const c = counts.get(d.id);
      return {
        ...d.toJSON(),
        keys: c?.keys ?? 0,
        vintages: c?.vintages ?? 0,
        bytes: c?.bytes ?? 0,
        lastFetch: lastFetch.get(d.id)?.toJSON() ?? null,
        extractors: extractors
          .filter((e) =>
            (inputsOf.get(e.id) ?? []).some((i) => i.downloaderId === d.id),
          )
          .map((e) => e.handle),
      };
    }),
    extractors: extractors.map((e) => ({
      ...e.toJSON(),
      inputs: (inputsOf.get(e.id) ?? []).map((i) => i.toJSON()),
      lastRun: lastRun.get(e.id)?.toJSON() ?? null,
      serving: serving.get(e.id)?.toJSON() ?? null,
      dimensions: dimensionsOf(e),
    })),
  };
}

// ─── Downloader detail ─────────────────────────────────────────────

export type ArtifactRow = SerializedRawArtifact & { vintages: number };

export type DownloaderDetail = {
  downloader: SerializedDataDownloader;
  runs: SerializedFetchRun[];
  artifacts: ArtifactRow[];
  artifactCount: number;
  extractors: string[];
  /** Next scheduled fetch, HST wall-clock; null when unscheduled or disabled */
  nextRun: string | null;
  /** Run shown in detail (?run=), with the artifacts it stored or saw */
  run: SerializedFetchRun | null;
  runArtifacts: Array<{ artifact: SerializedRawArtifact; changed: boolean }>;
};

/** Artifact keys shown on the page (newest first); the rest are counted. */
const ARTIFACT_PAGE = 500;

export async function getDownloaderDetail(
  handle: string,
  runId?: number | null,
): Promise<DownloaderDetail> {
  logControllerCall("ingest", "getDownloaderDetail", { handle, runId });
  const d = await DataDownloaderCollection.getByHandle(handle);
  const [runs, latest, all, dependents] = await Promise.all([
    FetchRunCollection.listForDownloader(d.id, 25),
    RawArtifactCollection.latestPerKey([d.id]),
    RawArtifactCollection.allVintages([d.id]),
    DataExtractorCollection.dependentsOf(d.id),
  ]);
  const vintages = new Map<string, number>();
  for (const a of all) {
    vintages.set(a.artifactKey, (vintages.get(a.artifactKey) ?? 0) + 1);
  }
  const sorted = [...latest].sort(
    (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime() || b.id - a.id,
  );
  const run =
    runId != null
      ? (runs.find((r) => r.id === runId) ??
        (await FetchRunCollection.getById(runId)))
      : null;
  if (run && run.downloaderId !== d.id) {
    throw new IngestInputError(`fetch run ${runId} is not a run of ${handle}`);
  }
  const runArtifacts = run ? await FetchRunCollection.artifactsOf(run.id) : [];
  return {
    downloader: d.toJSON(),
    runs: runs.map((r) => r.toJSON()),
    artifacts: sorted.slice(0, ARTIFACT_PAGE).map((a) => ({
      ...a.toJSON(),
      vintages: vintages.get(a.artifactKey) ?? 1,
    })),
    artifactCount: latest.length,
    extractors: dependents.map((e) => e.handle),
    nextRun: d.enabled ? nextScheduledRun(d.schedule) : null,
    run: run?.toJSON() ?? null,
    runArtifacts: runArtifacts.map((x) => ({
      artifact: x.artifact.toJSON(),
      changed: x.changed,
    })),
  };
}

// ─── Extractor detail ──────────────────────────────────────────────

export type MissingSummary = {
  counts: Record<MissingReason, number>;
  /** The first rows, failed first (they are the ones to look at) */
  sample: MissingPeriod[];
};

export type ExtractorDetail = {
  extractor: SerializedDataExtractor;
  inputs: SerializedExtractorInput[];
  dimensions: string[];
  runs: SerializedExtractionRun[];
  serving: SerializedExtractionRun | null;
  /** Run shown in detail: ?run=, else the latest */
  run: SerializedExtractionRun | null;
  canAccept: boolean;
  missing: MissingSummary | null;
};

const MISSING_SAMPLE = 200;

export async function getExtractorDetail(
  handle: string,
  runId?: number | null,
): Promise<ExtractorDetail> {
  logControllerCall("ingest", "getExtractorDetail", { handle, runId });
  const e = await DataExtractorCollection.getByHandle(handle);
  const [inputs, runs, serving] = await Promise.all([
    DataExtractorCollection.getInputs(e.id),
    ExtractionRunCollection.listForExtractor(e.id, 25),
    ExtractionRunCollection.latestOk(e.id),
  ]);
  const run =
    runId != null
      ? (runs.find((r) => r.id === runId) ??
        (await ExtractionRunCollection.getById(runId)))
      : (runs[0] ?? null);
  if (run && run.extractorId !== e.id) {
    throw new IngestInputError(
      `extraction run ${runId} is not a run of ${handle}`,
    );
  }

  let missing: MissingSummary | null = null;
  const out = run?.outputAbsolutePath();
  if (out) {
    const all = readMissing(out);
    const counts: Record<MissingReason, number> = {
      blank: 0,
      absent: 0,
      failed: 0,
    };
    for (const m of all) counts[m.reason]++;
    const order: Record<MissingReason, number> = {
      failed: 0,
      absent: 1,
      blank: 2,
    };
    missing = {
      counts,
      sample: [...all]
        .sort((a, b) => order[a.reason] - order[b.reason])
        .slice(0, MISSING_SAMPLE),
    };
  }

  return {
    extractor: e.toJSON(),
    inputs: inputs.map((i) => i.toJSON()),
    dimensions: dimensionsOf(e),
    runs: runs.map((r) => r.toJSON()),
    serving: serving?.toJSON() ?? null,
    run: run?.toJSON() ?? null,
    canAccept: run?.canAccept() ?? false,
    missing,
  };
}

// ─── Actions ───────────────────────────────────────────────────────

export async function triggerFetch(
  handle: string,
  opts: { force?: boolean; full?: boolean },
  userId: number,
): Promise<{ message: string }> {
  logControllerCall("ingest", "triggerFetch", { handle, ...opts });
  const d = await DataDownloaderCollection.getByHandle(handle);
  if (!d.enabled) throw new IngestInputError(`${handle} is disabled`);
  await enqueueIngestFetch({
    handle,
    force: opts.force,
    full: opts.full,
    triggeredBy: `user:${userId}`,
  });
  return {
    message: `${handle}: fetch queued${opts.full ? " (full refetch)" : ""}; extractors that read it run after it`,
  };
}

export async function triggerExtract(
  handle: string,
  opts: { force?: boolean },
  userId: number,
): Promise<{ message: string }> {
  logControllerCall("ingest", "triggerExtract", { handle, ...opts });
  const e = await DataExtractorCollection.getByHandle(handle);
  if (!e.enabled) throw new IngestInputError(`${handle} is disabled`);
  await enqueueIngestExtract({
    handle,
    force: opts.force,
    triggeredBy: `user:${userId}`,
  });
  return { message: `${handle}: extraction queued` };
}

export async function acceptExtractionRun(
  runId: number,
  userId: number,
): Promise<{ message: string }> {
  logControllerCall("ingest", "acceptExtractionRun", { runId });
  const run = await ExtractionRunCollection.getById(runId);
  if (!run.canAccept()) {
    throw new IngestInputError(
      `run #${runId} cannot be accepted: only a failed run with an output and only soft failures can`,
    );
  }
  await ExtractionRunCollection.accept(runId, userId);
  const serving = await ExtractionRunCollection.latestOk(run.extractorId);
  log.info({ runId, userId }, "extraction run accepted");
  return {
    message:
      serving?.id === runId
        ? `run #${runId} accepted: loads now read it`
        : `run #${runId} accepted, but newer run #${serving?.id} is still the one loads read`,
  };
}

export async function releaseClaim(
  kind: "downloader" | "extractor",
  handle: string,
): Promise<{ message: string }> {
  logControllerCall("ingest", "releaseClaim", { kind, handle });
  if (kind === "downloader") {
    const d = await DataDownloaderCollection.getByHandle(handle);
    await DataDownloaderCollection.releaseClaim(d.id);
  } else {
    const e = await DataExtractorCollection.getByHandle(handle);
    await DataExtractorCollection.releaseClaim(e.id);
  }
  return { message: `${handle}: run claim released` };
}

// ─── Config forms ──────────────────────────────────────────────────

export type IngestFormOptions = {
  sourceKeys: string[];
  /** Source keys whose module has a fetch() (strategy custom) */
  fetchSourceKeys: string[];
  strategies: readonly IngestStrategy[];
  downloaders: string[];
};

export function getFormOptions(downloaders: string[] = []): IngestFormOptions {
  return {
    sourceKeys: sourceKeys(),
    fetchSourceKeys: sourceKeys().filter((k) => SOURCES[k].fetch),
    strategies: INGEST_STRATEGIES,
    downloaders,
  };
}

export async function getIngestFormOptions(): Promise<IngestFormOptions> {
  return getFormOptions(
    (await DataDownloaderCollection.list()).map((d) => d.handle),
  );
}

export type DownloaderFormData = {
  handle: string;
  sourceKey: string | null;
  strategy: string;
  /** JSON text */
  config: string;
  schedule: string | null;
  enabled: boolean;
  notes: string | null;
};

export type ExtractorFormData = {
  handle: string;
  sourceKey: string;
  /** JSON text */
  config: string;
  enabled: boolean;
  notes: string | null;
  inputs: Array<{ downloader: string; role: string | null }>;
};

function parseConfig(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new IngestInputError(
      `config is not valid JSON: ${e instanceof Error ? e.message : e}`,
    );
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new IngestInputError("config must be a JSON object");
  }
  return v as Record<string, unknown>;
}

/** Five cron fields (minute hour day month weekday), each a simple list/range/step. */
const CRON_FIELD = /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/;

/**
 * When a schedule next fires, as HST wall-clock "YYYY-MM-DD HH:MM:SS".
 * BullMQ computes it the same way: cron-parser, Pacific/Honolulu
 * (ingest-schedules).
 */
function nextScheduledRun(schedule: string | null): string | null {
  if (!schedule) return null;
  try {
    const next = parseExpression(schedule, { tz: "Pacific/Honolulu" }).next();
    return toHstSql(next.toDate()).slice(0, 19);
  } catch {
    return null;
  }
}

function checkSchedule(schedule: string | null): string | null {
  const s = schedule?.trim() || null;
  if (s === null) return null;
  const fields = s.split(/\s+/);
  if (fields.length !== 5 || !fields.every((f) => CRON_FIELD.test(f))) {
    throw new IngestInputError(
      `schedule "${s}" is not a 5-field cron pattern (minute hour day month weekday, Hawaii time), e.g. "10 5 * * *"`,
    );
  }
  return s;
}

function checkDownloader(f: DownloaderFormData) {
  if (!isIngestStrategy(f.strategy)) {
    throw new IngestInputError(`unknown strategy "${f.strategy}"`);
  }
  try {
    if (f.strategy === "custom") assertSourceKey(f.sourceKey, "custom-fetch");
    else if (f.sourceKey) assertSourceKey(f.sourceKey, "extract");
  } catch (e) {
    throw new IngestInputError(e instanceof Error ? e.message : String(e));
  }
}

/** Re-register the schedules (production only; other envs have none). */
async function syncSchedules() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") return;
  const { syncIngestSchedules } =
    await import("@/core/workers/ingest-schedules");
  await syncIngestSchedules();
}

export async function getDownloaderForm(
  handle: string,
): Promise<DownloaderFormData> {
  const d = await DataDownloaderCollection.getByHandle(handle);
  return {
    handle: d.handle,
    sourceKey: d.sourceKey,
    strategy: d.strategy,
    config: JSON.stringify(d.config, null, 2),
    schedule: d.schedule,
    enabled: d.enabled,
    notes: d.notes,
  };
}

export async function saveDownloader(
  existingHandle: string | null,
  f: DownloaderFormData,
): Promise<{ message: string; handle: string }> {
  logControllerCall("ingest", "saveDownloader", {
    existingHandle,
    handle: f.handle,
  });
  checkDownloader(f);
  const payload = {
    sourceKey: f.sourceKey || null,
    strategy: f.strategy as IngestStrategy,
    config: parseConfig(f.config),
    schedule: checkSchedule(f.schedule),
    enabled: f.enabled,
    notes: f.notes?.trim() || null,
  };
  try {
    if (existingHandle) {
      const d = await DataDownloaderCollection.getByHandle(existingHandle);
      await DataDownloaderCollection.update(d.id, payload);
      await syncSchedules();
      return { message: `${existingHandle} saved`, handle: existingHandle };
    }
    await DataDownloaderCollection.create({ handle: f.handle, ...payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Duplicate entry/i.test(msg)) {
      throw new IngestInputError(`a downloader "${f.handle}" already exists`);
    }
    if (/Invalid downloader handle|Unknown fetch strategy/.test(msg)) {
      throw new IngestInputError(msg);
    }
    throw e;
  }
  await syncSchedules();
  return { message: `${f.handle} created`, handle: f.handle };
}

export async function getExtractorForm(
  handle: string,
): Promise<ExtractorFormData> {
  const e = await DataExtractorCollection.getByHandle(handle);
  const inputs = await DataExtractorCollection.getInputs(e.id);
  return {
    handle: e.handle,
    sourceKey: e.sourceKey,
    config: JSON.stringify(e.config, null, 2),
    enabled: e.enabled,
    notes: e.notes,
    inputs: inputs.map((i) => ({
      downloader: i.downloaderHandle ?? String(i.downloaderId),
      role: i.role,
    })),
  };
}

export async function saveExtractor(
  existingHandle: string | null,
  f: ExtractorFormData,
): Promise<{ message: string; handle: string }> {
  logControllerCall("ingest", "saveExtractor", {
    existingHandle,
    handle: f.handle,
  });
  try {
    assertSourceKey(f.sourceKey, "extract");
  } catch (e) {
    throw new IngestInputError(e instanceof Error ? e.message : String(e));
  }
  if (f.inputs.length === 0) {
    throw new IngestInputError(
      "an extractor needs at least one input downloader",
    );
  }
  const inputs: ExtractorInputSpec[] = [];
  for (const i of f.inputs) {
    let d;
    try {
      d = await DataDownloaderCollection.getByHandle(i.downloader);
    } catch {
      throw new IngestInputError(`no downloader "${i.downloader}"`);
    }
    inputs.push({ downloaderId: d.id, role: i.role?.trim() || null });
  }
  const payload = {
    sourceKey: f.sourceKey,
    config: parseConfig(f.config),
    enabled: f.enabled,
    notes: f.notes?.trim() || null,
    inputs,
  };
  try {
    if (existingHandle) {
      const e = await DataExtractorCollection.getByHandle(existingHandle);
      await DataExtractorCollection.update(e.id, payload);
      return { message: `${existingHandle} saved`, handle: existingHandle };
    }
    await DataExtractorCollection.create({ handle: f.handle, ...payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Duplicate entry/i.test(msg)) {
      throw new IngestInputError(`an extractor "${f.handle}" already exists`);
    }
    if (/Invalid extractor handle|listed twice/.test(msg)) {
      throw new IngestInputError(msg);
    }
    throw e;
  }
  return { message: `${f.handle} created`, handle: f.handle };
}

// ─── Files ─────────────────────────────────────────────────────────

/** A raw artifact's file, for download under its original name. */
export async function artifactFile(
  id: number,
): Promise<{ path: string; name: string; contentType: string | null }> {
  const a = await RawArtifactCollection.getById(id);
  const ext = a.storagePath.split(".").pop();
  return {
    path: a.absolutePath(),
    name:
      a.originalName ??
      `${a.artifactKey.replace(/[^\w.-]+/g, "_")}${ext ? `.${ext}` : ""}`,
    contentType: a.contentType,
  };
}

/** An extraction run's extract CSV, or its missing-periods CSV. */
export async function extractFile(
  runId: number,
  which: "extract" | "missing",
): Promise<{ path: string; name: string }> {
  const run = await ExtractionRunCollection.getById(runId);
  const out = run.outputAbsolutePath();
  if (!out) throw new IngestInputError(`run #${runId} has no output`);
  const e = await DataExtractorCollection.getById(run.extractorId);
  return which === "extract"
    ? { path: out, name: `${e.handle}-run${runId}.csv` }
    : {
        path: missingPathFor(out),
        name: `${e.handle}-run${runId}.missing.csv`,
      };
}
