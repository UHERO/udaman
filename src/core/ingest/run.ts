/**
 * The ingest lifecycle.
 *
 *   runFetch:   claim → strategy (stores raw files, hashed) → record the
 *               fetch run → release → extract each dependent extractor
 *   runExtract: claim → pick input artifacts → skip if the inputs hash
 *               matches the last ok run → parse → validate → write the
 *               extract → record the extraction run → release
 *
 * Fail loudly: a fetch with any failed key is recorded as failed and does
 * not trigger extraction; an extraction with any failed check is recorded
 * as failed and loads keep reading the last ok output. Nothing here
 * enqueues reloads.
 */

import { existsSync } from "node:fs";

import type DataExtractor from "@catalog/models/data-extractor";
import type RawArtifact from "@catalog/models/raw-artifact";

import { createLogger } from "@/core/observability/logger";

import { createFetchContext } from "./context";
import { catalogDb } from "./db";
import type { IngestDb } from "./db";
import { extractRelPath, readExtractIndex, writeExtract } from "./extract-file";
import type { ExtractIndex } from "./extract-file";
import type { HttpFetch } from "./http";
import { normalizeLabel } from "./labels";
import { fileRawStore, sha256 } from "./raw-store";
import type { RawStore } from "./raw-store";
import { SOURCES } from "./registry";
import { runStrategy } from "./strategies";
import type {
  ExtractRow,
  MissingPeriod,
  MissingReason,
  ParseInput,
  SourceModule,
  ValidationResult,
} from "./types";
import { checkConfig, failureSummary, validateExtract } from "./validate";

const log = createLogger("ingest");

/** Everything the runner touches outside its own code (swapped in tests). */
export type RunEnv = {
  db: IngestDb;
  store: RawStore;
  http: HttpFetch;
  sources: Readonly<Record<string, SourceModule>>;
  sleep: (ms: number) => Promise<void>;
};

export function defaultEnv(): RunEnv {
  return {
    db: catalogDb,
    store: fileRawStore(),
    http: (url, init) => fetch(url, init),
    sources: SOURCES,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

function sourceIn(env: RunEnv, key: string): SourceModule {
  const m = env.sources[key];
  if (!m) {
    throw new Error(
      `No source module "${key}" (known: ${Object.keys(env.sources).sort().join(", ") || "none"})`,
    );
  }
  return m;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** JSON with sorted object keys, so equal config hashes equally. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

// ─── Fetch ─────────────────────────────────────────────────────────

export type FetchOptions = {
  /** Refetch even when a source's shortcut says nothing changed */
  force?: boolean;
  /** Also refetch keys marked final */
  full?: boolean;
  /** Run dependent extractors afterwards (default true) */
  extract?: boolean;
  /**
   * Fetch only these filters instead of everything the load statements ask
   * for (a load of a series not downloaded yet). Sources that fetch from
   * the load statements only (BLS, FRED, …).
   */
  only?: Array<Record<string, string>>;
  /** schedule | cli | user:<id> | load */
  triggeredBy?: string | null;
  /** Extra sink for progress lines (BullMQ job.log, CLI stdout) */
  log?: (msg: string) => void;
  env?: Partial<RunEnv>;
};

export type ExtractOutcome = {
  handle: string;
  status: "ok" | "unchanged" | "failed" | "busy" | "disabled";
  runId: number | null;
  message: string;
  rowCount?: number;
  seriesCount?: number;
  failedChecks?: ValidationResult[];
};

export type FetchOutcome = {
  handle: string;
  status: "ok" | "unchanged" | "failed" | "busy" | "disabled";
  runId: number | null;
  message: string;
  stats: Record<string, unknown>;
  extractions: ExtractOutcome[];
};

/** In-process dedup: concurrent identical requests share one run. */
const inFlight = new Map<string, Promise<unknown>>();

function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export function runFetch(
  handle: string,
  opts: FetchOptions = {},
): Promise<FetchOutcome> {
  return dedup(
    `fetch|${handle}|${opts.force ? 1 : 0}|${opts.full ? 1 : 0}|${opts.extract === false ? 0 : 1}|${opts.only ? JSON.stringify(opts.only) : ""}`,
    () => fetchOnce(handle, opts),
  );
}

async function fetchOnce(
  handle: string,
  opts: FetchOptions,
): Promise<FetchOutcome> {
  const env = { ...defaultEnv(), ...opts.env };
  const emit = (msg: string) => {
    log.info({ downloader: handle }, msg);
    opts.log?.(msg);
  };
  const downloader = await env.db.getDownloader(handle);
  const base = { handle, runId: null, stats: {}, extractions: [] };
  if (!downloader.enabled) {
    return { ...base, status: "disabled", message: `${handle} is disabled` };
  }
  if (!(await env.db.claimDownloader(downloader.id))) {
    return {
      ...base,
      status: "busy",
      message: `${handle} is already fetching`,
    };
  }

  const started = Date.now();
  let runId: number | null = null;
  let outcome: FetchOutcome;
  try {
    // a claim taken over from a crashed process leaves its run 'running'
    if (downloader.runningSince) {
      await env.db.failAbandonedFetchRuns(downloader.id);
    }
    runId = await env.db.startFetchRun(downloader.id, opts.triggeredBy ?? null);
    emit(
      `fetch ${handle} (${downloader.strategy})${opts.force ? " force" : ""}${opts.full ? " full" : ""}${opts.only ? ` only ${JSON.stringify(opts.only)}` : ""}`,
    );
    const { ctx, collected } = createFetchContext(
      downloader,
      { db: env.db, store: env.store, http: env.http, sleep: env.sleep },
      {
        force: Boolean(opts.force),
        full: Boolean(opts.full),
        only: opts.only ?? null,
        log: emit,
      },
    );

    let fatal: string | null = null;
    try {
      await runStrategy(downloader, ctx, (k) => sourceIn(env, k));
    } catch (e) {
      fatal = errMsg(e);
    }

    const links = [...collected.links].map(([artifactId, changed]) => ({
      artifactId,
      changed,
    }));
    await env.db.linkArtifacts(runId, links);
    const changed = links.filter((l) => l.changed).length;
    const failed = fatal !== null || collected.keyErrors.length > 0;
    const status = failed ? "failed" : changed > 0 ? "ok" : "unchanged";
    const error = fatal
      ? fatal
      : collected.keyErrors.length
        ? `${collected.keyErrors.length} key(s) failed: ${collected.keyErrors
            .slice(0, 5)
            .map((k) => `${k.key} (${k.message})`)
            .join("; ")}`
        : null;
    const stats: Record<string, unknown> = {
      artifacts: links.length,
      newVintages: changed,
      requests: collected.requests,
      seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      ...(collected.keyErrors.length
        ? {
            keysFailed: collected.keyErrors.slice(0, 100),
            keysFailedCount: collected.keyErrors.length,
          }
        : {}),
      ...(collected.warnings.length
        ? { warnings: collected.warnings.slice(0, 100) }
        : {}),
    };
    if (!failed && Object.keys(collected.statePatch).length) {
      await env.db.setDownloaderState(downloader.id, {
        ...downloader.state,
        ...collected.statePatch,
      });
    }
    await env.db.finishFetchRun(runId, { status, error, stats });
    const message =
      status === "failed"
        ? `${handle}: fetch failed: ${error}`
        : `${handle}: ${links.length} artifact(s), ${changed} new vintage(s) in ${stats.seconds}s`;
    emit(message);
    outcome = { handle, status, runId, message, stats, extractions: [] };
  } catch (e) {
    // bookkeeping itself failed (DB down, ...): record what we can
    const msg = errMsg(e);
    if (runId !== null) {
      await env.db
        .finishFetchRun(runId, { status: "failed", error: msg, stats: {} })
        .catch(() => {});
    }
    emit(`${handle} failed: ${msg}`);
    throw e;
  } finally {
    await env.db.releaseDownloader(downloader.id).catch((err) => {
      log.error({ err: String(err) }, "failed to release downloader claim");
    });
  }

  if (outcome.status !== "failed" && opts.extract !== false) {
    for (const ext of await env.db.dependentsOf(downloader.id)) {
      outcome.extractions.push(
        await runExtract(ext.handle, {
          fetchRunId: runId,
          triggeredBy: opts.triggeredBy ?? null,
          // a fetch that found nothing new usually changes no inputs;
          // don't log an 'unchanged' extraction run for every check
          recordUnchanged: false,
          log: opts.log,
          env: opts.env,
        }),
      );
    }
  }
  return outcome;
}

// ─── Extract ───────────────────────────────────────────────────────

export type ExtractOptions = {
  /** Parse even when the inputs match the last ok run */
  force?: boolean;
  triggeredBy?: string | null;
  fetchRunId?: number | null;
  /** Record a run row when the parse is skipped (default true) */
  recordUnchanged?: boolean;
  log?: (msg: string) => void;
  env?: Partial<RunEnv>;
};

export function runExtract(
  handle: string,
  opts: ExtractOptions = {},
): Promise<ExtractOutcome> {
  return dedup(`extract|${handle}|${opts.force ? 1 : 0}`, () =>
    extractOnce(handle, opts),
  );
}

/** The inputs a parse would read, and their hash. */
export async function resolveInputs(
  extractor: DataExtractor,
  source: SourceModule,
  dims: readonly string[],
  env: Pick<RunEnv, "db" | "store">,
): Promise<{ inputs: ParseInput[]; inputsHash: string }> {
  const links = await env.db.extractorInputs(extractor.id);
  if (links.length === 0) {
    throw new Error(`${extractor.handle} has no input downloaders`);
  }
  const ids = links.map((l) => l.downloaderId);
  const artifacts: RawArtifact[] =
    source.inputVintages === "all"
      ? await env.db.allVintages(ids)
      : await env.db.latestPerKey(ids);
  const byDownloader = new Map(links.map((l) => [l.downloaderId, l]));
  const inputs: ParseInput[] = artifacts.map((artifact) => {
    const link = byDownloader.get(artifact.downloaderId)!;
    return {
      artifact,
      path: env.store.absolute(artifact.storagePath),
      downloaderHandle: link.downloaderHandle ?? String(artifact.downloaderId),
      role: link.role,
    };
  });
  const inputsHash = sha256(
    stableStringify({
      source: source.key,
      version: source.version,
      dims,
      config: extractor.config,
      inputs: inputs
        .map(
          (i) =>
            `${i.downloaderHandle}|${i.role ?? ""}|${i.artifact.artifactKey}|${i.artifact.contentHash}`,
        )
        .sort(),
    }),
  );
  return { inputs, inputsHash };
}

/** Light normalization of every dimension value (never renames). */
function normalizeDims(dims: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dims).map(([k, v]) => [k, normalizeLabel(String(v))]),
  );
}

function normalizeRows(rows: readonly ExtractRow[]): ExtractRow[] {
  return rows.map((r) => ({
    dims: normalizeDims(r.dims),
    date: r.date,
    value: r.value,
  }));
}

function countReasons(missing: readonly MissingPeriod[]) {
  const n: Record<MissingReason, number> = { blank: 0, absent: 0, failed: 0 };
  for (const m of missing) n[m.reason]++;
  return n;
}

/** An always-passing check that reports the missing periods by reason. */
function missingSummary(missing: readonly MissingPeriod[]): ValidationResult {
  const n = countReasons(missing);
  return {
    check: "missing_periods",
    severity: "soft",
    passed: true,
    message: missing.length
      ? `${missing.length} period(s) without a value inside a series' range: ${n.blank} blank in the source, ${n.absent} not reported, ${n.failed} unreadable (waived)`
      : "no period without a value inside a series' range",
    ...(n.failed
      ? {
          details: missing
            .filter((m) => m.reason === "failed")
            .slice(0, 20)
            .map(
              (m) =>
                `${Object.values(m.dims).join(" / ")} ${m.date}: ${m.detail ?? ""}`,
            ),
        }
      : {}),
  };
}

async function extractOnce(
  handle: string,
  opts: ExtractOptions,
): Promise<ExtractOutcome> {
  const env = { ...defaultEnv(), ...opts.env };
  const emit = (msg: string) => {
    log.info({ extractor: handle }, msg);
    opts.log?.(msg);
  };
  const extractor = await env.db.getExtractor(handle);
  if (!extractor.enabled) {
    return {
      handle,
      status: "disabled",
      runId: null,
      message: `${handle} is disabled`,
    };
  }
  if (!(await env.db.claimExtractor(extractor.id))) {
    return {
      handle,
      status: "busy",
      runId: null,
      message: `${handle} is already extracting`,
    };
  }

  let runId: number | null = null;
  try {
    if (extractor.runningSince) {
      await env.db.failAbandonedExtractionRuns(extractor.id);
    }
    const source = sourceIn(env, extractor.sourceKey);
    const dims = [...source.dimensions(extractor)];
    const { inputs, inputsHash } = await resolveInputs(
      extractor,
      source,
      dims,
      env,
    );
    const inputArtifactIds = inputs.map((i) => i.artifact.id);
    const start = () =>
      env.db.startExtractionRun({
        extractorId: extractor.id,
        triggeredBy: opts.triggeredBy ?? null,
        fetchRunId: opts.fetchRunId ?? null,
        inputArtifactIds,
        inputsHash,
      });

    const last = await env.db.latestOkExtraction(extractor.id);
    if (!opts.force && last?.inputsHash === inputsHash) {
      if (opts.recordUnchanged !== false) {
        runId = await start();
        await env.db.finishExtractionRun(runId, { status: "unchanged" });
      }
      const message = `${handle}: inputs unchanged since run ${last.id}, parse skipped`;
      emit(message);
      return { handle, status: "unchanged", runId, message };
    }

    runId = await start();
    if (inputs.length === 0) {
      const error = "no stored artifacts to parse (has the downloader run?)";
      await env.db.finishExtractionRun(runId, { status: "failed", error });
      emit(`${handle}: ${error}`);
      return { handle, status: "failed", runId, message: error };
    }
    const missingFiles = inputs.filter((i) => !existsSync(i.path));
    if (missingFiles.length) {
      const error = `${missingFiles.length} stored file(s) missing on disk, e.g. ${missingFiles[0].artifact.storagePath}`;
      await env.db.finishExtractionRun(runId, { status: "failed", error });
      emit(`${handle}: ${error}`);
      return { handle, status: "failed", runId, message: error };
    }

    emit(`extract ${handle}: ${inputs.length} input file(s)`);
    const started = Date.now();
    let parsed;
    try {
      parsed = await source.parse(inputs, { extractor, log: emit });
    } catch (e) {
      const error = `parse failed: ${errMsg(e)}`;
      await env.db.finishExtractionRun(runId, { status: "failed", error });
      emit(`${handle}: ${error}`);
      return { handle, status: "failed", runId, message: error };
    }
    const rows = normalizeRows(parsed.rows);

    let previous: ExtractIndex | null = null;
    if (last?.outputPath) {
      try {
        previous = readExtractIndex(env.store.absolute(last.outputPath));
      } catch (e) {
        emit(
          `could not read the previous output (${errMsg(e)}); comparison checks skipped`,
        );
      }
    }
    const results = [
      ...validateExtract(rows, {
        dims,
        config: checkConfig(extractor.config),
        previous,
      }),
      ...(parsed.checks ?? []),
    ];

    const missing = (parsed.missing ?? []).map((m) => ({
      ...m,
      dims: normalizeDims(m.dims),
    }));
    results.push(missingSummary(missing));

    const outputPath = extractRelPath(handle, runId);
    const written = writeExtract(
      env.store.absolute(outputPath),
      dims,
      rows,
      missing,
    );
    const failedChecks = results.filter((r) => !r.passed);
    const status = failedChecks.length ? "failed" : "ok";
    const error = failedChecks.length ? failureSummary(results) : null;
    await env.db.finishExtractionRun(runId, {
      status,
      error,
      validationResults: results,
      stats: {
        ...(parsed.stats ?? {}),
        ...(missing.length ? { missing: countReasons(missing) } : {}),
        inputs: inputs.length,
        seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      },
      outputPath,
      outputHash: written.hash,
      rowCount: written.rowCount,
      seriesCount: written.seriesCount,
    });
    const message =
      status === "ok"
        ? `${handle}: ${written.seriesCount} series, ${written.rowCount} rows`
        : `${handle}: validation failed: ${error}`;
    emit(message);
    return {
      handle,
      status,
      runId,
      message,
      rowCount: written.rowCount,
      seriesCount: written.seriesCount,
      ...(failedChecks.length ? { failedChecks } : {}),
    };
  } catch (e) {
    const msg = errMsg(e);
    if (runId !== null) {
      await env.db
        .finishExtractionRun(runId, { status: "failed", error: msg })
        .catch(() => {});
    }
    emit(`${handle} failed: ${msg}`);
    throw e;
  } finally {
    await env.db.releaseExtractor(extractor.id).catch((err) => {
      log.error({ err: String(err) }, "failed to release extractor claim");
    });
  }
}
