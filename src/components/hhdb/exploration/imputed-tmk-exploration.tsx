"use client";

import { CoverageChart } from "./coverage-chart";
import { MatchBreakdownChart } from "./match-breakdown-chart";

/**
 * Exploration tabs for the tables whose TMK is imputed (rent listings,
 * insurance): coverage over time by county, and how each county's TMKs were
 * matched. Everything comes from the freq_ tables the upload scripts rebuild
 * after each load.
 */

export function RentListingsExploration() {
  return (
    <div className="space-y-6">
      <CoverageChart
        table="renthub_listings"
        title="Listing records per month"
        description="Rent listing records by the month RentHub scraped them, stacked by county (from the imputed TMK)."
        dates={[
          {
            date: "scraped_at",
            label: "Scraped",
            description:
              "Rent listing records by the month RentHub scraped them (scraped_at), stacked by county (from the imputed TMK).",
          },
          {
            date: "date_posted",
            label: "Listed",
            description:
              "Rent listing records by the month the listing was posted (date_posted), stacked by county. Where this differs from the scrape month, records were backfilled or scraped long after posting.",
          },
        ]}
        note="Records are scraped listing records, not distinct units: a unit still listed in a later scrape counts again. Coverage before 2022 is thin, and the August 2023 spike in scrapes is a vendor backfill of older listings — switch to Listed to see when those were posted. Gaps are months with no records."
      />
      <MatchBreakdownChart
        table="renthub_listings"
        column="tmk_match"
        title="How each listing's TMK was found"
        description="Share of listings by match type, per county and statewide (tmk_match). Darker = more confident."
        note="County bars count listings with a TMK; listings with no TMK appear only in the statewide bar. Point only = the point fell in the parcel but the address could not confirm it (right ~90% of the time in spot checks)."
      />
      <MatchBreakdownChart
        table="renthub_listings"
        column="cpr_match"
        title="Listings matched to a condo unit (CPR)"
        description="Share of listings whose TMK was narrowed from the parcel to one condo unit, per county and statewide (cpr_match)."
        note="Parcel only = a TMK, but the listing gives no unit that matches one (not a condo, or only the building's address). Only CPR-level rows join to owners on tmk."
      />
    </div>
  );
}

export function InsurancePoliciesExploration() {
  return (
    <div className="space-y-6">
      <CoverageChart
        table="insurance_policies"
        title="Policy records per year"
        description="FICOH policy records by effective-date year, stacked by county (from the imputed TMK). One record per policy term per insured location."
        note="2025 covers terms effective January–June only."
      />
      <MatchBreakdownChart
        table="insurance_policies"
        column="tmk_match"
        title="How each policy's TMK was found"
        description="Share of policy records by match type, per county and statewide (tmk_match). Darker = more confident."
        note="County bars count records with a TMK; records with no TMK (address missing, not in qPublic, or on several parcels) appear only in the statewide bar."
      />
    </div>
  );
}

export function InsuranceClaimsExploration() {
  return (
    <div className="space-y-6">
      <CoverageChart
        table="insurance_claims"
        title="Claims per year"
        description="FICOH claims by year of loss, stacked by county (from the imputed TMK)."
        note="2020 starts in August and 2025 ends in November. 2023 includes 857 claims dated August 8 (the Lahaina fire)."
      />
      <MatchBreakdownChart
        table="insurance_claims"
        column="tmk_match"
        title="How each claim's TMK was found"
        description="Share of claims by match type, per county and statewide (tmk_match). Darker = more confident."
        note="County bars count claims with a TMK; claims with no TMK appear only in the statewide bar."
      />
    </div>
  );
}
