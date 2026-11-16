/*************************************************************************
 * Ops issue store: SQL for ops_issues and ops_issue_events.
 *
 * `open_fingerprint` carries the fingerprint for every status except
 * `closed`, and has a unique index, so there is at most one live row per
 * problem and a recurrence reopens the same row (keeping its Slack thread).
 *************************************************************************/

import { mysql, rawQuery } from "@database/mysql";

import {
  parseJson,
  toDate,
  type Actor,
  type IssueEventRow,
  type IssueEventType,
  type IssueKind,
  type IssueRow,
  type IssueSeverity,
  type IssueStatus,
} from "./types";

/** What a detector reports for one subject. */
export interface DetectedCondition {
  universe: string;
  kind: IssueKind;
  subjectType: string;
  subjectId: number | null;
  subjectField?: string | null;
  groupKey?: string | null;
  title: string;
  severity?: IssueSeverity;
  /** Snapshot of the condition; `signature` decides "changed" for dismissals. */
  detail: Record<string, unknown> & { signature?: string };
}

export function fingerprintOf(c: {
  universe: string;
  kind: string;
  subjectType: string;
  subjectId: number | null;
  subjectField?: string | null;
}): string {
  const field = c.subjectField ? `:${c.subjectField}` : "";
  return `${c.universe}:${c.kind}:${c.subjectType}:${c.subjectId ?? "-"}${field}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIssue(r: any): IssueRow {
  return {
    id: Number(r.id),
    universe: r.universe,
    kind: r.kind,
    fingerprint: r.fingerprint,
    subjectType: r.subject_type,
    subjectId: r.subject_id != null ? Number(r.subject_id) : null,
    subjectField: r.subject_field ?? null,
    groupKey: r.group_key ?? null,
    status: r.status,
    severity: r.severity,
    owner: r.owner,
    assigneeUserId:
      r.assignee_user_id != null ? Number(r.assignee_user_id) : null,
    title: r.title,
    summary: r.summary ?? null,
    detail: parseJson(r.detail),
    firstSeenAt: toDate(r.first_seen_at)!,
    lastSeenAt: toDate(r.last_seen_at)!,
    lastCheckedAt: toDate(r.last_checked_at),
    occurrenceCount: Number(r.occurrence_count ?? 0),
    snoozedUntil: toDate(r.snoozed_until),
    dismissedReason: r.dismissed_reason ?? null,
    resolvedAt: toDate(r.resolved_at),
    resolutionPath: r.resolution_path ?? null,
    resolvedByUserId:
      r.resolved_by_user_id != null ? Number(r.resolved_by_user_id) : null,
    resolutionNote: r.resolution_note ?? null,
    reopenCount: Number(r.reopen_count ?? 0),
    lastHumanEventAt: toDate(r.last_human_event_at),
    lastAgentEventAt: toDate(r.last_agent_event_at),
    slackChannel: r.slack_channel ?? null,
    slackTs: r.slack_ts ?? null,
    createdAt: toDate(r.created_at)!,
    updatedAt: toDate(r.updated_at)!,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(r: any): IssueEventRow {
  return {
    id: Number(r.id),
    issueId: Number(r.issue_id),
    actorType: r.actor_type,
    actorUserId: r.actor_user_id != null ? Number(r.actor_user_id) : null,
    actorEmail: r.actor_email ?? null,
    via: r.via,
    type: r.type,
    body: r.body ?? null,
    payload: parseJson(r.payload),
    slackTs: r.slack_ts ?? null,
    createdAt: toDate(r.created_at)!,
  };
}

export interface IssueListFilter {
  universe: string;
  status?: IssueStatus | IssueStatus[];
  kind?: IssueKind | IssueKind[];
  groupKey?: string;
  owner?: string;
  subjectType?: string;
  subjectId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

function inList(values: string[]): string {
  return values.map(() => "?").join(", ");
}

export class IssueStore {
  static async getById(id: number): Promise<IssueRow | null> {
    const rows = await mysql`SELECT * FROM ops_issues WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToIssue(rows[0]) : null;
  }

  static async getByIds(ids: number[]): Promise<IssueRow[]> {
    if (!ids.length) return [];
    const rows = await rawQuery(
      `SELECT * FROM ops_issues WHERE id IN (${inList(ids.map(String))})`,
      ids,
    );
    return rows.map(rowToIssue);
  }

  static async getByOpenFingerprint(fp: string): Promise<IssueRow | null> {
    const rows = await mysql`
      SELECT * FROM ops_issues WHERE open_fingerprint = ${fp} LIMIT 1
    `;
    return rows[0] ? rowToIssue(rows[0]) : null;
  }

  static async getBySlackTs(ts: string): Promise<IssueRow | null> {
    const rows = await mysql`
      SELECT * FROM ops_issues WHERE slack_ts = ${ts} LIMIT 1
    `;
    return rows[0] ? rowToIssue(rows[0]) : null;
  }

  /** Live (not resolved/closed/dismissed) issues about one subject. */
  static async findLiveBySubject(
    subjectType: string,
    subjectId: number,
  ): Promise<IssueRow[]> {
    const rows = await mysql`
      SELECT * FROM ops_issues
      WHERE subject_type = ${subjectType} AND subject_id = ${subjectId}
        AND status IN ('open', 'investigating', 'awaiting_human', 'resolving')
    `;
    return rows.map(rowToIssue);
  }

  static async list(
    f: IssueListFilter,
  ): Promise<{ rows: IssueRow[]; total: number }> {
    const where: string[] = ["universe = ?"];
    const params: (string | number)[] = [f.universe];
    const statuses = f.status
      ? Array.isArray(f.status)
        ? f.status
        : [f.status]
      : null;
    if (statuses?.length) {
      where.push(`status IN (${inList(statuses)})`);
      params.push(...statuses);
    }
    const kinds = f.kind ? (Array.isArray(f.kind) ? f.kind : [f.kind]) : null;
    if (kinds?.length) {
      where.push(`kind IN (${inList(kinds)})`);
      params.push(...kinds);
    }
    if (f.groupKey) {
      where.push("group_key = ?");
      params.push(f.groupKey);
    }
    if (f.owner) {
      where.push("owner = ?");
      params.push(f.owner);
    }
    if (f.subjectType) {
      where.push("subject_type = ?");
      params.push(f.subjectType);
    }
    if (f.subjectId != null) {
      where.push("subject_id = ?");
      params.push(f.subjectId);
    }
    if (f.search) {
      where.push("(title LIKE ? OR summary LIKE ?)");
      params.push(`%${f.search}%`, `%${f.search}%`);
    }
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 500);
    const offset = Math.max(f.offset ?? 0, 0);
    const whereSql = where.join(" AND ");
    const [rows, count] = await Promise.all([
      rawQuery(
        `SELECT * FROM ops_issues WHERE ${whereSql}
         ORDER BY FIELD(severity, 'high', 'normal', 'low'), last_seen_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      rawQuery<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM ops_issues WHERE ${whereSql}`,
        params,
      ),
    ]);
    return { rows: rows.map(rowToIssue), total: Number(count[0]?.cnt ?? 0) };
  }

  /** Counts by status and kind, for badges and the dashboard. */
  static async counts(universe: string): Promise<{
    byStatus: Record<string, number>;
    byKind: Record<string, number>;
  }> {
    const rows = await mysql<{ status: string; kind: string; cnt: number }>`
      SELECT status, kind, COUNT(*) AS cnt FROM ops_issues
      WHERE universe = ${universe} AND status <> 'closed'
      GROUP BY status, kind
    `;
    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + Number(r.cnt);
      if (
        ["open", "investigating", "awaiting_human", "resolving"].includes(
          r.status,
        )
      )
        byKind[r.kind] = (byKind[r.kind] ?? 0) + Number(r.cnt);
    }
    return { byStatus, byKind };
  }

  /** Live issues of the given kinds, for the reconciler's sweep. */
  static async listLiveByKinds(
    universe: string,
    kinds: IssueKind[],
  ): Promise<IssueRow[]> {
    if (!kinds.length) return [];
    const rows = await rawQuery(
      `SELECT * FROM ops_issues
       WHERE universe = ? AND kind IN (${inList(kinds)})
         AND status IN ('open', 'investigating', 'awaiting_human', 'resolving')`,
      [universe, ...kinds],
    );
    return rows.map(rowToIssue);
  }

  static async insert(c: DetectedCondition): Promise<IssueRow> {
    const fp = fingerprintOf(c);
    await mysql`
      INSERT INTO ops_issues
        (universe, kind, fingerprint, open_fingerprint, subject_type, subject_id,
         subject_field, group_key, status, severity, owner, title, detail,
         first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
      VALUES
        (${c.universe}, ${c.kind}, ${fp}, ${fp}, ${c.subjectType}, ${c.subjectId},
         ${c.subjectField ?? null}, ${c.groupKey ?? null}, 'open',
         ${c.severity ?? "normal"}, 'agent', ${c.title.slice(0, 255)},
         ${JSON.stringify(c.detail)}, NOW(), NOW(), NOW(), NOW(), NOW())
    `;
    return (await this.getByOpenFingerprint(fp))!;
  }

  /**
   * Insert many new issues plus their "detected" events. The first reconcile
   * creates tens of thousands of missing-metadata issues, so this uses
   * multi-row INSERTs in a fixed ladder of chunk sizes (few distinct
   * prepared statements; each chunk well under a 1 MiB packet).
   */
  static async bulkInsert(conds: DetectedCondition[]): Promise<number> {
    const LADDER = [100, 10, 1];
    let i = 0;
    while (i < conds.length) {
      const size = LADDER.find((n) => n <= conds.length - i)!;
      const chunk = conds.slice(i, i + size);
      i += size;
      const rowSql =
        "(?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, 'agent', ?, ?, NOW(), NOW(), NOW(), NOW(), NOW())";
      const params: (string | number)[] = [];
      const fps: string[] = [];
      for (const c of chunk) {
        const fp = fingerprintOf(c);
        fps.push(fp);
        params.push(
          c.universe,
          c.kind,
          fp,
          fp,
          c.subjectType,
          // rawQuery's param type excludes null; the driver accepts it.
          c.subjectId as number,
          (c.subjectField ?? null) as unknown as string,
          (c.groupKey ?? null) as unknown as string,
          c.severity ?? "normal",
          c.title.slice(0, 255),
          JSON.stringify(c.detail),
        );
      }
      await rawQuery(
        `INSERT INTO ops_issues
           (universe, kind, fingerprint, open_fingerprint, subject_type, subject_id,
            subject_field, group_key, status, severity, owner, title, detail,
            first_seen_at, last_seen_at, last_checked_at, created_at, updated_at)
         VALUES ${chunk.map(() => rowSql).join(", ")}`,
        params,
      );
      await rawQuery(
        `INSERT INTO ops_issue_events (issue_id, actor_type, via, type, created_at)
         SELECT id, 'system', 'reconciler', 'detected', NOW() FROM ops_issues
         WHERE open_fingerprint IN (${fps.map(() => "?").join(", ")})`,
        fps,
      );
    }
    return conds.length;
  }

  /** Still present: bump sighting counters and refresh the snapshot. */
  static async touch(id: number, c: DetectedCondition): Promise<void> {
    await mysql`
      UPDATE ops_issues SET
        last_seen_at = NOW(), last_checked_at = NOW(),
        occurrence_count = occurrence_count + 1,
        title = ${c.title.slice(0, 255)},
        group_key = ${c.groupKey ?? null},
        detail = ${JSON.stringify(c.detail)},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  /**
   * Generic field update. Keys are column names; only the listed columns are
   * accepted so callers can't write arbitrary SQL.
   */
  static async update(
    id: number,
    fields: Partial<Record<UpdatableColumn, string | number | null>>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!UPDATABLE_COLUMNS.has(k as UpdatableColumn)) {
        throw new Error(`IssueStore.update: column not allowed: ${k}`);
      }
      if (v === NOW) {
        sets.push(`\`${k}\` = NOW()`);
      } else {
        sets.push(`\`${k}\` = ?`);
        params.push(v);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = NOW()");
    await rawQuery(
      `UPDATE ops_issues SET ${sets.join(", ")} WHERE id = ?`,
      // rawQuery's param type excludes null; the driver accepts it.
      [...params, id] as (string | number)[],
    );
  }

  static async addEvent(
    issueId: number,
    actor: Actor,
    type: IssueEventType,
    body: string | null = null,
    payload: Record<string, unknown> | null = null,
    slackTs: string | null = null,
  ): Promise<number | null> {
    try {
      await mysql`
        INSERT INTO ops_issue_events
          (issue_id, actor_type, actor_user_id, via, type, body, payload, slack_ts, created_at)
        VALUES
          (${issueId}, ${actor.type}, ${actor.userId}, ${actor.via}, ${type},
           ${body}, ${payload ? JSON.stringify(payload) : null}, ${slackTs}, NOW())
      `;
    } catch (e) {
      // A duplicate slack_ts is a Slack retry of an event already stored.
      if (slackTs && String(e).includes("Duplicate")) return null;
      throw e;
    }
    if (actor.type === "user") {
      await mysql`UPDATE ops_issues SET last_human_event_at = NOW() WHERE id = ${issueId}`;
    } else if (actor.type === "agent") {
      await mysql`UPDATE ops_issues SET last_agent_event_at = NOW() WHERE id = ${issueId}`;
    }
    const rows = await mysql<{ id: number }>`
      SELECT id FROM ops_issue_events WHERE issue_id = ${issueId}
      ORDER BY id DESC LIMIT 1
    `;
    return rows[0] ? Number(rows[0].id) : null;
  }

  static async listEvents(issueId: number): Promise<IssueEventRow[]> {
    const rows = await mysql`
      SELECT e.*, u.email AS actor_email
      FROM ops_issue_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.issue_id = ${issueId}
      ORDER BY e.created_at, e.id
    `;
    return rows.map(rowToEvent);
  }

  /** Issues resolved/closed/cleared since a time, for the digest. */
  static async listResolvedSince(
    universe: string,
    sinceSql: string,
  ): Promise<IssueRow[]> {
    const rows = await mysql`
      SELECT * FROM ops_issues
      WHERE universe = ${universe} AND resolved_at IS NOT NULL
        AND resolved_at >= ${sinceSql}
      ORDER BY resolved_at DESC
    `;
    return rows.map(rowToIssue);
  }
}

/** Sentinel for `IssueStore.update`: set the column to NOW(). */
export const NOW = "__NOW__";

type UpdatableColumn =
  | "status"
  | "severity"
  | "owner"
  | "assignee_user_id"
  | "summary"
  | "snoozed_until"
  | "dismissed_reason"
  | "resolved_at"
  | "resolution_path"
  | "resolved_by_user_id"
  | "resolution_note"
  | "reopen_count"
  | "open_fingerprint"
  | "slack_channel"
  | "slack_ts"
  | "last_checked_at"
  | "detail"
  | "title";

const UPDATABLE_COLUMNS = new Set<UpdatableColumn>([
  "status",
  "severity",
  "owner",
  "assignee_user_id",
  "summary",
  "snoozed_until",
  "dismissed_reason",
  "resolved_at",
  "resolution_path",
  "resolved_by_user_id",
  "resolution_note",
  "reopen_count",
  "open_fingerprint",
  "slack_channel",
  "slack_ts",
  "last_checked_at",
  "detail",
  "title",
]);
