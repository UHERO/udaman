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
 * Loads never fetch: they read what the last successful extraction wrote.
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
export type LoadContext = { seriesName?: string | null };

export class ExtractLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractLoadError";
  }
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
  | { ok: false; reason: "invalid" | "none" | "many"; message: string };

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
): MatchResult {
  const call = callText(handle, filters);
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {
      ok: false,
      reason: "invalid",
      message: `${call}: pass the filters as an object, e.g. { ${dims.map((d) => `${d}: "…"`).join(", ")} }`,
    };
  }
  const given = Object.entries(filters as Record<string, unknown>);
  if (given.length === 0) {
    return {
      ok: false,
      reason: "invalid",
      message: `${call}: no filters (write them as key: "value"; the dimensions are ${dims.join(", ")})`,
    };
  }
  const unknown = given.map(([k]) => k).filter((k) => !dims.includes(k));
  if (unknown.length) {
    return {
      ok: false,
      reason: "invalid",
      message: `${call}: unknown filter ${unknown.map((k) => `"${k}"`).join(", ")} — ${handle} filters by ${dims.join(", ")}`,
    };
  }
  const want = new Map<string, string>();
  for (const [k, v] of given) {
    if (!["string", "number", "boolean"].includes(typeof v)) {
      return {
        ok: false,
        reason: "invalid",
        message: `${call}: the value of "${k}" must be text`,
      };
    }
    want.set(k, normalizeLabel(String(v)));
  }
  const nameFreq = frequencyOfName(ctx.seriesName);
  if (dims.includes("frequency") && !want.has("frequency") && nameFreq) {
    want.set("frequency", nameFreq);
  }

  const all = [...index.series.values()];
  const matches = all.filter((s) =>
    [...want].every(([k, v]) => s.dims[k] === v),
  );

  if (matches.length === 0) {
    const quoted = (xs: string[]) => xs.map((c) => `"${c}"`).join(", ");
    // one wrong value: dropping it leaves series to suggest from
    for (const [k, v] of want) {
      const others = all.filter((s) =>
        [...want].every(([k2, v2]) => k2 === k || s.dims[k2] === v2),
      );
      if (others.length === 0) continue;
      const ctxText = [...want]
        .filter(([k2]) => k2 !== k)
        .map(([k2, v2]) => `${k2} "${v2}"`)
        .join(", ");
      return {
        ok: false,
        reason: "none",
        message: `${call}: no series with ${k} "${v}"${ctxText ? ` and ${ctxText}` : ""}; closest ${k}: ${quoted(
          closest(
            v,
            others.map((s) => s.dims[k]),
          ),
        )}`,
      };
    }
    // several wrong values: name the ones the extract has never printed
    const unknownValues = [...want].filter(
      ([k, v]) => !all.some((s) => s.dims[k] === v),
    );
    return {
      ok: false,
      reason: "none",
      message: `${call}: no series matches${
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
    };
  }

  if (matches.length > 1) {
    const varying = dims
      .filter((d) => !want.has(d))
      .map((d) => {
        const values = [...new Set(matches.map((s) => s.dims[d]))];
        return values.length > 1
          ? `${d} (${values
              .slice(0, 6)
              .map((v) => `"${v}"`)
              .join(
                ", ",
              )}${values.length > 6 ? `, … ${values.length} values` : ""})`
          : null;
      })
      .filter(Boolean);
    return {
      ok: false,
      reason: "many",
      message: `${call}: matches ${matches.length} series — also filter by ${varying.join("; ")}`,
    };
  }

  const series = matches[0];
  const frequency =
    series.dims.frequency?.toUpperCase() || sourceFrequency || nameFreq;
  if (nameFreq && frequency && nameFreq !== frequency) {
    return {
      ok: false,
      reason: "invalid",
      message: `${call}: ${ctx.seriesName} is ${nameFreq} but the extract series is ${frequency}`,
    };
  }
  return { ok: true, series, frequency };
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
      `${LOAD_METHOD} needs an extractor handle first, e.g. ${LOAD_METHOD}("dotax", { … })`,
    );
  }
  let extractor: DataExtractor;
  try {
    extractor = await DataExtractorCollection.getByHandle(handle);
  } catch {
    const known = (await DataExtractorCollection.list()).map((e) => e.handle);
    throw new ExtractLoadError(
      `${LOAD_METHOD}: no extractor "${handle}"${known.length ? `; closest: ${closest(handle, known).join(", ")}` : ""}`,
    );
  }
  const source = getSource(extractor.sourceKey);
  const run = await ExtractionRunCollection.latestOk(extractor.id);
  if (!run?.outputPath) {
    throw new ExtractLoadError(
      `${LOAD_METHOD}: extractor "${handle}" has no successful extraction yet (bun run ingest extract ${handle})`,
    );
  }
  const index = readExtractIndex(fileRawStore().absolute(run.outputPath));
  if (!index) {
    throw new ExtractLoadError(
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
  const loaded = await latestExtract(handle);
  const m = matchSeries(
    loaded.extractor.handle,
    loaded.dims,
    loaded.index,
    filters,
    ctx,
    loaded.source.frequency ?? null,
  );
  if (!m.ok) throw new ExtractLoadError(m.message);
  return {
    data: new Map(m.series.data),
    frequency: m.frequency,
    description: `loaded from extract ${loaded.extractor.handle} (run #${loaded.run.id}, ${formatHst(loaded.run.finishedAt ?? loaded.run.startedAt, "yyyy-MM-dd")}) with filters shown`,
  };
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
      `${LOAD_METHOD}: the load statement does not parse; write it as ${LOAD_METHOD}("handle", { dimension: "value" })`,
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
    const m = matchSeries(
      loaded.extractor.handle,
      loaded.dims,
      loaded.index,
      call.filters,
      ctx,
      loaded.source.frequency ?? null,
    );
    if (m.ok) continue;
    if (m.reason === "none" && loaded.source.fetchesReferencedFilters) {
      out.warnings.push(
        `${m.message}. ${loaded.extractor.handle} fetches what its load statements ask for, so it will be fetched on the next run.`,
      );
    } else {
      out.errors.push(m.message);
    }
  }
  return out;
}
