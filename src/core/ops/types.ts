/*************************************************************************
 * Ops: shared types for issues, proposals, runs and actors.
 * Design: docs/2026-11-13-ops-agent-design.md
 *************************************************************************/

export type IssueKind =
  | "load_error"
  | "reload_job_failed"
  | "missing_metadata"
  | "quarantined"
  | "loader_lag"
  | "agent_finding";

/** Kinds the reconciler detects in v1. The rest exist in the model only. */
export const ACTIVE_DETECTOR_KINDS: IssueKind[] = [
  "load_error",
  "reload_job_failed",
  "loader_lag",
  "missing_metadata",
];

/**
 * The to-do list order: the agent works kinds in this order (load errors,
 * then lag, then metadata gaps). Kinds not listed are never handed out.
 */
export const WORK_ORDER: IssueKind[] = [
  "load_error",
  "reload_job_failed",
  "loader_lag",
  "missing_metadata",
];

export type IssueStatus =
  | "open"
  | "investigating"
  | "awaiting_human"
  | "resolving"
  | "resolved"
  | "closed"
  | "dismissed";

/** Statuses that still count as "live" for the agent's work queue. */
export const LIVE_STATUSES: IssueStatus[] = [
  "open",
  "investigating",
  "awaiting_human",
  "resolving",
];

export type IssueSeverity = "low" | "normal" | "high";
export type IssueOwner = "agent" | "human" | "none";

export type ResolutionPath =
  | "agent"
  | "agent_proposal"
  | "user_ui"
  | "user_mcp"
  | "user_slack"
  | "condition_cleared"
  | "manual";

export type ActorType = "agent" | "user" | "system";
export type Via = "ui" | "slack" | "mcp" | "agent" | "reconciler" | "worker";

export type IssueEventType =
  | "detected"
  | "recurred"
  | "diagnosis"
  | "comment"
  | "question"
  | "proposal_created"
  | "proposal_reviewed"
  | "proposal_withdrawn"
  | "action_applied"
  | "resolution_claimed"
  | "claim_rejected"
  | "verified_resolved"
  | "condition_cleared"
  | "reopened"
  | "snoozed"
  | "dismissed"
  | "assigned"
  | "closed";

/** Who is acting. `userId` is null only for the reconciler / system. */
export type Actor = {
  type: ActorType;
  userId: number | null;
  email: string | null;
  role: string;
  via: Via;
};

export const SYSTEM_ACTOR: Actor = {
  type: "system",
  userId: null,
  email: null,
  role: "system",
  via: "reconciler",
};

/** Series metadata fields that can be edited through ops. */
export const METADATA_FIELDS = [
  "source_id",
  "unit_id",
  "source_detail_id",
  "geography_id",
  "dataPortalName",
  "description",
  "source_link",
] as const;
export type MetadataField = (typeof METADATA_FIELDS)[number];

/**
 * Fields the missing-metadata detector can check. Which of them it does
 * check is the `metadata.required_fields` setting (default: the first
 * three). geography_id is left out: it has no gaps and no measurement level.
 */
export const DETECTABLE_METADATA_FIELDS = [
  "source_id",
  "unit_id",
  "dataPortalName",
  "source_detail_id",
  "source_link",
  "description",
] as const satisfies readonly MetadataField[];
export type DetectableField = (typeof DETECTABLE_METADATA_FIELDS)[number];

export const DEFAULT_REQUIRED_FIELDS: DetectableField[] = [
  "source_id",
  "unit_id",
  "dataPortalName",
];

/**
 * Metadata that can live on a measurement. The portal views read the series
 * value and fall back to the measurement's, so a gap exists only when both
 * are empty. Keys are the ops field names; values the measurements columns.
 */
export const MEASUREMENT_FIELD_COLUMNS = {
  source_id: "source_id",
  unit_id: "unit_id",
  source_detail_id: "source_detail_id",
  dataPortalName: "data_portal_name",
  source_link: "source_link",
} as const satisfies Partial<Record<MetadataField, string>>;
export type MeasurementField = keyof typeof MEASUREMENT_FIELD_COLUMNS;

export interface IssueRow {
  id: number;
  universe: string;
  kind: IssueKind;
  fingerprint: string;
  subjectType: string;
  subjectId: number | null;
  subjectField: string | null;
  groupKey: string | null;
  status: IssueStatus;
  severity: IssueSeverity;
  owner: IssueOwner;
  assigneeUserId: number | null;
  title: string;
  summary: string | null;
  detail: Record<string, unknown> | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastCheckedAt: Date | null;
  occurrenceCount: number;
  snoozedUntil: Date | null;
  dismissedReason: string | null;
  resolvedAt: Date | null;
  resolutionPath: ResolutionPath | null;
  resolvedByUserId: number | null;
  resolutionNote: string | null;
  reopenCount: number;
  lastHumanEventAt: Date | null;
  lastAgentEventAt: Date | null;
  slackChannel: string | null;
  slackTs: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueEventRow {
  id: number;
  issueId: number;
  actorType: ActorType;
  actorUserId: number | null;
  actorEmail: string | null;
  via: Via;
  type: IssueEventType;
  body: string | null;
  payload: Record<string, unknown> | null;
  slackTs: string | null;
  createdAt: Date;
}

// ─── Proposals ────────────────────────────────────────────────────────

export type ProposalKind =
  | "loader_update"
  | "loader_create"
  | "loader_disable"
  | "series_metadata"
  | "measurement_metadata"
  | "unquarantine"
  | "reload";

export type ProposalStatus =
  | "queued"
  | "pending"
  | "approved"
  | "applied"
  | "failed"
  | "rejected"
  | "superseded"
  | "stale"
  | "withdrawn";

/**
 * Work class of a proposal. There is one queue; the class only orders it
 * (errors ahead of metadata) and picks the agent's tool set.
 */
export type Lane = "errors" | "metadata";

export type TargetType = "loader" | "series" | "measurement";

/** One change inside a proposal. `before` is the state when proposed. */
export interface ProposalTarget {
  targetType: TargetType;
  targetId: number;
  issueId: number | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ProposalRow {
  id: number;
  universe: string;
  issueId: number | null;
  groupKey: string | null;
  kind: ProposalKind;
  lane: Lane;
  status: ProposalStatus;
  summary: string;
  targets: ProposalTarget[];
  evidence: string | null;
  dryRun: unknown;
  contentHash: string;
  priority: number;
  daysPending: number;
  createdByUserId: number | null;
  postedAt: Date | null;
  expiresAt: Date | null;
  reviewedByUserId: number | null;
  reviewedVia: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  appliedAt: Date | null;
  applyResult: unknown;
  slackChannel: string | null;
  slackTs: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Change types the autonomy levels apply to. Each maps to a setting
 * `autonomy.<type>`; 0 = propose only, 1 = apply + Slack post, 2 = apply,
 * digest only. Everything starts at 0.
 */
export const CHANGE_TYPES = [
  "request_reload",
  "fill_measurement_from_series",
  "fill_metadata_from_research",
  "loader_update",
  "loader_create",
  "loader_disable",
  "unquarantine",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** Parse a LONGTEXT JSON column; null on empty or bad JSON. */
export function parseJson<T = Record<string, unknown>>(
  value: unknown,
): T | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(String(value));
}
