/**
 * The real parcels sampled in fixtures/gauge-parcels.json, each turned into
 * the API request for it, plus the result the gauge itself gets for that
 * parcel (calcParcel). TOD parcels run at every permit tier. Used by the
 * gauge test (params.test.ts) and the report (scripts/feasim-report.tsx).
 */
import {
  calcParcel,
  pathwayEnvelope,
  type Parcel,
  type ProgramId,
  type TodEnvelopeOpts,
  type TodTier,
} from "@uhero/feasim";

import gaugeParcels from "./fixtures/gauge-parcels.json";
import { PROGRAMS, TOD_TIERS } from "./params";

export interface GaugeCase {
  program: ProgramId;
  parcel: Parcel;
  tier?: TodTier;
  /** the parcel (and tier) as gauge endpoint params */
  query: URLSearchParams;
  /** what the gauge computes for it, directly from feasim */
  expected: () => {
    envelope: ReturnType<typeof pathwayEnvelope>;
    result: ReturnType<typeof calcParcel>;
  };
}

export function gaugeCases(): GaugeCase[] {
  const sample = gaugeParcels as unknown as Record<string, Parcel[]>;
  return PROGRAMS.flatMap((program) =>
    (sample[program] ?? []).flatMap((parcel) =>
      (program === "tod" ? [...TOD_TIERS] : [undefined]).map((tier) => {
        const query = new URLSearchParams(
          Object.entries(parcel).map(([k, v]) => [k, String(v)]),
        );
        if (tier) query.set("tier", tier);
        const opts: TodEnvelopeOpts = tier ? { tier } : {};
        return {
          program,
          parcel,
          tier,
          query,
          expected: () => ({
            envelope: pathwayEnvelope(program, parcel, opts),
            result: calcParcel(program, parcel, {}, opts),
          }),
        };
      }),
    ),
  );
}
