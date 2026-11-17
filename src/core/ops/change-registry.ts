/*************************************************************************
 * Change registry: every kind of change that can be made through ops
 * registers here once. A kind says what it targets, what `after` may
 * contain, how to read the current state, how to validate, and how to
 * apply.
 *
 * Everything else is built from the registry:
 *   - `propose_change` takes its kind list and description from it
 *   - approving a proposal calls the kind's `apply`
 *   - a dev's direct edit tool calls the same `apply`
 * so a proposal and a direct edit can't drift apart.
 *
 * Adding a capability (geographies, data lists, forecasts, …) is one
 * module under ./change-kinds that calls registerChangeKind, plus read
 * tools on the catalog MCP and, optionally, a detector.
 *************************************************************************/

import type { z } from "zod";

import type { DryRunResult } from "./dry-run";
import type { MetadataBasis } from "./rules";
import type { Actor, ChangeType, Lane, ResolutionPath } from "./types";

export interface ChangeTarget<A = Record<string, unknown>> {
  targetId: number;
  after: A;
}

export interface ApplyContext {
  universe: string;
  actor: Actor;
  /** The ops issue this change is for, when there is one. */
  issueId: number | null;
  /** Overrides the resolution path credited on the issue. */
  credit?: ResolutionPath;
}

export interface ChangeKind<
  A extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Stored in ops_proposals.kind. */
  kind: string;
  /** What `targetId` is the id of: loader, series, measurement, … */
  targetType: string;
  /** One line for tool descriptions: the target and what `after` holds. */
  summary: string;
  /** Orders the review queue: error fixes come before metadata. */
  workClass: Lane;
  /** Which autonomy setting governs this change. */
  changeType(basis?: MetadataBasis): ChangeType;
  /**
   * Schema for `after`. Parsing also normalizes it (a kind whose change is
   * fixed, like a reload, parses anything to its one value).
   */
  afterSchema: z.ZodType<A>;
  /**
   * Current state of the fields this change touches. Stored as the
   * proposal's `before` and compared again when it is applied: if they
   * differ, someone changed the target in between and the change is stale.
   * Throws when the target doesn't exist or isn't in the universe.
   */
  snapshot(
    target: ChangeTarget<A>,
    universe: string,
  ): Promise<Record<string, unknown>>;
  /** Extra checks beyond the schema (lookups exist, the eval resolves). */
  validate?(
    target: ChangeTarget<A> & { before: Record<string, unknown> },
    ctx: { universe: string; actor: Actor },
  ): Promise<void>;
  /** For load statements: evaluate without writing, and diff. */
  dryRun?(target: ChangeTarget<A>): Promise<DryRunResult>;
  /** Make the change. Logged and recorded on issues by the change path. */
  apply(target: ChangeTarget<A>, ctx: ApplyContext): Promise<void>;
  /**
   * The change is confirmed by the reload it queues, not at once: the
   * issue goes to "resolving" until the reload job reports back.
   */
  verifiesByReload?: boolean;
  /**
   * With autonomy above 0, apply without review only when every field in
   * `before` was empty. Overwriting a value is always reviewed.
   */
  autonomyFillsOnly?: boolean;
  /** A dev-only tool on the catalog MCP that applies this kind directly. */
  directTool?: { name: string; title: string; description: string };
}

const REGISTRY = new Map<string, ChangeKind>();

export function registerChangeKind<A extends Record<string, unknown>>(
  def: ChangeKind<A>,
): void {
  if (REGISTRY.has(def.kind))
    throw new Error(`Change kind registered twice: ${def.kind}`);
  REGISTRY.set(def.kind, def as unknown as ChangeKind);
}

export function getChangeKind(kind: string): ChangeKind {
  const def = REGISTRY.get(kind);
  if (!def)
    throw new Error(
      `Unknown change kind: ${kind}. Known: ${[...REGISTRY.keys()].join(", ")}`,
    );
  return def;
}

export function listChangeKinds(): ChangeKind[] {
  return [...REGISTRY.values()];
}
