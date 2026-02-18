"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import DataPointCollection from "@catalog/collections/data-point-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import SeriesCollection from "@catalog/collections/series-collection";
import type { CreateSeriesPayload } from "@catalog/collections/series-collection";
import {
  analyzeSeries as analyzeSeriesCtrl,
  compareSeries as compareSeriesCtrl,
  deleteSeriesDataPoints as deleteDataPointsCtrl,
  deleteSeries as deleteSeriesCtrl,
  duplicateSeries as duplicateSeriesCtrl,
  emptyQuarantine as emptyQuarantineCtrl,
  getCompareAllGeos as getCompareAllGeosCtrl,
  getCompareSANS as getCompareSANSCtrl,
  getQuarantinedSeries as fetchQuarantinedSeries,
  getSeries as fetchSeries,
  getSeriesById as fetchSeriesById,
  getSeriesWithNullField as fetchSeriesWithNullField,
  getSourceMap as fetchSourceMap,
  searchSeries,
  transformSeries as transformSeriesCtrl,
  unquarantineSeries as unquarantineSeriesCtrl,
  updateSeries as updateSeriesCtrl,
} from "@catalog/controllers/series";
import type {
  AnalyzeResult,
  CompareResult,
  SeasonalAdjustment,
  SourceMapNode,
  Universe,
} from "@catalog/types/shared";
import { transaction } from "@database/mysql";

import { getGeographies } from "@/core/catalog/controllers/geographies";
import { getSourceDetails } from "@/core/catalog/controllers/source-details";
import { getSources } from "@/core/catalog/controllers/sources";
import { getUnits } from "@/core/catalog/controllers/units";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.series");

/** Used in series summary page */
export async function getSeries(params: { universe?: Universe }) {
  const universe = params.universe ?? "UHERO";
  log.info({ universe }, "getSeries action called");
  const result = await fetchSeries({ universe });
  log.info({ count: result.data.length }, "getSeries action completed");
  return result.data;
}

export async function getSeriesById(
  id: number,
  _params?: { universe?: Universe },
) {
  log.info({ id }, "getSeriesById action called");
  const result = await fetchSeriesById({ id });
  log.info(
    { id, dataPointCount: result.data.dataPoints.length },
    "getSeriesById action completed",
  );
  return {
    ...result.data,
    aliases: result.data.aliases,
  };
}

export async function getSourceMap(
  _id: number,
  queryParams: { name: string | null },
): Promise<SourceMapNode[]> {
  const { name } = queryParams;
  if (name === null) return notFound();
  log.info({ name }, "getSourceMap action called");
  const result = await fetchSourceMap({ name });
  return result.data as SourceMapNode[];
}

export async function deleteSeriesDataPoints(
  id: number,
  queryParams: {
    universe: string;
    date: string;
    deleteBy: "observationDate" | "vintageDate" | "none";
  },
) {
  await requirePermission("series", "delete");
  const { universe, date, deleteBy } = queryParams;
  log.info(
    { id, universe, deleteBy, date },
    "deleteSeriesDataPoints action called",
  );
  const result = await deleteDataPointsCtrl({
    id,
    u: universe as Universe,
    date,
    deleteBy,
  });
  log.info({ id }, "deleteSeriesDataPoints action completed");
  return result.data;
}

export async function searchSeriesAction(term: string, universe: string) {
  return await searchSeries({ term, universe });
}

/** Returns
 * - Geographies
 * - Units
 * - Sources
 * - Source Details
 *
 * Seasonal Adjustments and Frequencies can be kept in a constants.ts file somewhere.
 */
export async function getFormOptions({ universe }: { universe: Universe }) {
  const [geographies, units, sources, sourceDetails] = await Promise.all([
    getGeographies({ u: universe }),
    getUnits({ u: universe }),
    getSources({ u: universe }),
    getSourceDetails({ u: universe }),
  ]);

  return {
    geographies: geographies.data.map((g) => g.toJSON()),
    units: units.data.map((g) => g.toJSON()),
    sources: sources.data.map((g) => g.toJSON()),
    sourceDetails: sourceDetails.data.map((g) => g.toJSON()),
  };
}

export async function getDataPointVintages(xseriesId: number, date: string) {
  log.info({ xseriesId, date }, "getDataPointVintages action called");
  const vintages = await DataPointCollection.getVintagesByDate({
    xseriesId,
    date,
  });
  log.info(
    { xseriesId, date, count: vintages.length },
    "getDataPointVintages action completed",
  );
  return vintages;
}

export async function getAllDataPointVintages(xseriesId: number) {
  log.info({ xseriesId }, "getAllDataPointVintages action called");
  const vintages = await DataPointCollection.getAllVintages({ xseriesId });
  log.info(
    { xseriesId, dates: Object.keys(vintages).length },
    "getAllDataPointVintages action completed",
  );
  return vintages;
}

/** Resolve series names to their IDs. Returns a name→id map. */
export async function resolveSeriesIds(
  names: string[],
): Promise<Record<string, number>> {
  return SeriesCollection.getIdsByNames(names);
}

// ─── Create actions ─────────────────────────────────────────────────

export interface CreateSeriesFormPayload {
  name: string;
  universe: Universe;
  dataPortalName?: string;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  decimals?: number;
  description?: string;
  sourceLink?: string;
  seasonalAdjustment?: SeasonalAdjustment | null;
  frequencyTransform?: string;
  percent?: boolean;
  real?: boolean;
  restricted?: boolean;
  quarantined?: boolean;
  investigationNotes?: string;
}

export async function createSeries(payload: CreateSeriesFormPayload) {
  await requirePermission("series", "create");
  log.info(
    { name: payload.name, universe: payload.universe },
    "createSeries action called",
  );

  const createPayload: CreateSeriesPayload = {
    name: payload.name,
    universe: payload.universe,
    dataPortalName: payload.dataPortalName || null,
    unitId: payload.unitId ?? null,
    sourceId: payload.sourceId ?? null,
    sourceDetailId: payload.sourceDetailId ?? null,
    decimals: payload.decimals ?? 1,
    description: payload.description || null,
    sourceLink: payload.sourceLink || null,
    seasonalAdjustment: payload.seasonalAdjustment ?? null,
    frequencyTransform: payload.frequencyTransform || null,
    percent: payload.percent ?? null,
    real: payload.real ?? null,
    restricted: payload.restricted ?? false,
    quarantined: payload.quarantined ?? false,
    investigationNotes: payload.investigationNotes || null,
  };

  const series = await SeriesCollection.create(createPayload);
  log.info(
    { id: series.id, name: series.name },
    "createSeries action completed",
  );
  revalidatePath(`/udaman/${payload.universe}/series`);
  return series.toJSON();
}

// ─── Bulk create ────────────────────────────────────────────────────

interface ParsedBulkLine {
  name: string;
  evalExpression: string;
}

function parseBulkLine(line: string): ParsedBulkLine | null {
  const match = line.match(/^"([^"]+)"\.ts_eval\s*=\s*%Q\|(.+)\|$/);
  if (!match) return null;
  return { name: match[1], evalExpression: match[2] };
}

export interface BulkCreatePayload {
  universe: Universe;
  definitions: string;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  decimals?: number;
  description?: string;
  sourceLink?: string;
  seasonalAdjustment?: SeasonalAdjustment | null;
  frequencyTransform?: string;
  percent?: boolean;
  real?: boolean;
  restricted?: boolean;
  quarantined?: boolean;
  investigationNotes?: string;
}

export async function bulkCreateSeries(
  payload: BulkCreatePayload,
): Promise<{ successCount: number; errors: string[] }> {
  await requirePermission("series", "create");
  const { universe, definitions, ...optionalMeta } = payload;
  log.info({ universe }, "bulkCreateSeries action called");

  const lines = definitions
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { successCount: 0, errors: ["No definitions provided"] };
  }

  // Parse all lines first — fail fast if any are invalid
  const parsed: ParsedBulkLine[] = [];
  const parseErrors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const result = parseBulkLine(lines[i]);
    if (!result) {
      parseErrors.push(
        `Line ${i + 1}: invalid format — ${lines[i].slice(0, 80)}`,
      );
    } else {
      parsed.push(result);
    }
  }

  if (parseErrors.length > 0) {
    return { successCount: 0, errors: parseErrors };
  }

  // Build shared metadata (only non-empty values)
  const sharedMeta: Partial<CreateSeriesPayload> = {};
  if (optionalMeta.unitId != null) sharedMeta.unitId = optionalMeta.unitId;
  if (optionalMeta.sourceId != null)
    sharedMeta.sourceId = optionalMeta.sourceId;
  if (optionalMeta.sourceDetailId != null)
    sharedMeta.sourceDetailId = optionalMeta.sourceDetailId;
  if (optionalMeta.decimals != null)
    sharedMeta.decimals = optionalMeta.decimals;
  if (optionalMeta.description)
    sharedMeta.description = optionalMeta.description;
  if (optionalMeta.sourceLink) sharedMeta.sourceLink = optionalMeta.sourceLink;
  if (optionalMeta.seasonalAdjustment)
    sharedMeta.seasonalAdjustment = optionalMeta.seasonalAdjustment;
  if (optionalMeta.frequencyTransform)
    sharedMeta.frequencyTransform = optionalMeta.frequencyTransform;
  if (optionalMeta.percent != null) sharedMeta.percent = optionalMeta.percent;
  if (optionalMeta.real != null) sharedMeta.real = optionalMeta.real;
  if (optionalMeta.restricted != null)
    sharedMeta.restricted = optionalMeta.restricted;
  if (optionalMeta.quarantined != null)
    sharedMeta.quarantined = optionalMeta.quarantined;
  if (optionalMeta.investigationNotes)
    sharedMeta.investigationNotes = optionalMeta.investigationNotes;

  // Process within a transaction
  const errors: string[] = [];
  let successCount = 0;

  try {
    successCount = await transaction(async () => {
      let count = 0;
      for (const { name, evalExpression } of parsed) {
        // Find or create the series
        let series;
        try {
          series = await SeriesCollection.getByName(name);
        } catch {
          // Series doesn't exist, create it
          series = await SeriesCollection.create({
            name,
            universe,
            ...sharedMeta,
          });
        }

        // Create the loader with the eval expression
        await LoaderCollection.create({
          seriesId: series.id!,
          code: evalExpression,
          universe,
          priority: 50,
          scale: 1,
          presaveHook: "",
          clearBeforeLoad: false,
          pseudoHistory: false,
        });

        count++;
      }
      return count;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    log.error({ error: msg }, "bulkCreateSeries failed — rolled back");
    return { successCount: 0, errors };
  }

  log.info({ successCount }, "bulkCreateSeries action completed");
  revalidatePath(`/udaman/${universe}/series`);
  return { successCount, errors };
}

// ─── Update ──────────────────────────────────────────────────────────

export interface UpdateSeriesFormPayload {
  name?: string;
  geographyId?: number | null;
  frequency?: string | null;
  dataPortalName?: string;
  unitId?: number | null;
  sourceId?: number | null;
  sourceDetailId?: number | null;
  decimals?: number;
  description?: string;
  sourceLink?: string;
  seasonalAdjustment?: SeasonalAdjustment | null;
  frequencyTransform?: string;
  percent?: boolean;
  real?: boolean;
  restricted?: boolean;
  quarantined?: boolean;
  investigationNotes?: string;
}

export async function updateSeries(
  id: number,
  universe: Universe,
  payload: UpdateSeriesFormPayload,
) {
  await requirePermission("series", "update");
  const result = await updateSeriesCtrl({
    id,
    payload: {
      name: payload.name,
      geographyId: payload.geographyId,
      frequency: payload.frequency,
      dataPortalName: payload.dataPortalName || null,
      unitId: payload.unitId ?? null,
      sourceId: payload.sourceId ?? null,
      sourceDetailId: payload.sourceDetailId ?? null,
      decimals: payload.decimals ?? 1,
      description: payload.description || null,
      sourceLink: payload.sourceLink || null,
      seasonalAdjustment: payload.seasonalAdjustment ?? null,
      frequencyTransform: payload.frequencyTransform || null,
      percent: payload.percent ?? null,
      real: payload.real ?? null,
      restricted: payload.restricted ?? false,
      quarantined: payload.quarantined ?? false,
      investigationNotes: payload.investigationNotes || null,
    },
  });

  revalidatePath(`/udaman/${universe}/series/${id}`);
  return { message: result.message, data: result.data.toJSON() };
}

// ─── Duplicate ───────────────────────────────────────────────────────

export async function duplicateSeries(
  originSeriesId: number,
  universe: Universe,
  copyLoaders: boolean,
  payload: CreateSeriesFormPayload,
) {
  await requirePermission("series", "create");
  const result = await duplicateSeriesCtrl({
    sourceId: originSeriesId,
    payload: {
      name: payload.name,
      universe,
      dataPortalName: payload.dataPortalName || null,
      unitId: payload.unitId ?? null,
      sourceId: payload.sourceId ?? null,
      sourceDetailId: payload.sourceDetailId ?? null,
      decimals: payload.decimals ?? 1,
      description: payload.description || null,
      sourceLink: payload.sourceLink || null,
      seasonalAdjustment: payload.seasonalAdjustment ?? null,
      frequencyTransform: payload.frequencyTransform || null,
      percent: payload.percent ?? null,
      real: payload.real ?? null,
      restricted: payload.restricted ?? false,
      quarantined: payload.quarantined ?? false,
      investigationNotes: payload.investigationNotes || null,
    },
    copyLoaders,
  });

  revalidatePath(`/udaman/${universe}/series`);
  return { message: result.message, data: result.data.toJSON() };
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deleteSeries(
  id: number,
  universe: string,
  opts?: { force?: boolean },
) {
  await requirePermission("series", "delete");
  await deleteSeriesCtrl({ id, force: opts?.force });
  revalidatePath(`/udaman/${universe}/series`);
}

// ─── Null-field audit ───────────────────────────────────────────────

export async function getSeriesWithNullField(
  universe: string,
  field: string,
  page: number = 1,
  perPage: number = 50,
) {
  return fetchSeriesWithNullField({ universe, field, page, perPage });
}

// ─── Quarantine ─────────────────────────────────────────────────────

export async function getQuarantinedSeries(
  universe: string,
  page: number = 1,
  perPage: number = 50,
) {
  return fetchQuarantinedSeries({ universe, page, perPage });
}

export async function unquarantineSeries(seriesId: number, universe: string) {
  await requirePermission("series", "update");
  await unquarantineSeriesCtrl({ seriesId });
  revalidatePath(`/udaman/${universe}/series/quarantine`);
}

export async function emptyQuarantine(universe: string) {
  await requirePermission("series", "delete");
  const count = await emptyQuarantineCtrl({ universe });
  revalidatePath(`/udaman/${universe}/series/quarantine`);
  return count;
}

// ─── Analyze / Transform ─────────────────────────────────────────────

export async function analyzeSeriesAction(id: number): Promise<AnalyzeResult> {
  log.info({ id }, "analyzeSeriesAction called");
  return analyzeSeriesCtrl({ id });
}

export async function transformSeriesAction(
  evalStr: string,
): Promise<AnalyzeResult | { error: string }> {
  log.info({ evalStr }, "transformSeriesAction called");
  try {
    return await transformSeriesCtrl({ evalStr });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ evalStr, error: message }, "transformSeriesAction failed");
    return { error: message };
  }
}

export async function compareSeriesAction(
  names: string[],
): Promise<CompareResult | { error: string }> {
  log.info({ names }, "compareSeriesAction called");
  try {
    return await compareSeriesCtrl({ names });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ names, error: message }, "compareSeriesAction failed");
    return { error: message };
  }
}

// ─── Compare suggestions ─────────────────────────────────────────────

export async function getCompareAllGeosAction(
  name: string,
  universe: string,
): Promise<string[] | null> {
  try {
    return await getCompareAllGeosCtrl({ name, universe });
  } catch {
    return null;
  }
}

export async function getCompareSANSAction(
  name: string,
): Promise<string[] | null> {
  try {
    return await getCompareSANSCtrl({ name });
  } catch {
    return null;
  }
}

// ─── Lookup by name ─────────────────────────────────────────────────

export async function lookupSeriesIdByName(
  name: string,
): Promise<{ id: number } | { error: string }> {
  try {
    const series = await SeriesCollection.getByName(name);
    if (!series.id) return { error: `Series "${name}" not found` };
    return { id: series.id };
  } catch {
    return { error: `Series "${name}" not found` };
  }
}
