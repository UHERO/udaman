/**
 * Change kinds for metadata on series and measurements, and unquarantine.
 *
 * The portal shows a series' own value and falls back to its measurement's,
 * so the same field can be set at either level (see the missing-metadata
 * playbook for which to use).
 */

import { rawQuery } from "@database/mysql";
import { z } from "zod";

import { registerChangeKind } from "../change-registry";
import {
  applyMeasurementMetadata,
  applySeriesMetadata,
  applyUnquarantine,
  currentMeasurementState,
  currentSeriesState,
} from "../changes";
import { OpsError } from "../issues";
import { metadataChangeType } from "../rules";

const id = z.number().int().positive().nullable();
const text = z.string().max(2000).nullable();

/** Fields that hold the id of a row in another table. */
const LOOKUP_TABLES: Record<string, string> = {
  source_id: "sources",
  unit_id: "units",
  source_detail_id: "source_details",
  geography_id: "geographies",
};

async function checkLookups(after: Record<string, unknown>): Promise<void> {
  for (const [k, v] of Object.entries(after)) {
    const table = LOOKUP_TABLES[k];
    if (!table || v == null) continue;
    const rows = await rawQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM \`${table}\` WHERE id = ?`,
      [Number(v)],
    );
    if (!Number(rows[0]?.n ?? 0))
      throw new OpsError(`${k}=${v}: no such row in ${table}`);
  }
}

const nonEmpty = (a: Record<string, unknown>) => Object.keys(a).length > 0;
const pick = (state: Record<string, unknown>, after: object) =>
  Object.fromEntries(Object.keys(after).map((k) => [k, state[k]]));

registerChangeKind({
  kind: "measurement_metadata",
  targetType: "measurement",
  summary:
    "set metadata on a measurement, for values every series in it shares. after: any of source_id, unit_id, source_detail_id, dataPortalName, source_link.",
  workClass: "metadata",
  changeType: metadataChangeType,
  afterSchema: z
    .object({
      source_id: id,
      unit_id: id,
      source_detail_id: id,
      dataPortalName: text,
      source_link: text,
    })
    .partial()
    .strict()
    .refine(nonEmpty, "Give at least one field"),
  async snapshot({ targetId, after }, universe) {
    const state = await currentMeasurementState(targetId);
    if (state.universe !== universe)
      throw new OpsError(`Measurement ${targetId} is not in ${universe}`);
    return pick(state, after);
  },
  validate: ({ after }) => checkLookups(after),
  apply: ({ targetId, after }, { actor, issueId, credit }) =>
    applyMeasurementMetadata(targetId, after, actor, issueId, credit),
  autonomyFillsOnly: true,
  directTool: {
    name: "update_measurement_metadata",
    title: "Edit measurement metadata",
    description:
      "Dev only. Set metadata on a measurement directly. Series without their own value show the measurement's on the portal.",
  },
});

registerChangeKind({
  kind: "series_metadata",
  targetType: "series",
  summary:
    "set metadata on one series, when series in a measurement legitimately differ. after: any of source_id, unit_id, source_detail_id, geography_id, dataPortalName, description, source_link.",
  workClass: "metadata",
  changeType: metadataChangeType,
  afterSchema: z
    .object({
      source_id: id,
      unit_id: id,
      source_detail_id: id,
      geography_id: id,
      dataPortalName: text,
      description: z.string().max(60000).nullable(),
      source_link: text,
    })
    .partial()
    .strict()
    .refine(nonEmpty, "Give at least one field"),
  async snapshot({ targetId, after }, universe) {
    const state = await currentSeriesState(targetId);
    if (state.universe !== universe)
      throw new OpsError(`Series ${targetId} is not in ${universe}`);
    return pick(state, after);
  },
  validate: ({ after }) => checkLookups(after),
  apply: ({ targetId, after }, { actor, issueId, credit }) =>
    applySeriesMetadata(targetId, after, actor, issueId, credit),
  autonomyFillsOnly: true,
  directTool: {
    name: "update_series_metadata",
    title: "Edit series metadata",
    description: "Dev only. Set metadata fields on a series directly.",
  },
});

registerChangeKind({
  kind: "unquarantine",
  targetType: "series",
  summary: "release a quarantined series. after: {}",
  workClass: "errors",
  changeType: () => "unquarantine",
  afterSchema: z.unknown().transform(() => ({ quarantined: false as const })),
  async snapshot({ targetId }, universe) {
    const state = await currentSeriesState(targetId);
    if (state.universe !== universe)
      throw new OpsError(`Series ${targetId} is not in ${universe}`);
    return { quarantined: state.quarantined };
  },
  async validate({ targetId, before }) {
    if (!before.quarantined)
      throw new OpsError(`Series ${targetId} is not quarantined`);
  },
  apply: ({ targetId }, { actor }) => applyUnquarantine(targetId, actor),
});
