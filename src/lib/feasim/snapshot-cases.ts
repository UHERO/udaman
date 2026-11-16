/**
 * API snapshots: a small set of requests whose full responses are saved in
 * __snapshots__/api-responses.json. The snapshot test fails when any response
 * changes — your own edits or a feasim upgrade — and the report shows what
 * changed, field by field. After reviewing an intended change:
 *
 *   bun run snapshot:feasim
 *
 * Responses leave out `model` (the feasim version), so an upgrade only shows
 * up where it changes something. Used by snapshots.test.ts,
 * scripts/update-feasim-snapshots.ts and scripts/feasim-report.tsx; callers
 * stub the API-key lookup (setApiKeyLookup) first.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { NextRequest } from "next/server";

import { GET as calcPathway } from "@/app/api/feasim/calculator/[pathway]/route";
import { GET as calcCompare } from "@/app/api/feasim/calculator/compare/route";
import { GET as defaults } from "@/app/api/feasim/defaults/route";
import { GET as gaugePathway } from "@/app/api/feasim/gauge/[pathway]/route";
import { GET as gaugeCompare } from "@/app/api/feasim/gauge/compare/route";

import { EXAMPLES } from "./docs-content";
import { PROGRAMS } from "./params";

export const SNAPSHOT_FILE = join(
  import.meta.dir,
  "__snapshots__/api-responses.json",
);

export interface SnapshotCase {
  name: string;
  path: string;
  query: string;
  /** send an API key (default true) */
  key?: boolean;
}

/** Results trimmed to a few headline fields, so each snapshot stays short. */
const FIELDS = "max_units,affordable_units,dev_cost,dev_roc,rlv_sqft";
const LOT = "lot_sqft=20000&zone_class=BMX-3&height=150";

export const SNAPSHOT_CASES: SnapshotCase[] = [
  ...(["gauge", "calculator"] as const).flatMap((mode) =>
    PROGRAMS.map((p) => ({
      name: `${mode}/${p}`,
      path: `/${mode}/${p}`,
      query: `${EXAMPLES[`/${mode}/${p}`]}&fields=${FIELDS}`,
    })),
  ),
  ...["/gauge/compare", "/calculator/compare"].map((path) => ({
    name: path.slice(1),
    path,
    query: EXAMPLES[path],
  })),
  { name: "defaults (bill7)", path: "/defaults", query: "program=bill7" },
  {
    name: "error: invalid parameters",
    path: "/gauge/bill6",
    query:
      "lot_sqft=20000&zone_class=bmx3&grant_type=pre_construct&land_cots=200&permanent_rate=0",
  },
  {
    name: "error: unknown station area",
    path: "/calculator/tod",
    query: "lot_sqft=40000&zone_class=AMX-2&height=60&station_area=Nowhere",
  },
  { name: "error: unknown pathway", path: "/gauge/bill9", query: LOT },
  { name: "error: no API key", path: "/gauge/bill6", query: LOT, key: false },
];

/** Call the route handler serving `path`, as Next.js would. */
async function requestApi(path: string, query: string, key: boolean) {
  const req = new NextRequest(
    `${process.env.AUTH_URL}/api/feasim${path}?${query}`,
    key ? { headers: { authorization: "Bearer snapshot" } } : undefined,
  );
  const [, mode, last] = path.split("/");
  const res =
    path === "/defaults"
      ? await defaults(req)
      : last === "compare"
        ? await (mode === "gauge" ? gaugeCompare : calcCompare)(req)
        : await (mode === "gauge" ? gaugePathway : calcPathway)(req, {
            params: Promise.resolve({ pathway: last }),
          });
  return { status: res.status, body: await res.json() };
}

export type Snapshot = { request: string; status: number; body: unknown };

/** The response to a case, as saved: status and body, without `model`. */
export async function takeSnapshot(c: SnapshotCase): Promise<Snapshot> {
  const { status, body } = await requestApi(c.path, c.query, c.key ?? true);
  const { model: _model, ...rest } = body as Record<string, unknown>;
  return { request: `${c.path}?${c.query}`, status, body: rest };
}

/** Saved snapshots by case name ({} before the first save). */
export function loadSnapshots(): Record<string, Snapshot> {
  if (!existsSync(SNAPSHOT_FILE)) return {};
  const { _about: _a, ...saved } = JSON.parse(
    readFileSync(SNAPSHOT_FILE, "utf8"),
  );
  return saved;
}

export function saveSnapshots(snapshots: Record<string, Snapshot>) {
  const about =
    "Saved feasim API responses; see src/lib/feasim/snapshot-cases.ts. Written by `bun run snapshot:feasim` — don't edit by hand.";
  mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(
    SNAPSHOT_FILE,
    `${JSON.stringify({ _about: about, ...snapshots }, null, 2)}\n`,
  );
}

export type Change = { path: string; saved: unknown; current: unknown };

/** Every leaf that differs, as a path like `body.result.max_units`. */
export function diffJson(
  saved: unknown,
  current: unknown,
  path = "",
): Change[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;
  if (
    isObj(saved) &&
    isObj(current) &&
    Array.isArray(saved) === Array.isArray(current)
  ) {
    const keys = [...new Set([...Object.keys(saved), ...Object.keys(current)])];
    return keys.flatMap((k) =>
      diffJson(
        saved[k],
        current[k],
        Array.isArray(saved) ? `${path}[${k}]` : path ? `${path}.${k}` : k,
      ),
    );
  }
  return JSON.stringify(saved) === JSON.stringify(current)
    ? []
    : [{ path, saved, current }];
}
