/**
 * The 17 calculator setups recorded in fixtures/calculator-defaults.json
 * (bill6, bill6 with retail, tod PD-T tier 2, …), each turned into the API
 * request a calculator user would send for it. Used by the calculator test
 * (params.test.ts) and the report (scripts/feasim-report.tsx), so both send
 * the same requests.
 */
import type { SliderInputs } from "@uhero/feasim";

import calculatorDefaults from "./fixtures/calculator-defaults.json";
import { TOD_TIERS } from "./params";

export interface CalculatorCase {
  /** fixture key, e.g. "bill7 with retail", "tod PD-T tier 2" */
  name: string;
  /** the complete calcSingle inputs the calculator page builds */
  inputs: SliderInputs;
  /** only what a calculator user sets, as calculator endpoint params */
  query: URLSearchParams;
}

export function calculatorCases(): CalculatorCase[] {
  // keys starting with "_" are notes (_about, _source), not cases
  const cases = Object.entries(calculatorDefaults).filter(
    ([k]) => !k.startsWith("_"),
  ) as unknown as [string, SliderInputs][];
  // TOD: the zoning height the tier raises, which the plain tod case records
  const todBaseHeight = Object.fromEntries(cases).tod.height_limit!;

  return cases.map(([name, inputs]) => {
    const query = new URLSearchParams({
      lot_sqft: String(inputs.lot_sqft),
      zone_class: inputs.zone_class!,
      height: String(
        inputs.program === "tod" ? todBaseHeight : inputs.height_limit,
      ),
    });
    const m = name.match(/(IPD-T|PD-T) (?:tier (\d)|industrial)/);
    if (m) {
      query.set("tod_regime", m[1] === "PD-T" ? "pdt" : "ipdt");
      if (m[2]) query.set("tier", TOD_TIERS[Number(m[2])]);
    }
    if (inputs.include_retail) query.set("include_retail", "true");
    // the calculator passes Bill 7's grant explicitly
    if (inputs.grant_amount !== undefined)
      query.set("grant_amount", String(inputs.grant_amount));
    return { name, inputs, query };
  });
}
