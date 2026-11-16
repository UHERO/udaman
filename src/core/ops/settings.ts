/*************************************************************************
 * Ops settings: autonomy levels, queue size, required metadata fields,
 * reviewers, budget (ops_settings). Every value has a conservative default,
 * so an empty table is a valid configuration: everything needs approval,
 * one active proposal, $50/month.
 *************************************************************************/

import { mysql } from "@database/mysql";

import {
  CHANGE_TYPES,
  DEFAULT_REQUIRED_FIELDS,
  DETECTABLE_METADATA_FIELDS,
  type ChangeType,
  type DetectableField,
} from "./types";

export const OPS_SLACK_CHANNEL = process.env.OPS_SLACK_CHANNEL ?? "automation";

export type AutonomyLevel = 0 | 1 | 2;

export interface OpsSettings {
  autonomy: Record<ChangeType, AutonomyLevel>;
  /** Proposals shown for review at once (posted to Slack). */
  activeSlots: number;
  /**
   * The ready buffer: proposals the agent keeps prepared, counting the
   * active one. The agent stops investigating new items when it is full.
   */
  readyTarget: number;
  /** New items the agent may start per day, whatever the budget. */
  maxItemsPerDay: number;
  /** Metadata fields whose gaps create issues. */
  requiredMetadataFields: DetectableField[];
  /** Users who may review proposals besides devs and admins. */
  reviewerUserIds: number[];
  monthlyBudgetUsd: number;
  /** Paused agent: the runner API hands out no work. */
  agentPaused: boolean;
  /**
   * Off (the default) is comment-only mode: the agent diagnoses and asks
   * questions but can't create proposals. Turned on once its diagnoses
   * have been read and found sound.
   */
  proposalsEnabled: boolean;
}

const DEFAULTS: Record<string, string> = {
  "queue.active_slots": "1",
  "queue.ready_target": "3",
  "agent.max_items_per_day": "20",
  "metadata.required_fields": DEFAULT_REQUIRED_FIELDS.join(","),
  "reviewers.user_ids": "",
  "budget.monthly_usd": "50",
  "agent.paused": "0",
  "agent.proposals_enabled": "0",
  /** HST time the runner last asked for work (written by the runner API). */
  "agent.last_poll_at": "",
  /** HST time the last daily digest was posted. */
  "digest.last_posted_at": "",
  /** HST date the missed-poll alert last posted (one alert per day). */
  "alert.missed_run_posted_on": "",
  ...Object.fromEntries(CHANGE_TYPES.map((t) => [`autonomy.${t}`, "0"])),
};

export const SETTING_KEYS = Object.keys(DEFAULTS);

function key(universe: string, name: string): string {
  return `${universe}:${name}`;
}

export async function getRawSettings(
  universe: string,
): Promise<Record<string, string>> {
  const rows = await mysql<{ key: string; value: string }>`
    SELECT \`key\`, value FROM ops_settings WHERE \`key\` LIKE ${`${universe}:%`}
  `;
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key.slice(universe.length + 1)] = r.value;
  return out;
}

function clampLevel(v: string): AutonomyLevel {
  const n = Number(v);
  return n >= 2 ? 2 : n >= 1 ? 1 : 0;
}

const list = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function parseRequiredFields(v: string): DetectableField[] {
  const known = new Set<string>(DETECTABLE_METADATA_FIELDS);
  return list(v).filter((f): f is DetectableField => known.has(f));
}

export async function getOpsSettings(universe: string): Promise<OpsSettings> {
  const raw = await getRawSettings(universe);
  const autonomy = Object.fromEntries(
    CHANGE_TYPES.map((t) => [t, clampLevel(raw[`autonomy.${t}`])]),
  ) as Record<ChangeType, AutonomyLevel>;
  const activeSlots = Math.max(1, Number(raw["queue.active_slots"]) || 1);
  return {
    autonomy,
    activeSlots,
    readyTarget: Math.max(activeSlots, Number(raw["queue.ready_target"]) || 3),
    maxItemsPerDay: Math.max(1, Number(raw["agent.max_items_per_day"]) || 20),
    requiredMetadataFields: parseRequiredFields(
      raw["metadata.required_fields"],
    ),
    reviewerUserIds: list(raw["reviewers.user_ids"])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0),
    monthlyBudgetUsd: Math.max(0, Number(raw["budget.monthly_usd"]) || 0),
    agentPaused: raw["agent.paused"] === "1",
    proposalsEnabled: raw["agent.proposals_enabled"] === "1",
  };
}

export async function setOpsSetting(
  universe: string,
  name: string,
  value: string,
  userId: number | null,
): Promise<void> {
  if (!(name in DEFAULTS)) throw new Error(`Unknown ops setting: ${name}`);
  if (name === "metadata.required_fields") {
    const bad = list(value).filter(
      (f) => !(DETECTABLE_METADATA_FIELDS as readonly string[]).includes(f),
    );
    if (bad.length)
      throw new Error(
        `Unknown metadata field(s): ${bad.join(", ")}. Allowed: ${DETECTABLE_METADATA_FIELDS.join(", ")}`,
      );
  }
  await mysql`
    INSERT INTO ops_settings (\`key\`, value, updated_by_user_id, updated_at)
    VALUES (${key(universe, name)}, ${value}, ${userId}, NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value),
      updated_by_user_id = VALUES(updated_by_user_id), updated_at = NOW()
  `;
}

/** Devs and admins review proposals, plus anyone on the reviewer list. */
export async function canReview(
  universe: string,
  user: { userId: number | null; role: string; type?: string },
): Promise<boolean> {
  if (user.type && user.type !== "user") return false;
  if (user.role === "dev" || user.role === "admin") return true;
  if (user.userId == null) return false;
  const s = await getOpsSettings(universe);
  return s.reviewerUserIds.includes(user.userId);
}
