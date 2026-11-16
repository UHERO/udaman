/*************************************************************************
 * Ops detectors: deterministic checks, one per issue kind. No model.
 *
 * Each detector has
 *   detectAll(universe)  every subject currently in the bad state
 *   checkOne(issue)      is this one issue's condition still present?
 *
 * v1 kinds:
 *   load_error         enabled loader whose last reload failed
 *   loader_lag         enabled loader past its lag limit (the lag check
 *                      writes its own message to last_error)
 *   reload_job_failed  /investigations dashboard (recent reload jobs)
 *   missing_metadata   a measurement in a data list with series that have
 *                      no effective value for a required field
 *************************************************************************/

import { mysql, rawQuery } from "@database/mysql";

import type { DetectedCondition } from "./issue-store";
import {
  errorSignature,
  isLagError,
  LAG_ERROR_SQL_PREFIX,
  lagGroupKey,
} from "./rules";
import { getOpsSettings } from "./settings";
import {
  DETECTABLE_METADATA_FIELDS,
  MEASUREMENT_FIELD_COLUMNS,
  type DetectableField,
  type IssueKind,
  type IssueRow,
} from "./types";

export { errorSignature } from "./rules";

export interface Detector {
  kind: IssueKind;
  detectAll(universe: string): Promise<DetectedCondition[]>;
  /** true = the condition still holds for this issue. */
  checkOne(issue: IssueRow): Promise<boolean>;
}

// ─── load_error / loader_lag ──────────────────────────────────────────
//
// Both read data_sources.last_error. A lag-limit message means the loader
// ran fine but its newest point is older than max_lag_days: usually the
// source hasn't published, so it's a different kind with its own playbook.

interface LoaderErrorRow {
  id: number;
  series_id: number | null;
  last_error: string;
  last_error_at: Date | string | null;
  eval: string | null;
  max_lag_days: number | null;
  series_name: string | null;
}

function loaderCondition(
  universe: string,
  kind: "load_error" | "loader_lag",
  r: LoaderErrorRow,
): DetectedCondition {
  const lag = kind === "loader_lag";
  return {
    universe,
    kind,
    subjectType: "loader",
    subjectId: Number(r.id),
    // Lag issues group by what they read: one late file is one work item.
    groupKey: lag
      ? lagGroupKey(r.eval, r.series_name)
      : `load_error:${errorSignature(r.last_error)}`,
    title: `${r.series_name ?? `loader ${r.id}`}: ${r.last_error}`.slice(
      0,
      255,
    ),
    detail: {
      // Lag text changes daily ("12d behind"); keep its signature stable.
      signature: lag
        ? `lag:${lagGroupKey(r.eval, r.series_name)}`
        : r.last_error,
      seriesId: r.series_id,
      seriesName: r.series_name,
      lastError: r.last_error,
      lastErrorAt: r.last_error_at,
      eval: r.eval,
      ...(lag ? { maxLagDays: r.max_lag_days } : {}),
    },
  };
}

function loaderDetector(kind: "load_error" | "loader_lag"): Detector {
  const wantLag = kind === "loader_lag";
  return {
    kind,
    async detectAll(universe) {
      const rows = await mysql<LoaderErrorRow>`
        SELECT ds.id, ds.series_id, ds.last_error, ds.last_error_at, ds.eval,
               ds.max_lag_days, s.name AS series_name
        FROM data_sources ds
        LEFT JOIN series s ON s.id = ds.series_id
        WHERE ds.universe = ${universe}
          AND ds.disabled = 0
          AND ds.last_error IS NOT NULL
          AND (ds.last_error LIKE ${`${LAG_ERROR_SQL_PREFIX}%`}) = ${wantLag ? 1 : 0}
      `;
      return rows.map((r) => loaderCondition(universe, kind, r));
    },
    async checkOne(issue) {
      if (issue.subjectId == null) return false;
      const rows = await mysql<{ last_error: string | null }>`
        SELECT last_error FROM data_sources
        WHERE id = ${issue.subjectId} AND disabled = 0 AND last_error IS NOT NULL
      `;
      return rows[0] ? isLagError(rows[0].last_error) === wantLag : false;
    },
  };
}

export const loadErrorDetector = loaderDetector("load_error");
export const loaderLagDetector = loaderDetector("loader_lag");

// ─── reload_job_failed ────────────────────────────────────────────────

/** How far back a failed reload job counts. */
const RELOAD_JOB_WINDOW_DAYS = 7;

export const reloadJobDetector: Detector = {
  kind: "reload_job_failed",
  async detectAll(universe) {
    const rows = await mysql<{
      id: number;
      error: string | null;
      created_at: Date | string;
      params: string | null;
      series_count: number;
      first_series: string | null;
    }>`
      SELECT rj.id, rj.error, rj.created_at, rj.params,
             COUNT(DISTINCT rjs.series_id) AS series_count,
             MIN(s.name) AS first_series
      FROM reload_jobs rj
      JOIN reload_job_series rjs ON rjs.reload_job_id = rj.id
      JOIN series s ON s.id = rjs.series_id
      WHERE s.universe = ${universe}
        AND rj.status = 'fail'
        AND rj.created_at >= NOW() - INTERVAL ${RELOAD_JOB_WINDOW_DAYS} DAY
      GROUP BY rj.id, rj.error, rj.created_at, rj.params
    `;
    const out: DetectedCondition[] = [];
    for (const r of rows) {
      if (await laterSuccessfulJobCovers(Number(r.id))) continue;
      const msg = r.error ?? "Reload job failed";
      out.push({
        universe,
        kind: "reload_job_failed",
        subjectType: "reload_job",
        subjectId: Number(r.id),
        groupKey: `reload_job_failed:${errorSignature(msg)}`,
        title: `Reload job ${r.id} (${r.series_count} series, e.g. ${r.first_series}): ${msg}`,
        detail: {
          signature: msg,
          error: msg,
          params: r.params,
          seriesCount: Number(r.series_count),
          createdAt: r.created_at,
        },
      });
    }
    return out;
  },
  async checkOne(issue) {
    if (issue.subjectId == null) return false;
    const rows = await mysql<{ status: string }>`
      SELECT status FROM reload_jobs WHERE id = ${issue.subjectId} LIMIT 1
    `;
    // Deleted from the investigations page, or re-run successfully.
    if (!rows[0] || rows[0].status !== "fail") return false;
    return !(await laterSuccessfulJobCovers(issue.subjectId));
  },
};

/** A later `done` job reloaded every series the failed job covered. */
async function laterSuccessfulJobCovers(jobId: number): Promise<boolean> {
  const rows = await mysql<{ uncovered: number }>`
    SELECT COUNT(*) AS uncovered
    FROM reload_job_series f
    WHERE f.reload_job_id = ${jobId}
      AND NOT EXISTS (
        SELECT 1 FROM reload_job_series l
        JOIN reload_jobs lj ON lj.id = l.reload_job_id
        WHERE l.series_id = f.series_id
          AND lj.status = 'done'
          AND lj.id > ${jobId}
      )
  `;
  return Number(rows[0]?.uncovered ?? 1) === 0;
}

// ─── missing_metadata ─────────────────────────────────────────────────
//
// One issue per (measurement, field). The portal views read a series'
// value and fall back to its measurement's, so a series has a gap only
// when both are empty. Only measurements in a data list count: that is
// the only way a series reaches the portal.

const SERIES_COLUMNS: Record<
  DetectableField,
  { column: string; text: boolean }
> = {
  source_id: { column: "source_id", text: false },
  unit_id: { column: "unit_id", text: false },
  source_detail_id: { column: "source_detail_id", text: false },
  dataPortalName: { column: "dataPortalName", text: true },
  description: { column: "description", text: true },
  source_link: { column: "source_link", text: true },
};

const empty = (expr: string, text: boolean) =>
  text ? `(${expr} IS NULL OR ${expr} = '')` : `${expr} IS NULL`;

/** SQL: this series (s) of this measurement (m) has no effective value. */
function gapSql(field: DetectableField): string {
  const spec = SERIES_COLUMNS[field];
  const parts = [empty(`s.\`${spec.column}\``, spec.text)];
  const mCol = (MEASUREMENT_FIELD_COLUMNS as Record<string, string>)[field];
  if (mCol) parts.push(empty(`m.\`${mCol}\``, spec.text));
  return parts.join(" AND ");
}

const isDetectable = (f: string): f is DetectableField =>
  (DETECTABLE_METADATA_FIELDS as readonly string[]).includes(f);

interface GapRow {
  id: number;
  prefix: string;
  data_portal_name: string | null;
  missing: number;
  total: number;
  first_series: string | null;
}

async function measurementGaps(
  universe: string,
  field: DetectableField,
  measurementId?: number,
): Promise<GapRow[]> {
  return rawQuery<GapRow>(
    `SELECT m.id, m.prefix, m.data_portal_name,
            SUM(${gapSql(field)}) AS missing, COUNT(*) AS total,
            MIN(CASE WHEN ${gapSql(field)} THEN s.name END) AS first_series
     FROM measurements m
     JOIN measurement_series ms ON ms.measurement_id = m.id
     JOIN series s ON s.id = ms.series_id AND s.universe = m.universe
     WHERE m.universe = ?
       ${measurementId != null ? "AND m.id = ?" : ""}
       AND EXISTS (SELECT 1 FROM data_list_measurements dlm
                   WHERE dlm.measurement_id = m.id)
     GROUP BY m.id, m.prefix, m.data_portal_name
     HAVING missing > 0`,
    measurementId != null ? [universe, measurementId] : [universe],
  );
}

export const missingMetadataDetector: Detector = {
  kind: "missing_metadata",
  async detectAll(universe) {
    const { requiredMetadataFields } = await getOpsSettings(universe);
    const out: DetectedCondition[] = [];
    for (const field of requiredMetadataFields) {
      for (const r of await measurementGaps(universe, field)) {
        const missing = Number(r.missing);
        const total = Number(r.total);
        out.push({
          universe,
          kind: "missing_metadata",
          subjectType: "measurement",
          subjectId: Number(r.id),
          subjectField: field,
          // A measurement's fields are one work item.
          groupKey: `missing_metadata:measurement:${r.id}`,
          title: `${r.prefix}${r.data_portal_name ? ` (${r.data_portal_name})` : ""}: ${missing} of ${total} series have no ${field}`,
          severity: "normal",
          detail: {
            signature: `${field}:${missing}`,
            field,
            measurementId: Number(r.id),
            prefix: r.prefix,
            seriesMissing: missing,
            seriesTotal: total,
            exampleSeries: r.first_series,
          },
        });
      }
    }
    return out;
  },
  async checkOne(issue) {
    const field = issue.subjectField ?? "";
    if (
      issue.subjectType !== "measurement" ||
      issue.subjectId == null ||
      !isDetectable(field)
    )
      return false;
    const { requiredMetadataFields } = await getOpsSettings(issue.universe);
    // A field switched off in settings is no longer a problem.
    if (!requiredMetadataFields.includes(field)) return false;
    const rows = await measurementGaps(issue.universe, field, issue.subjectId);
    return rows.length > 0;
  },
};

// ─── Registry ─────────────────────────────────────────────────────────

export const DETECTORS: Partial<Record<IssueKind, Detector>> = {
  load_error: loadErrorDetector,
  loader_lag: loaderLagDetector,
  reload_job_failed: reloadJobDetector,
  missing_metadata: missingMetadataDetector,
};

/**
 * Is the issue's condition still present? `agent_finding` and other kinds
 * without a detector return null: there is nothing to check mechanically.
 */
export async function conditionStillPresent(
  issue: IssueRow,
): Promise<boolean | null> {
  const d = DETECTORS[issue.kind];
  return d ? d.checkOne(issue) : null;
}
