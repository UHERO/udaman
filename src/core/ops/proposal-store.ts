/*************************************************************************
 * Ops proposal store: SQL for ops_proposals.
 *************************************************************************/

import { mysql, rawQuery } from "@database/mysql";

import { changeTypeFor, type MetadataBasis } from "./rules";
import {
  parseJson,
  toDate,
  type Lane,
  type ProposalKind,
  type ProposalRow,
  type ProposalStatus,
  type ProposalTarget,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProposal(r: any): ProposalRow {
  return {
    id: Number(r.id),
    universe: r.universe,
    issueId: r.issue_id != null ? Number(r.issue_id) : null,
    groupKey: r.group_key ?? null,
    kind: r.kind,
    lane: r.lane,
    status: r.status,
    summary: r.summary,
    targets: parseJson<ProposalTarget[]>(r.targets) ?? [],
    evidence: r.evidence ?? null,
    dryRun: parseJson(r.dry_run),
    contentHash: r.content_hash,
    priority: Number(r.priority ?? 0),
    daysPending: Number(r.days_pending ?? 1),
    createdByUserId:
      r.created_by_user_id != null ? Number(r.created_by_user_id) : null,
    postedAt: toDate(r.posted_at),
    expiresAt: toDate(r.expires_at),
    reviewedByUserId:
      r.reviewed_by_user_id != null ? Number(r.reviewed_by_user_id) : null,
    reviewedVia: r.reviewed_via ?? null,
    reviewedAt: toDate(r.reviewed_at),
    reviewNote: r.review_note ?? null,
    appliedAt: toDate(r.applied_at),
    applyResult: parseJson(r.apply_result),
    slackChannel: r.slack_channel ?? null,
    slackTs: r.slack_ts ?? null,
    createdAt: toDate(r.created_at)!,
    updatedAt: toDate(r.updated_at)!,
  };
}

export interface NewProposal {
  universe: string;
  issueId: number | null;
  groupKey: string | null;
  kind: ProposalKind;
  lane: Lane;
  summary: string;
  targets: ProposalTarget[];
  evidence: string | null;
  dryRun: unknown;
  contentHash: string;
  priority: number;
  daysPending: number;
  createdByUserId: number | null;
  slackChannel: string | null;
  slackTs: string | null;
}

export class ProposalStore {
  static async getById(id: number): Promise<ProposalRow | null> {
    const rows =
      await mysql`SELECT * FROM ops_proposals WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToProposal(rows[0]) : null;
  }

  static async getBySlackTs(ts: string): Promise<ProposalRow | null> {
    const rows = await mysql`
      SELECT * FROM ops_proposals WHERE slack_ts = ${ts}
      ORDER BY id DESC LIMIT 1
    `;
    return rows[0] ? rowToProposal(rows[0]) : null;
  }

  static async list(f: {
    universe: string;
    status?: ProposalStatus[];
    lane?: Lane;
    issueId?: number;
    limit?: number;
  }): Promise<ProposalRow[]> {
    const where = ["universe = ?"];
    const params: (string | number)[] = [f.universe];
    if (f.status?.length) {
      where.push(`status IN (${f.status.map(() => "?").join(", ")})`);
      params.push(...f.status);
    }
    if (f.lane) {
      where.push("lane = ?");
      params.push(f.lane);
    }
    if (f.issueId != null) {
      where.push("issue_id = ?");
      params.push(f.issueId);
    }
    const limit = Math.min(Math.max(f.limit ?? 100, 1), 500);
    const rows = await rawQuery(
      `SELECT * FROM ops_proposals WHERE ${where.join(" AND ")}
       ORDER BY FIELD(status, 'pending') DESC, FIELD(lane, 'errors', 'metadata'),
                priority DESC, created_at
       LIMIT ${limit}`,
      params,
    );
    return rows.map(rowToProposal);
  }

  static async insert(p: NewProposal): Promise<ProposalRow> {
    await mysql`
      INSERT INTO ops_proposals
        (universe, issue_id, group_key, kind, lane, status, summary, targets,
         evidence, dry_run, content_hash, priority, days_pending,
         created_by_user_id, slack_channel, slack_ts, created_at, updated_at)
      VALUES
        (${p.universe}, ${p.issueId}, ${p.groupKey}, ${p.kind}, ${p.lane},
         'queued', ${p.summary.slice(0, 500)}, ${JSON.stringify(p.targets)},
         ${p.evidence}, ${p.dryRun == null ? null : JSON.stringify(p.dryRun)},
         ${p.contentHash}, ${p.priority}, ${p.daysPending},
         ${p.createdByUserId}, ${p.slackChannel}, ${p.slackTs}, NOW(), NOW())
    `;
    const rows = await mysql`
      SELECT * FROM ops_proposals WHERE content_hash = ${p.contentHash}
      ORDER BY id DESC LIMIT 1
    `;
    return rowToProposal(rows[0]);
  }

  static async setStatus(
    id: number,
    status: ProposalStatus,
    extra: {
      reviewedByUserId?: number | null;
      reviewedVia?: string | null;
      reviewNote?: string | null;
      applyResult?: unknown;
      markReviewed?: boolean;
      markApplied?: boolean;
      markPosted?: boolean;
      slackChannel?: string | null;
      slackTs?: string | null;
    } = {},
  ): Promise<void> {
    await mysql`
      UPDATE ops_proposals SET
        status = ${status},
        reviewed_by_user_id = COALESCE(${extra.reviewedByUserId ?? null}, reviewed_by_user_id),
        reviewed_via = COALESCE(${extra.reviewedVia ?? null}, reviewed_via),
        review_note = COALESCE(${extra.reviewNote ?? null}, review_note),
        apply_result = COALESCE(${extra.applyResult === undefined ? null : JSON.stringify(extra.applyResult)}, apply_result),
        reviewed_at = IF(${extra.markReviewed ? 1 : 0} = 1, NOW(), reviewed_at),
        applied_at = IF(${extra.markApplied ? 1 : 0} = 1, NOW(), applied_at),
        posted_at = IF(${extra.markPosted ? 1 : 0} = 1, NOW(), posted_at),
        expires_at = IF(${extra.markPosted ? 1 : 0} = 1, NOW() + INTERVAL 1 DAY, expires_at),
        slack_channel = COALESCE(${extra.slackChannel ?? null}, slack_channel),
        slack_ts = COALESCE(${extra.slackTs ?? null}, slack_ts),
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  static async setDryRun(id: number, dryRun: unknown): Promise<void> {
    await mysql`
      UPDATE ops_proposals SET dry_run = ${JSON.stringify(dryRun)}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  /**
   * Review record per change type for proposals the agent made: totals and
   * the current run of consecutive approvals that applied cleanly. This is
   * the evidence for raising (or lowering) an autonomy level.
   */
  static async changeTypeStats(
    universe: string,
    agentUserId: number | null,
  ): Promise<
    Array<{
      changeType: string;
      approved: number;
      rejected: number;
      failed: number;
      autoApplied: number;
      streak: number;
    }>
  > {
    if (agentUserId == null) return [];
    const rows = await mysql<{
      kind: ProposalKind;
      status: string;
      dry_run: string | null;
      reviewed_via: string | null;
    }>`
      SELECT kind, status, dry_run, reviewed_via FROM ops_proposals
      WHERE universe = ${universe} AND created_by_user_id = ${agentUserId}
        AND status IN ('applied', 'failed', 'rejected')
      ORDER BY id
    `;
    const out = new Map<
      string,
      {
        changeType: string;
        approved: number;
        rejected: number;
        failed: number;
        autoApplied: number;
        streak: number;
      }
    >();
    for (const r of rows) {
      const basis = parseJson<{ basis?: MetadataBasis }>(r.dry_run)?.basis;
      const type = changeTypeFor(r.kind, basis ?? undefined);
      const m = out.get(type) ?? {
        changeType: type,
        approved: 0,
        rejected: 0,
        failed: 0,
        autoApplied: 0,
        streak: 0,
      };
      if (r.reviewed_via?.startsWith("autonomy")) {
        m.autoApplied++;
        if (r.status === "failed") m.failed++;
      } else if (r.status === "applied") {
        m.approved++;
        m.streak++;
      } else {
        if (r.status === "rejected") m.rejected++;
        else m.failed++;
        m.streak = 0;
      }
      out.set(type, m);
    }
    return [...out.values()];
  }

  /** Approval history per kind, for the autonomy evidence on /admin/agent. */
  static async reviewStats(universe: string): Promise<
    Array<{
      kind: string;
      approved: number;
      rejected: number;
      applied: number;
      failed: number;
      stale: number;
      withdrawn: number;
    }>
  > {
    const rows = await mysql<{ kind: string; status: string; cnt: number }>`
      SELECT kind, status, COUNT(*) AS cnt FROM ops_proposals
      WHERE universe = ${universe}
      GROUP BY kind, status
    `;
    const byKind = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const m = byKind.get(r.kind) ?? {};
      m[r.status] = Number(r.cnt);
      byKind.set(r.kind, m);
    }
    return [...byKind.entries()].map(([kind, m]) => ({
      kind,
      approved: (m.approved ?? 0) + (m.applied ?? 0) + (m.failed ?? 0),
      rejected: m.rejected ?? 0,
      applied: m.applied ?? 0,
      failed: m.failed ?? 0,
      stale: m.stale ?? 0,
      withdrawn: m.withdrawn ?? 0,
    }));
  }
}
