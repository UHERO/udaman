/*************************************************************************
 * Ops changes: the one write path for loader and series edits made through
 * ops (approved proposals, dev edits over the catalog MCP, agent writes at an
 * autonomy level above 0). Each change:
 *   - goes through the existing catalog controller (validation, checkEval)
 *   - is logged to data_source_actions (loader action history) with the
 *     ops issue that prompted it, plus app_logs
 *   - is recorded on every live issue about the subject
 *************************************************************************/

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { LoaderActionCollection } from "@catalog/collections/loader-action-collection";
import LoaderCollection from "@catalog/collections/loader-collection";
import type { UpdateSeriesPayload } from "@catalog/collections/series-collection";
import {
  createDataLoader,
  disableDataLoader,
  updateDataLoader,
} from "@catalog/controllers/data-loaders";
import { updateMeasurement } from "@catalog/controllers/measurements";
import { unquarantineSeries, updateSeries } from "@catalog/controllers/series";
import type { Universe } from "@catalog/types/shared";
import type { UpdateLoaderFormData } from "@catalog/types/sources";
import { mysql } from "@database/mysql";

import { enqueueSeriesReload } from "@/core/workers/enqueue";

import { noteSubjectChange, OpsError } from "./issues";
import {
  MEASUREMENT_FIELD_COLUMNS,
  type Actor,
  type MeasurementField,
  type MetadataField,
  type ResolutionPath,
} from "./types";

// ─── Current state (for proposals' `before` and the stale check) ─────

export const LOADER_FIELDS = [
  "eval",
  "priority",
  "scale",
  "presaveHook",
  "clearBeforeLoad",
  "pseudoHistory",
  "reloadNightly",
  "maxLagDays",
  "disabled",
] as const;

export async function currentLoaderState(
  loaderId: number,
): Promise<Record<string, unknown>> {
  const l = await LoaderCollection.getById(loaderId);
  return {
    seriesId: l.seriesId,
    universe: l.universe,
    eval: l.eval,
    priority: l.priority,
    scale: Number(l.scale),
    presaveHook: l.presaveHook,
    clearBeforeLoad: l.clearBeforeLoad,
    pseudoHistory: l.pseudoHistory,
    reloadNightly: l.reloadNightly,
    maxLagDays: l.maxLagDays,
    disabled: l.disabled,
  };
}

/** Series metadata fields agents and devs may change, keyed by DB column. */
export const SERIES_METADATA_COLUMNS: Record<
  MetadataField,
  keyof UpdateSeriesPayload
> = {
  source_id: "sourceId",
  unit_id: "unitId",
  source_detail_id: "sourceDetailId",
  geography_id: "geographyId",
  dataPortalName: "dataPortalName",
  description: "description",
  source_link: "sourceLink",
};

export async function currentSeriesState(
  seriesId: number,
): Promise<Record<string, unknown>> {
  const rows = await mysql<Record<string, unknown>>`
    SELECT s.id, s.name, s.universe, x.quarantined, s.source_id, s.unit_id,
           s.source_detail_id, s.geography_id, s.dataPortalName, s.description,
           s.source_link
    FROM series s
    LEFT JOIN xseries x ON x.id = s.xseries_id
    WHERE s.id = ${seriesId} LIMIT 1
  `;
  if (!rows[0]) throw new OpsError(`Series ${seriesId} not found`);
  const r = rows[0];
  return {
    name: r.name,
    universe: r.universe,
    quarantined: Boolean(r.quarantined),
    source_id: r.source_id ?? null,
    unit_id: r.unit_id ?? null,
    source_detail_id: r.source_detail_id ?? null,
    geography_id: r.geography_id ?? null,
    dataPortalName: r.dataPortalName ?? null,
    description: r.description ?? null,
    source_link: r.source_link ?? null,
  };
}

/** Measurement metadata fields editable through ops → controller payload keys. */
export const MEASUREMENT_METADATA_PROPS: Record<MeasurementField, string> = {
  source_id: "sourceId",
  unit_id: "unitId",
  source_detail_id: "sourceDetailId",
  dataPortalName: "dataPortalName",
  source_link: "sourceLink",
};

export async function currentMeasurementState(
  measurementId: number,
): Promise<Record<string, unknown>> {
  const rows = await mysql<Record<string, unknown>>`
    SELECT id, prefix, universe, source_id, unit_id, source_detail_id,
           data_portal_name, source_link
    FROM measurements WHERE id = ${measurementId} LIMIT 1
  `;
  if (!rows[0]) throw new OpsError(`Measurement ${measurementId} not found`);
  const r = rows[0];
  const out: Record<string, unknown> = {
    prefix: r.prefix,
    universe: r.universe,
  };
  for (const [field, column] of Object.entries(MEASUREMENT_FIELD_COLUMNS))
    out[field] = r[column] ?? null;
  return out;
}

export { stateMatches } from "./rules";

// ─── Writes ───────────────────────────────────────────────────────────

function logLoaderAction(
  actor: Actor,
  loader: {
    id: number;
    seriesId: number | null;
    priority: number;
    eval: string | null;
  },
  action: string,
  issueId: number | null,
) {
  void LoaderActionCollection.create({
    loaderId: loader.id,
    seriesId: loader.seriesId!,
    userId: actor.userId,
    userEmail: actor.email,
    action,
    priority: loader.priority,
    eval: loader.eval,
    opsIssueId: issueId,
  });
  void AppLogCollection.log({
    category: "loader",
    name: `loader.${action.toLowerCase()}`,
    userId: actor.userId ?? undefined,
    subject: "data_sources",
    subjectId: loader.id,
    metadata: { via: actor.via, actor: actor.type, opsIssueId: issueId },
  });
}

export async function applyLoaderUpdate(
  loaderId: number,
  after: Record<string, unknown>,
  actor: Actor,
  issueId: number | null,
): Promise<{ warnings: string[] }> {
  const payload: UpdateLoaderFormData = {};
  for (const [k, v] of Object.entries(after)) {
    if (k === "disabled") continue; // separate action, see applyLoaderDisable
    if (!(LOADER_FIELDS as readonly string[]).includes(k)) {
      throw new OpsError(`Loader field not editable through ops: ${k}`);
    }
    (payload as Record<string, unknown>)[k] = v;
  }
  const result = await updateDataLoader({ id: loaderId, payload });
  logLoaderAction(actor, result.data, "UPDATE", issueId);
  await noteSubjectChange(
    "loader",
    loaderId,
    actor,
    `Loader ${loaderId} updated (${Object.keys(payload).join(", ")})`,
    { after: payload },
  );
  return { warnings: result.warnings };
}

export async function applyLoaderDisable(
  loaderId: number,
  actor: Actor,
  issueId: number | null,
): Promise<void> {
  const result = await disableDataLoader({ id: loaderId });
  logLoaderAction(actor, result.data, "DISABLE", issueId);
  await noteSubjectChange(
    "loader",
    loaderId,
    actor,
    `Loader ${loaderId} disabled`,
  );
}

export async function applyLoaderCreate(
  seriesId: number,
  universe: Universe,
  after: Record<string, unknown>,
  actor: Actor,
  issueId: number | null,
): Promise<{ loaderId: number; warnings: string[] }> {
  const code = String(after.eval ?? "");
  if (!code.trim()) throw new OpsError("A new loader needs an eval");
  const result = await createDataLoader({
    seriesId,
    universe,
    payload: {
      code,
      priority: Number(after.priority ?? 100),
      scale: Number(after.scale ?? 1),
      presaveHook: String(after.presaveHook ?? ""),
      clearBeforeLoad: Boolean(after.clearBeforeLoad ?? false),
      pseudoHistory: Boolean(after.pseudoHistory ?? false),
      maxLagDays: (after.maxLagDays as number | null | undefined) ?? null,
    },
  });
  logLoaderAction(actor, result.data, "CREATE", issueId);
  await noteSubjectChange(
    "series",
    seriesId,
    actor,
    `Loader ${result.data.id} created`,
  );
  return { loaderId: result.data.id, warnings: result.warnings };
}

export async function applySeriesMetadata(
  seriesId: number,
  after: Record<string, unknown>,
  actor: Actor,
  issueId: number | null,
  resolutionPath?: ResolutionPath,
): Promise<void> {
  const payload: UpdateSeriesPayload = {};
  for (const [k, v] of Object.entries(after)) {
    const prop = SERIES_METADATA_COLUMNS[k as MetadataField];
    if (!prop)
      throw new OpsError(`Series field not editable through ops: ${k}`);
    const isId = k.endsWith("_id");
    (payload as Record<string, unknown>)[prop] =
      v === null || v === "" ? null : isId ? Number(v) : String(v);
  }
  await updateSeries({ id: seriesId, payload });
  void AppLogCollection.log({
    category: "series",
    name: "series.metadata_update",
    userId: actor.userId ?? undefined,
    subject: "series",
    subjectId: seriesId,
    metadata: { via: actor.via, actor: actor.type, opsIssueId: issueId, after },
  });
  await noteSubjectChange(
    "series",
    seriesId,
    actor,
    `Series ${seriesId} metadata updated (${Object.keys(after).join(", ")})`,
    { after },
    resolutionPath,
  );
}

export async function applyMeasurementMetadata(
  measurementId: number,
  after: Record<string, unknown>,
  actor: Actor,
  issueId: number | null,
  resolutionPath?: ResolutionPath,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(after)) {
    const prop = MEASUREMENT_METADATA_PROPS[k as MeasurementField];
    if (!prop)
      throw new OpsError(`Measurement field not editable through ops: ${k}`);
    payload[prop] =
      v === null || v === "" ? null : k.endsWith("_id") ? Number(v) : String(v);
  }
  await updateMeasurement({ id: measurementId, payload });
  void AppLogCollection.log({
    category: "measurement",
    name: "measurement.metadata_update",
    userId: actor.userId ?? undefined,
    subject: "measurements",
    subjectId: measurementId,
    metadata: { via: actor.via, actor: actor.type, opsIssueId: issueId, after },
  });
  await noteSubjectChange(
    "measurement",
    measurementId,
    actor,
    `Measurement ${measurementId} metadata updated (${Object.keys(after).join(", ")})`,
    { after },
    resolutionPath,
  );
}

export async function applyUnquarantine(
  seriesId: number,
  actor: Actor,
): Promise<void> {
  await unquarantineSeries({ seriesId });
  await noteSubjectChange(
    "series",
    seriesId,
    actor,
    `Series ${seriesId} unquarantined`,
  );
}

/** Queue a reload; with an issue id the worker verifies the issue after. */
export async function requestReload(
  loaderId: number,
  actor: Actor,
  issueId: number | null,
): Promise<void> {
  const loader = await LoaderCollection.getById(loaderId);
  if (!loader.seriesId) throw new OpsError(`Loader ${loaderId} has no series`);
  await enqueueSeriesReload({
    seriesId: loader.seriesId,
    loaderId,
    clearFirst: false,
    ...(issueId ? { opsIssueId: issueId } : {}),
  });
  void AppLogCollection.log({
    category: "loader",
    name: "loader.ops_reload",
    userId: actor.userId ?? undefined,
    subject: "data_sources",
    subjectId: loaderId,
    metadata: { via: actor.via, actor: actor.type, opsIssueId: issueId },
  });
}
