"use client";

import { CoverageByYearChart } from "./coverage-by-year-chart";

/**
 * Exploration tabs for the tables whose TMK is imputed (rent listings,
 * insurance). For now each has one chart: records per year by county, with
 * the no-TMK share made visible. Everything comes from the freq_ tables the
 * upload scripts rebuild after each load.
 */

export function RentListingsExploration() {
  return (
    <div className="space-y-6">
      <CoverageByYearChart
        table="renthub_listings"
        title="Listing records per year"
        description="Rent listing records by the year RentHub scraped them, stacked by county (from the imputed TMK)."
        note="Records are scraped listing records, not distinct units: a unit still listed in a later scrape counts again. Coverage before 2022 is thin."
      />
    </div>
  );
}

export function InsurancePoliciesExploration() {
  return (
    <div className="space-y-6">
      <CoverageByYearChart
        table="insurance_policies"
        title="Policy records per year"
        description="FICOH policy records by effective-date year, stacked by county (from the imputed TMK). One record per policy term per insured location."
        note="2025 covers terms effective January–June only."
      />
    </div>
  );
}

export function InsuranceClaimsExploration() {
  return (
    <div className="space-y-6">
      <CoverageByYearChart
        table="insurance_claims"
        title="Claims per year"
        description="FICOH claims by year of loss, stacked by county (from the imputed TMK)."
        note="2020 starts in August and 2025 ends in November. 2023 includes 857 claims dated August 8 (the Lahaina fire)."
      />
    </div>
  );
}
