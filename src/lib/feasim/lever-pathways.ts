/**
 * Which pathways each lever affects, worked out from the installed model:
 * change the lever under each pathway, across a spread of lots, TOD tiers and
 * options, and see whether any result changes.
 *
 * `bun scripts/update-feasim-levers.ts` (run by `bun run upgrade:feasim`)
 * saves the answer to generated/lever-pathways.json, which LEVERS reads. The
 * lever test runs the same check and fails if the saved file is out of date.
 */
import { join } from "node:path";

import {
  calcParcel,
  type Parcel,
  type ProgramId,
  type SliderInputs,
  type TodEnvelopeOpts,
} from "@uhero/feasim";

import { LEVERS, PROGRAMS, type LeverName, type LeverSpec } from "./params";

export const LEVER_PATHWAYS_FILE = join(
  import.meta.dir,
  "generated/lever-pathways.json",
);

const LOTS: Parcel[] = [
  { lot_sqft: 20000, zone_class: "BMX-3", height: 150 },
  { lot_sqft: 10000, zone_class: "A-2", height: 60 },
  { lot_sqft: 5000, zone_class: "A-1", height: 30 },
  {
    lot_sqft: 40000,
    zone_class: "AMX-2",
    height: 90,
    tod_regime: "pdt",
    slu_urban: true,
    tod_precinct: "core",
  },
];
const OPTS: TodEnvelopeOpts[] = [{}, { tier: "with_benefits" }];
const CONTEXTS: Partial<SliderInputs>[] = [
  {},
  { include_retail: true },
  { grant_type: "pre_construct" },
  // the step-back shape levers only act on an override, and under TOD the
  // trigger only switches that override on (its value is unused)
  { stepback_trigger_ft: 30 },
  { stepback_ft_per_10ft: 3 },
];

/** Two values far enough apart to change the result if the lever is read. */
function values(name: LeverName, spec: LeverSpec): [unknown, unknown] {
  if (spec.type === "boolean") return [true, false];
  if (spec.type === "enum")
    return [spec.values[0], spec.values[spec.values.length - 1]];
  const hi = spec.max ?? Infinity;
  const lo = spec.min ?? 0;
  const pick: Partial<Record<LeverName, [number, number]>> = {
    height_limit: [30, 120],
    max_far: [1, 5],
    floor_height: [9, 14],
    setback: [0, 25],
    stepback_trigger_ft: [20, 1000],
    stepback_above_ft: [20, 60],
    stepback_ft_per_10ft: [0, 3],
    building_area_per_unit: [400, 1200],
    grant_amount: [0, 80000],
    impact_fee: [0, 30000],
    land_cost: [50, 400],
    hard_cost_per_sqft: [300, 800],
    hold_years: [5, 15],
    amort_years: [20, 40],
    permitting_months: [6, 36],
    const_months: [6, 36],
    leaseup_months: [3, 24],
    retail_rent: [1, 12],
    min_dscr: [1, 1.5],
  };
  return pick[name] ?? [lo === 0 ? 0.05 : lo, Math.min(hi, (lo || 0.05) * 3)];
}

/** Does setting the lever ever change a result (unset vs. either value)? */
export function leverChangesResult(
  program: ProgramId,
  name: LeverName,
): boolean {
  const [a, b] = values(name, LEVERS[name]);
  for (const lot of LOTS)
    for (const opts of OPTS)
      for (const ctx of CONTEXTS) {
        if (name in ctx) continue;
        const run = (v: unknown) =>
          JSON.stringify(calcParcel(program, lot, { ...ctx, [name]: v }, opts));
        const unset = run(undefined);
        if (run(a) !== unset || run(b) !== unset) return true;
      }
  return false;
}

/** Every lever's pathways, from the installed model. */
export function findLeverPathways(): Record<LeverName, ProgramId[]> {
  return Object.fromEntries(
    (Object.keys(LEVERS) as LeverName[]).map((name) => [
      name,
      PROGRAMS.filter((p) => leverChangesResult(p, name)),
    ]),
  ) as Record<LeverName, ProgramId[]>;
}
