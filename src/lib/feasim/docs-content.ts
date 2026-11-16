/**
 * Prose and examples for the feasim API docs page (/docs/feasim-api).
 * The parameter tables there come from the catalogs in ./params.
 */
import type { ProgramId } from "@uhero/feasim";

/** Each pathway's name and what it models. */
export const PATHWAY_INFO: Record<ProgramId, { name: string; about: string }> =
  {
    bill6: {
      name: "Standard (current zoning)",
      about: "Current zoning, as amended by Ord. 26-7. (The id is historical.)",
    },
    standard: {
      name: "Before Ord. 26-7",
      about: "Zoning before Ord. 26-7, for comparison.",
    },
    bill7: {
      name: "Bill 7",
      about:
        "Affordable rental housing under ROH Chapter 32, with grants and no required parking.",
    },
    tod: {
      name: "Transit-oriented development",
      about:
        "PD-T and IPD-T permits near rail stations, with FAR and height bonuses by permit tier.",
    },
    h201: {
      name: "HRS § 201H",
      about:
        "State affordable housing exemptions, with at least 51% of units affordable.",
    },
  };

const LOT = "lot_sqft=20000&zone_class=BMX-3&height=150";

/**
 * Working example queries, one per endpoint, each using an input specific
 * to its pathway where there is one. Tests run every one of them.
 */
export const EXAMPLES: Record<string, string> = {
  "/gauge/bill6": `${LOT}&parking_exempt=true&land_cost=250`,
  "/gauge/standard": LOT,
  "/gauge/bill7": `${LOT}&grant_type=pre_construct&grant_units=affordable`,
  "/gauge/tod":
    "lot_sqft=40000&zone_class=AMX-2&height=90&tod_regime=pdt&slu_urban=true&tod_precinct=core&tier=with_benefits",
  "/gauge/h201": `${LOT}&affordability=0.6&affordable_ami=ami_60`,
  "/gauge/compare": `${LOT}&programs=bill6,bill7,h201&grant_type=pre_construct&fields=max_units,dev_roc,rlv_sqft`,
  "/calculator/bill6": "lot_sqft=10000&zone_class=A-1&height=30",
  "/calculator/standard": "lot_sqft=10000&zone_class=A-1&height=30",
  "/calculator/bill7":
    "lot_sqft=10000&zone_class=A-1&height=30&grant_amount=12000",
  "/calculator/tod":
    "lot_sqft=20000&zone_class=AMX-1&height=30&tod_regime=pdt&tier=major_sd",
  "/calculator/h201": "lot_sqft=10000&zone_class=A-2&height=30",
  "/calculator/compare":
    "lot_sqft=10000&zone_class=A-2&height=60&hard_cost_per_sqft=500&fields=max_units,dev_roc",
  "/defaults": "program=bill7",
};

/** The ParcelOutput fields most callers want; the full result has ~100. */
export const KEY_RESULT_FIELDS: Record<string, string> = {
  max_units: "Units built",
  affordable_units: "Affordable units",
  buildable_sqft: "Gross buildable floor area, sqft",
  net_residential_sqft: "Net residential floor area, sqft",
  net_commercial_sqft: "Net commercial (retail) floor area, sqft",
  height_limit: "Height limit applied, ft",
  built_floors: "Storeys built, parking included",
  built_height: "Height built, ft",
  parking_stalls: "Parking stalls (surface + ground floor + podium)",
  hard_cost: "Hard (construction) cost, $",
  soft_cost: "Soft cost, $ (itemized in soft_cost_breakdown)",
  dev_cost: "Total development cost, $",
  total_financing_cost: "Financing cost, $",
  egi: "Effective gross income, $/yr",
  noi: "Net operating income, $/yr",
  gdv: "Gross development value, $",
  dev_roc: "Return on cost: stabilized NOI ÷ development cost net of grants",
  dev_target_roc: "Target return on cost (cap rate + target spread)",
  dev_levered_irr: "Levered IRR over the hold",
  dev_equity_multiple: "Equity multiple",
  dev_profit: "Developer profit, $",
  dev_dscr: "Debt service coverage ratio",
  rlv: "Residual land value: the most a developer could pay for the land, $",
  rlv_sqft: "Residual land value, $ per sqft of lot",
  pre_construction_subsidy: "Bill 7: pre-construction subsidy, $",
};
