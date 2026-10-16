/**
 * The load side of ingest:
 *
 *   Series.load_from_extract("dotax", { type: "collec", tax: "Income-Ind.", source: "Refunds", area: "State" })
 *
 * reads the extractor's latest ok extract and selects exactly one series by
 * named filters. Rules:
 *  - Filter keys must be the extractor's declared dimensions.
 *  - Values match the extract's labels exactly (after the same light
 *    normalization the extract went through: whitespace, typographic
 *    quotes and dashes).
 *  - Zero matches is an error (the source likely relabeled; the closest
 *    labels are suggested). More than one is an error naming the
 *    dimensions that still vary. No aggregation, no fallback.
 *  - With a `frequency` dimension the filter may omit it: it is taken from
 *    the target series' name (`@HI.M` → M).
 * Loads read what the last successful extraction wrote. The one exception:
 * a source whose fetch list comes from the load statements (BLS, FRED, …)
 * downloads a series it has not fetched yet, then extracts and matches
 * again, so a new load statement works on its first load.
 */

import DataExtractorCollection from "@catalog/collections/data-extractor-collection";
import ExtractionRunCollection from "@catalog/collections/extraction-run-collection";
import type DataExtractor from "@catalog/models/data-extractor";
import type ExtractionRun from "@catalog/models/extraction-run";
import { formatHst } from "@catalog/utils/time";

import { readExtractIndex } from "./extract-file";
import type { ExtractIndex, ExtractSeries } from "./extract-file";
import { normalizeLabel } from "./labels";
import { fileRawStore } from "./raw-store";
import { extractCallsIn, LOAD_METHOD } from "./references";
import { getSource } from "./registry";
import type { SourceModule } from "./types";

export type FilterValue = string | number | boolean;
export type Filters = Record<string, FilterValue>;

/** Context the eval executor passes: the series the load statement fills. */
export type LoadContext = {
  seriesName?: string | null;
  /** The loader's universe, for the extract link in the description */
  universe?: string | null;
};

/**
 * A load_from_extract failure. `message` is plain English for the loader's
 * error (the load statement is shown right below it); `detail` is the full
 * technical account for the admin logs.
 */
export class ExtractLoadError extends Error {
  constructor(
    message: string,
    readonly detail: string = message,
  ) {
    super(message);
    this.name = "ExtractLoadError";
  }
}

/** How load errors name a source and its series. */
export type SeriesNaming = {
  label: string;
  describe(filters: Record<string, string>): string;
  /**
   * Suggest the closest label on a miss. Off for sources keyed by ids
   * (BLS, FRED, …): a nearby id is a different series, not a typo fix.
   */
  suggest: boolean;
};

const FREQUENCY_WORDS: Record<string, string> = {
  A: "annual",
  S: "semiannual",
  Q: "quarterly",
  M: "monthly",
  W: "weekly",
  D: "daily",
};
/** A frequency code in words: "M" → "monthly". */
const freqWord = (f: string) => FREQUENCY_WORDS[f] ?? f;

/** Naming for a source module (or a bare handle, before one is known). */
export function seriesNaming(
  handle: string,
  source?: Pick<
    SourceModule,
    "label" | "describeSeries" | "nameDimensions" | "fetchesReferencedFilters"
  > | null,
): SeriesNaming {
  return {
    label: source?.label ?? handle,
    suggest: !source?.fetchesReferencedFilters,
    describe: (dims) => {
      const custom = source?.describeSeries?.(dims);
      if (custom) return custom;
      const named = source?.nameDimensions;
      const values = (
        named
          ? named.filter((d) => dims[d] !== undefined).map((d) => dims[d])
          : Object.entries(dims)
              .filter(([k]) => k !== "frequency")
              .map(([, v]) => v)
      ).filter((v) => v && v !== "-");
      return values.length ? values.join(" / ") : "these filters";
    },
  };
}

/** One-letter frequency from a series name: "TGBRTNS@HI.M" → "M". */
export function frequencyOfName(
  name: string | null | undefined,
): string | null {
  const m = /@[^.@]+\.([ASQMWD])$/i.exec(name?.trim() ?? "");
  return m ? m[1].toUpperCase() : null;
}

function callText(handle: string, filters: unknown): string {
  return `${LOAD_METHOD}(${JSON.stringify(handle)}, ${JSON.stringify(filters ?? null)})`;
}

/** Case-insensitive Levenshtein distance (for "did you mean"). */
function distance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[t.length];
}

export function closest(
  value: string,
  candidates: Iterable<string>,
  n = 3,
): string[] {
  return [...new Set(candidates)]
    .map((c) => ({ c, d: distance(value, c) }))
    .sort((a, b) => a.d - b.d || a.c.localeCompare(b.c))
    .slice(0, n)
    .map((x) => x.c);
}

export type MatchResult =
  | { ok: true; series: ExtractSeries; frequency: string | null }
  | {
      ok: false;
      reason: "invalid" | "none" | "many";
      /** Plain English, for the loader's error */
      message: string;
      /** The full account, for the admin logs */
      detail: string;
    };

/**
 * Match filters against an extract index. Pure: the load method and
 * save-time validation both use it.
 */
export function matchSeries(
  handle: string,
  dims: readonly string[],
  index: ExtractIndex,
  filters: unknown,
  ctx: LoadContext = {},
  sourceFrequency: string | null = null,
  naming: SeriesNaming = seriesNaming(handle),
): MatchResult {
  const call = callText(handle, filters);
  const { label } = naming;
  const fail = (
    reason: "invalid" | "none" | "many",
    message: string,
    detail: string,
  ): MatchResult => ({
    ok: false,
    reason,
    message,
    detail: `${call}: ${detail}`,
  });

  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return fail(
      "invalid",
      `The ${label} filters must be written as { ${dims[0]}: "…" }`,
      `pass the filters as an object, e.g. { ${dims.map((d) => `${d}: "…"`).join(", ")} }`,
    );
  }
  const given = Object.entries(filters as Record<string, unknown>);
  if (given.length === 0) {
    return fail(
      "invalid",
      `No ${label} filters given; use ${dims.join(", ")}`,
      `no filters (write them as key: "value"; the dimensions are ${dims.join(", ")})`,
    );
  }
  const unknown = given.map(([k]) => k).filter((k) => !dims.includes(k));
  if (unknown.length) {
    return fail(
      "invalid",
      `${label} can't be filtered by ${unknown.map((k) => `"${k}"`).join(", ")}; use ${dims.join(", ")}`,
      `unknown filter ${unknown.map((k) => `"${k}"`).join(", ")} — ${handle} filters by ${dims.join(", ")}`,
    );
  }
  const want = new Map<string, string>();
  for (const [k, v] of given) {
    if (!["string", "number", "boolean"].includes(typeof v)) {
      return fail(
        "invalid",
        `The ${label} filter "${k}" must be text`,
        `the value of "${k}" must be text`,
      );
    }
    want.set(k, normalizeLabel(String(v)));
  }
  const series = naming.describe(Object.fromEntries(want));
  const nameFreq = frequencyOfName(ctx.seriesName);
  if (dims.includes("frequency") && !want.has("frequency") && nameFreq) {
    want.set("frequency", nameFreq);
  }

  const all = [...index.series.values()];
  const matches = all.filter((s) =>
    [...want].every(([k, v]) => s.dims[k] === v),
  );

  if (matches.length === 0) {
    const noData = `No ${label} data returned for ${series}`;
    const quoted = (xs: string[]) => xs.map((c) => `"${c}"`).join(", ");
    // one wrong value: dropping it leaves series to suggest from
    for (const [k, v] of want) {
      const others = all.filter((s) =>
        [...want].every(([k2, v2]) => k2 === k || s.dims[k2] === v2),
      );
      if (others.length === 0) continue;
      const near = closest(
        v,
        others.map((s) => s.dims[k]),
      );
      const ctxText = [...want]
        .filter(([k2]) => k2 !== k)
        .map(([k2, v2]) => `${k2} "${v2}"`)
        .join(", ");
      return fail(
        "none",
        k === "frequency"
          ? `${noData} at ${freqWord(v)} frequency`
          : naming.suggest
            ? `${noData} (did you mean ${k} "${near[0]}"?)`
            : noData,
        `no series with ${k} "${v}"${ctxText ? ` and ${ctxText}` : ""}; closest ${k}: ${quoted(near)}`,
      );
    }
    // several wrong values: name the ones the extract has never printed
    const unknownValues = [...want].filter(
      ([k, v]) => !all.some((s) => s.dims[k] === v),
    );
    return fail(
      "none",
      noData,
      `no series matches${
        unknownValues.length
          ? ` — ${unknownValues
              .map(
                ([k, v]) =>
                  `${k} "${v}" is not in the extract (closest: ${quoted(
                    closest(
                      v,
                      all.map((s) => s.dims[k]),
                    ),
                  )})`,
              )
              .join("; ")}`
          : " this combination of filters"
      }`,
    );
  }

  if (matches.length > 1) {
    const varying = dims
      .filter((d) => !want.has(d))
      .map((d) => ({ d, values: [...new Set(matches.map((s) => s.dims[d]))] }))
      .filter((x) => x.values.length > 1);
    const names = varying.map((x) => x.d);
    const also =
      names.length > 1
        ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
        : names[0];
    return fail(
      "many",
      `${matches.length} ${label} series match ${series}; also filter by ${also}`,
      `matches ${matches.length} series — also filter by ${varying
        .map(
          ({ d, values }) =>
            `${d} (${values
              .slice(0, 6)
              .map((v) => `"${v}"`)
              .join(
                ", ",
              )}${values.length > 6 ? `, … ${values.length} values` : ""})`,
        )
        .join("; ")}`,
    );
  }

  const match = matches[0];
  const frequency =
    match.dims.frequency?.toUpperCase() || sourceFrequency || nameFreq;
  if (nameFreq && frequency && nameFreq !== frequency) {
    return fail(
      "invalid",
      `${ctx.seriesName} is ${freqWord(nameFreq)} but the ${label} data for ${series} is ${freqWord(frequency)}`,
      `${ctx.seriesName} is ${nameFreq} but the extract series is ${frequency}`,
    );
  }
  return { ok: true, series: match, frequency };
}

export type LoadedExtract = {
  extractor: DataExtractor;
  source: SourceModule;
  dims: readonly string[];
  run: ExtractionRun;
  index: ExtractIndex;
};

/** The extractor's latest ok extract, indexed (cached by file mtime). */
export async function latestExtract(handle: unknown): Promise<LoadedExtract> {
  if (typeof handle !== "string" || !handle) {
    throw new ExtractLoadError(
      `${LOAD_METHOD} needs a data source name first`,
      `${LOAD_METHOD} needs an extractor handle first, e.g. ${LOAD_METHOD}("dotax", { … })`,
    );
  }
  let extractor: DataExtractor;
  try {
    extractor = await DataExtractorCollection.getByHandle(handle);
  } catch {
    const known = (await DataExtractorCollection.list()).map((e) => e.handle);
    const near = known.length ? closest(handle, known) : [];
    throw new ExtractLoadError(
      `There is no "${handle}" data source${near.length ? ` (did you mean "${near[0]}"?)` : ""}`,
      `${LOAD_METHOD}: no extractor "${handle}"${near.length ? `; closest: ${near.join(", ")}` : ""}`,
    );
  }
  const source = getSource(extractor.sourceKey);
  const { label } = seriesNaming(handle, source);
  const run = await ExtractionRunCollection.latestOk(extractor.id);
  if (!run?.outputPath) {
    throw new ExtractLoadError(
      `No ${label} data yet; it hasn't been downloaded successfully`,
      `${LOAD_METHOD}: extractor "${handle}" has no successful extraction yet (bun run ingest extract ${handle})`,
    );
  }
  const index = readExtractIndex(fileRawStore().absolute(run.outputPath));
  if (!index) {
    throw new ExtractLoadError(
      `The latest ${label} data file is missing`,
      `${LOAD_METHOD}: the output of ${handle} run #${run.id} is missing (${run.outputPath})`,
    );
  }
  return { extractor, source, dims: source.dimensions(extractor), run, index };
}

export type ExtractSeriesData = {
  data: Map<string, number>;
  /** One-letter frequency code, if known */
  frequency: string | null;
  description: string;
};

/** Series.load_from_extract(handle, filters) */
export async function loadFromExtract(
  handle: unknown,
  filters: unknown,
  ctx: LoadContext = {},
): Promise<ExtractSeriesData> {
  let loaded = await latestExtractOrNull(handle);
  let m = loaded ? matchIn(loaded, filters, ctx) : null;
  let fetchNote = "";
  // a source that fetches what its load statements ask for (BLS, FRED, …)
  // downloads a series no run has fetched yet, then extracts again
  if ((!m || (!m.ok && m.reason === "none")) && typeof handle === "string") {
    const fetched = await fetchForLoad(handle, filters, ctx);
    if (fetched) {
      fetchNote = fetched;
      loaded = await latestExtract(handle);
      m = matchIn(loaded, filters, ctx);
    }
  }
  if (!loaded) loaded = await latestExtract(handle); // throws the plain error
  if (!m) m = matchIn(loaded, filters, ctx);
  if (!m.ok) {
    throw new ExtractLoadError(
      m.message,
      `${m.detail} (extract run #${loaded.run.id})${fetchNote ? `; ${fetchNote}` : ""}`,
    );
  }
  return {
    data: new Map(m.series.data),
    frequency: m.frequency,
    description: loadDescription(loaded, m.series.dims, ctx),
  };
}

// The UI renders <a href="…">…</a> from the text and shows the rest as is
// (no entity decoding), so only what would break an anchor is changed.
const escapeAttr = (s: string) => s.replace(/"/g, "%22");
const escapeText = (s: string) => s.replace(/[<>]/g, "");

/**
 * The loader description: "Loaded CUURS35DSA0 from BLS (cached Oct 15,
 * 2026)". The source name links to the series' page at the source, when
 * it has one, and the date to the extractor's page.
 */
export function loadDescription(
  loaded: Pick<LoadedExtract, "extractor" | "source" | "run">,
  dims: Record<string, string>,
  ctx: LoadContext = {},
): string {
  const { extractor, source, run } = loaded;
  const naming = seriesNaming(extractor.handle, source);
  const url = source.sourceUrl?.(dims) ?? null;
  const from = url
    ? `<a href="${escapeAttr(url)}">${escapeText(naming.label)}</a>`
    : escapeText(naming.label);
  const extractPage = `/udaman/${encodeURIComponent(ctx.universe || "UHERO")}/ingest/extractors/${encodeURIComponent(extractor.handle)}`;
  const cached = formatHst(run.finishedAt ?? run.startedAt, "MMM d, yyyy");
  return `Loaded ${escapeText(naming.describe(dims))} from ${from} (cached <a href="${escapeAttr(extractPage)}">${cached}</a>)`;
}

function matchIn(
  loaded: LoadedExtract,
  filters: unknown,
  ctx: LoadContext,
): MatchResult {
  return matchSeries(
    loaded.extractor.handle,
    loaded.dims,
    loaded.index,
    filters,
    ctx,
    loaded.source.frequency ?? null,
    seriesNaming(loaded.extractor.handle, loaded.source),
  );
}

/** latestExtract, or null when the extractor has no usable output yet. */
async function latestExtractOrNull(
  handle: unknown,
): Promise<LoadedExtract | null> {
  try {
    return await latestExtract(handle);
  } catch (e) {
    if (typeof handle !== "string") throw e;
    // a missing extractor is not something a fetch fixes
    const extractor = await DataExtractorCollection.getByHandle(handle).catch(
      () => null,
    );
    if (!extractor) throw e;
    return null;
  }
}

/**
 * Fetch just this load statement's series through the extractor's
 * downloaders (the run extracts afterwards). Only for sources whose fetch
 * list comes from the load statements. Returns a note for the detail, or
 * null when the source doesn't fetch that way; throws a plain error when
 * the download is busy or fails.
 */
async function fetchForLoad(
  handle: string,
  filters: unknown,
  ctx: LoadContext,
): Promise<string | null> {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return null;
  }
  const extractor = await DataExtractorCollection.getByHandle(handle);
  const source = getSource(extractor.sourceKey);
  if (!source.fetchesReferencedFilters || !source.fetch) return null;
  const naming = seriesNaming(handle, source);
  const wanted = Object.fromEntries(
    Object.entries(filters as Record<string, unknown>).map(([k, v]) => [
      k,
      normalizeLabel(String(v)),
    ]),
  );
  const series = naming.describe(wanted);
  const nameFreq = frequencyOfName(ctx.seriesName);
  if (
    source.dimensions(extractor).includes("frequency") &&
    wanted.frequency === undefined &&
    nameFreq
  ) {
    wanted.frequency = nameFreq;
  }

  const { runFetch } = await import("./run");
  const notes: string[] = [];
  for (const input of await DataExtractorCollection.getInputs(extractor.id)) {
    if (!input.downloaderHandle) continue;
    const out = await runFetch(input.downloaderHandle, {
      only: [wanted],
      triggeredBy: "load",
    });
    if (out.status === "busy") {
      throw new ExtractLoadError(
        `${naming.label} is downloading right now; try again in a minute`,
        `fetch for ${series}: ${out.message}`,
      );
    }
    if (out.status === "failed") {
      throw new ExtractLoadError(
        `The ${naming.label} download for ${series} failed`,
        `fetch run #${out.runId}: ${out.message}`,
      );
    }
    const warnings = (out.stats.warnings as string[] | undefined) ?? [];
    notes.push(
      `fetched ${series} (run #${out.runId}, ${out.status})${warnings.length ? `: ${warnings.join("; ")}` : ""}`,
    );
    const failedExtract = out.extractions.find((x) => x.status === "failed");
    if (failedExtract) {
      throw new ExtractLoadError(
        `${naming.label} data was downloaded but could not be read`,
        `${failedExtract.handle}: ${failedExtract.message}`,
      );
    }
  }
  return notes.join("; ") || null;
}

// ─── Save-time validation ──────────────────────────────────────────

export type LoadStatementCheck = {
  /** Block the save */
  errors: string[];
  /** Saved, but worth showing (e.g. BLS will fetch a new series id) */
  warnings: string[];
};

/**
 * Check every load_from_extract call in an eval against the latest
 * extract: the extractor exists, filter keys are its dimensions, and the
 * filters pick exactly one series. A source whose fetch list comes from
 * the load statements (BLS) gets a warning instead of an error for a
 * series not fetched yet. Evals without load_from_extract pass untouched.
 */
export async function checkLoadStatement(
  evalStr: string,
  ctx: LoadContext = {},
): Promise<LoadStatementCheck> {
  const out: LoadStatementCheck = { errors: [], warnings: [] };
  if (!evalStr.includes(LOAD_METHOD)) return out;
  const calls = extractCallsIn(evalStr);
  if (calls.length === 0) {
    out.errors.push(
      `The load statement can't be read; write it as ${LOAD_METHOD}("source", { name: "value" })`,
    );
    return out;
  }
  for (const call of calls) {
    let loaded: LoadedExtract;
    try {
      loaded = await latestExtract(call.handle);
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const naming = seriesNaming(loaded.extractor.handle, loaded.source);
    const m = matchSeries(
      loaded.extractor.handle,
      loaded.dims,
      loaded.index,
      call.filters,
      ctx,
      loaded.source.frequency ?? null,
      naming,
    );
    if (m.ok) continue;
    if (m.reason === "none" && loaded.source.fetchesReferencedFilters) {
      const given = Object.entries(call.filters ?? {}).map(([k, v]) => [
        k,
        normalizeLabel(String(v)),
      ]);
      out.warnings.push(
        `No ${naming.label} data for ${naming.describe(Object.fromEntries(given))} yet; it will be downloaded when the series loads`,
      );
    } else {
      out.errors.push(m.message);
    }
  }
  return out;
}
