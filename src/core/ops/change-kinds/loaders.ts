/** Change kinds for loaders (data_sources): update, create, disable, reload. */

import LoaderCollection from "@catalog/collections/loader-collection";
import type { Universe } from "@catalog/types/shared";
import { z } from "zod";

import { registerChangeKind } from "../change-registry";
import {
  applyLoaderCreate,
  applyLoaderDisable,
  applyLoaderUpdate,
  currentLoaderState,
  currentSeriesState,
  requestReload,
} from "../changes";
import { dryRunLoad } from "../dry-run";
import { OpsError } from "../issues";
import { agentEvalRefusal } from "../rules";
import type { Actor } from "../types";

const loaderFields = {
  eval: z.string().min(1),
  priority: z.number().int(),
  scale: z.number(),
  presaveHook: z.string().nullable(),
  clearBeforeLoad: z.boolean(),
  pseudoHistory: z.boolean(),
  reloadNightly: z.boolean(),
  maxLagDays: z.number().int().nullable(),
};

async function loaderIn(universe: string, loaderId: number) {
  const state = await currentLoaderState(loaderId);
  if (state.universe !== universe)
    throw new OpsError(`Loader ${loaderId} is not in ${universe}`);
  return state;
}

async function seriesIn(universe: string, seriesId: number) {
  const state = await currentSeriesState(seriesId);
  if (state.universe !== universe)
    throw new OpsError(`Series ${seriesId} is not in ${universe}`);
  return state;
}

/**
 * Only devs may supply a load statement that names arbitrary file paths:
 * it runs on the server (see agentEvalRefusal).
 */
function checkEvalAllowed(actor: Actor, evalStr: unknown): void {
  if (evalStr == null) return;
  const dev = actor.type === "user" && ["dev", "admin"].includes(actor.role);
  if (dev) return;
  const refusal = agentEvalRefusal(String(evalStr));
  if (refusal) throw new OpsError(refusal);
}

registerChangeKind({
  kind: "loader_update",
  targetType: "loader",
  summary:
    "edit a loader. after: any of eval, priority, scale, presaveHook, clearBeforeLoad, pseudoHistory, reloadNightly, maxLagDays. The loader is reloaded after.",
  workClass: "errors",
  changeType: () => "loader_update",
  afterSchema: z
    .object(loaderFields)
    .partial()
    .strict()
    .refine((a) => Object.keys(a).length > 0, "Give at least one field"),
  async snapshot({ targetId, after }, universe) {
    const state = await loaderIn(universe, targetId);
    // Always include eval, so an edit to it since makes the change stale.
    const keys = new Set([...Object.keys(after), "eval"]);
    return Object.fromEntries([...keys].map((k) => [k, state[k]]));
  },
  async validate({ targetId, after }, { actor }) {
    checkEvalAllowed(actor, after.eval);
    if (after.eval) {
      const state = await currentLoaderState(targetId);
      await LoaderCollection.checkEval(after.eval, Number(state.seriesId));
    }
  },
  dryRun: ({ targetId, after }) =>
    dryRunLoad({ loaderId: targetId, eval: after.eval, scale: after.scale }),
  async apply({ targetId, after }, { actor, issueId }) {
    await applyLoaderUpdate(targetId, after, actor, issueId);
    await requestReload(targetId, actor, issueId);
  },
  verifiesByReload: true,
  directTool: {
    name: "update_loader",
    title: "Edit a loader",
    description:
      "Dev only. Edit a loader directly and reload it (logged in loader actions, recorded on its issues). Prefer dry_run_loader first.",
  },
});

registerChangeKind({
  kind: "reload",
  targetType: "loader",
  summary:
    "re-run a loader unchanged, e.g. after a temporary failure. after: {}",
  workClass: "errors",
  changeType: () => "request_reload",
  afterSchema: z.unknown().transform(() => ({}) as Record<string, never>),
  async snapshot({ targetId }, universe) {
    return { eval: (await loaderIn(universe, targetId)).eval };
  },
  dryRun: ({ targetId }) => dryRunLoad({ loaderId: targetId }),
  apply: ({ targetId }, { actor, issueId }) =>
    requestReload(targetId, actor, issueId),
  verifiesByReload: true,
  directTool: {
    name: "request_reload",
    title: "Reload a loader",
    description:
      "Dev only. Queue a reload of one loader. With issue_id, the issue is verified when it finishes.",
  },
});

registerChangeKind({
  kind: "loader_disable",
  targetType: "loader",
  summary: "disable a loader. after: {}",
  workClass: "errors",
  changeType: () => "loader_disable",
  afterSchema: z.unknown().transform(() => ({ disabled: true as const })),
  async snapshot({ targetId }, universe) {
    return { disabled: (await loaderIn(universe, targetId)).disabled };
  },
  apply: ({ targetId }, { actor, issueId }) =>
    applyLoaderDisable(targetId, actor, issueId),
});

registerChangeKind({
  kind: "loader_create",
  targetType: "series",
  summary:
    "add a loader to a series (target = the series). after: eval (required), priority, scale, presaveHook, clearBeforeLoad, pseudoHistory, maxLagDays. It is loaded after.",
  workClass: "errors",
  changeType: () => "loader_create",
  afterSchema: z
    .object({
      eval: loaderFields.eval,
      priority: loaderFields.priority.optional(),
      scale: loaderFields.scale.optional(),
      presaveHook: loaderFields.presaveHook.optional(),
      clearBeforeLoad: loaderFields.clearBeforeLoad.optional(),
      pseudoHistory: loaderFields.pseudoHistory.optional(),
      maxLagDays: loaderFields.maxLagDays.optional(),
    })
    .strict(),
  // Nothing exists yet to compare against; the series must, though.
  async snapshot({ targetId }, universe) {
    await seriesIn(universe, targetId);
    return {};
  },
  async validate({ targetId, after }, { actor }) {
    checkEvalAllowed(actor, after.eval);
    await LoaderCollection.checkEval(after.eval, targetId);
  },
  dryRun: ({ targetId, after }) =>
    dryRunLoad({
      seriesId: targetId,
      eval: after.eval,
      scale: after.scale ?? 1,
    }),
  async apply({ targetId, after }, { actor, issueId, universe }) {
    const created = await applyLoaderCreate(
      targetId,
      universe as Universe,
      after,
      actor,
      issueId,
    );
    await requestReload(created.loaderId, actor, issueId);
  },
  verifiesByReload: true,
});
