/**
 * Data Registry Seed Script
 *
 * Populates the data_registry table with roughly 50 pseudo entries for
 * testing the /data-registry page
 *
 *
 * Run: bun run src/lib/prisma/migrations/data-registry-seed/seed.ts [--execute]
 *
 * Without --execute, runs in dry-run mode (prints what would be created).
 */

import { mysql, rawQuery } from "@/lib/mysql/db";

const DRY_RUN = !process.argv.includes("--execute");

type Entry = {
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: "Public" | "Restricted" | "Sensitive" | "Regulated";
  requiresApproval: boolean;
  approvalDetails: string | null;
  description: string;
};

const ENTRIES: Entry[] = [
  {
    title: "Hawaii State Legislative Bills",
    source: "Hawaii State Legislature",
    access: "https://uhu.uhero.hawaii.edu/bill-tracker",
    owner: "UHERO Utilities",
    contact: "edpolicy@uhero.hawaii.edu",
    format: "API",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "A state legislative bill tracker that provides daily updates, monitoring bill progress and changes with text message updates. View at: https://uhu.uhero.hawaii.edu/bill-tracker",
  },
  {
    title: "BEA Regional Personal Income",
    source: "Bureau of Economic Analysis",
    access: "https://apps.bea.gov/regional/downloadzip.htm",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "County and state level personal income, wages, and employment data published quarterly by BEA. Used to build the UHERO regional income forecast series and cross-checked against DBEDT figures.",
  },
  {
    title: "DBEDT Visitor Statistics",
    source: "Hawaii DBEDT",
    access: "https://dbedt.hawaii.gov/visitor/",
    owner: "DBEDT Research Division",
    contact: "research@dbedt.hawaii.gov",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Monthly visitor arrivals, spending, and length-of-stay statistics broken out by island and market segment. Feeds the tourism forecast dashboard and monthly economic indicators report.",
  },
  {
    title: "Hawaii Unemployment Insurance Claims",
    source: "Hawaii DLIR",
    access: "https://dlir.hawaii.gov/rs/",
    owner: "DLIR Research & Statistics",
    contact: "dlir.stats@hawaii.gov",
    format: "CSV",
    security: "Restricted",
    requiresApproval: true,
    approvalDetails:
      "Requires a data-sharing agreement with DLIR — contact the Research & Statistics Office before requesting a fresh extract.",
    description:
      "Weekly initial and continued unemployment insurance claims by county and industry sector. Used for near-real-time labor market tracking during recessions.",
  },
  {
    title: "Honolulu Property Tax Assessments",
    source: "City & County of Honolulu RPAD",
    access: "https://qpublic.schneidercorp.com/Application.aspx?AppID=1120",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "SQL",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Parcel-level real property assessment records for Oahu, refreshed annually and loaded into the Hawaii Housing Database (HHDB) for valuation and permit analyses.",
  },
  {
    title: "American Community Survey 5-Year Estimates",
    source: "U.S. Census Bureau",
    access: "https://api.census.gov/data/2023/acs/acs5",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "API",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Demographic, housing, income, and commuting estimates at the tract and county level. Backs most of the demographic measurements in the HHF universe.",
  },
  {
    title: "Hawaii Health Data Warehouse Restricted Extract",
    source: "Hawaii Health Data Warehouse",
    access: "Internal SFTP — see UHERO IT for credentials",
    owner: "UHERO Health Economics",
    contact: "healtheconomics@uhero.hawaii.edu",
    format: "SQL",
    security: "Regulated",
    requiresApproval: true,
    approvalDetails:
      "IRB approval required (protocol #2024-0143) plus PI sign-off from Dr. Kanani Espinda before any extract is released.",
    description:
      "De-identified but restricted health utilization records used for cost-of-care research. Subject to HIPAA-adjacent data use agreements with the state health data warehouse.",
  },
  {
    title: "Hawaii Tourism Authority Air Seat Capacity",
    source: "Hawaii Tourism Authority",
    access: "https://www.hawaiitourismauthority.org/research/",
    owner: "HTA Research Division",
    contact: "research@hawaiitourismauthority.org",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Scheduled air seat capacity by origin market and island, published monthly. Cross-referenced with DBEDT visitor arrivals for forecast reconciliation.",
  },
  {
    title: "Zillow Home Value Index (ZHVI)",
    source: "Zillow Research",
    access: "https://www.zillow.com/research/data/",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Smoothed, seasonally adjusted home value index at the ZIP code level, used as a cross-check against county assessor valuations in HHDB.",
  },
  {
    title: "Craigslist Rental Listings Scrape",
    source: "UHERO Web Scraper",
    access: "Internal — scraper output stored in rental_listings table",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "SQL",
    security: "Restricted",
    requiresApproval: true,
    approvalDetails:
      "Contact the UHERO Data Team lead before redistributing raw listing text outside UHERO — scraped content has redistribution restrictions.",
    description:
      "Nightly scrape of Oahu rental listings used to build the median asking-rent series that feeds the housing affordability measurements.",
  },
  {
    title: "State of Hawaii General Excise Tax Collections",
    source: "Hawaii Department of Taxation",
    access: "https://tax.hawaii.gov/stats/",
    owner: "UHERO Forecast Team",
    contact: "forecast@uhero.hawaii.edu",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Monthly GET collections by industry classification. A leading indicator used in the quarterly state revenue forecast.",
  },
  {
    title: "Bureau of Labor Statistics QCEW",
    source: "U.S. Bureau of Labor Statistics",
    access: "https://www.bls.gov/cew/downloadable-data-files.htm",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Quarterly Census of Employment and Wages — county and industry level employment and wage data used for the industry employment forecast series.",
  },
  {
    title: "Hawaii DOE Student Enrollment Records",
    source: "Hawaii Department of Education",
    access: "Restricted — request via DOE Office of Data Governance",
    owner: "UHERO Education Policy",
    contact: "edpolicy@uhero.hawaii.edu",
    format: "SQL",
    security: "Regulated",
    requiresApproval: true,
    approvalDetails:
      "Requires IRB approval and a signed data use agreement with DOE Data Governance — student-level records are FERPA protected.",
    description:
      "De-identified student enrollment and demographic records by school and grade, used for education policy research on housing/school proximity effects.",
  },
  {
    title: "FEMA National Flood Hazard Layer",
    source: "FEMA",
    access: "https://www.fema.gov/flood-maps/national-flood-hazard-layer",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "OTHER",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "GIS flood zone shapefiles used to flag parcels in flood hazard areas within the housing database. Updated on FEMA's remapping schedule (irregular).",
  },
  {
    title: "Honolulu Building Permit Records",
    source: "City & County of Honolulu DPP",
    access: "https://dppweb.honolulu.gov/Neighborhood/Search",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "MULTI",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "New construction and renovation permit filings for Oahu, scraped and normalized monthly. Drives the new-unit-permitted measurements in HHF.",
  },
  {
    title: "Transient Accommodations Tax Filings",
    source: "Hawaii Department of Taxation",
    access: "Restricted — contact Dept. of Taxation Research Office",
    owner: "UHERO Forecast Team",
    contact: "forecast@uhero.hawaii.edu",
    format: "CSV",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Requires PI sign-off from the UHERO Executive Director before sharing outside the forecast team — contains taxpayer-identifiable aggregates.",
    description:
      "Monthly TAT collections used to estimate short-term rental / vacation rental activity by county, feeding the tourism revenue forecast.",
  },
  {
    title: "NOAA Climate Normals",
    source: "NOAA National Centers for Environmental Information",
    access:
      "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "API",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "30-year climate normals for temperature and precipitation by station, used as control variables in agricultural and energy demand models.",
  },
  {
    title: "Hawaiian Electric Company Load Data",
    source: "Hawaiian Electric",
    access: "Restricted — data sharing agreement required",
    owner: "UHERO Energy Policy",
    contact: "energy@uhero.hawaii.edu",
    format: "CSV",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Requires a signed data sharing agreement with Hawaiian Electric's Resource Planning group — contact UHERO Energy Policy PI first.",
    description:
      "Hourly system load and interconnection queue data used in renewable energy integration and grid capacity research.",
  },
  {
    title: "Hawaii DBEDT Population and Economic Projections",
    source: "Hawaii DBEDT",
    access: "https://dbedt.hawaii.gov/economic/",
    owner: "DBEDT Research Division",
    contact: "research@dbedt.hawaii.gov",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Long-range state and county population and economic projections published every few years, used as a baseline comparison for UHERO's own forecasts.",
  },
  {
    title: "OpenTable Restaurant Reservation Trends",
    source: "OpenTable",
    access: "https://www.opentable.com/state-of-industry",
    owner: "UHERO Tourism Team",
    contact: "tourism@uhero.hawaii.edu",
    format: "API",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Aggregated year-over-year seated diner trends by metro area, used as a high-frequency proxy for local consumer spending activity.",
  },
  {
    title: "Hawaii Foreclosure Filings",
    source: "Bureau of Conveyances",
    access: "https://boc.ehawaii.gov/",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "PDF",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Notice of default and foreclosure sale filings recorded with the Bureau of Conveyances, used to track distressed property activity by county.",
  },
  {
    title: "Social Security Administration County Benefit Payments",
    source: "Social Security Administration",
    access: "https://www.ssa.gov/policy/docs/statcomps/oasdi_sc/",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual county-level OASDI beneficiary counts and payment totals, used in retirement income and aging-population research.",
  },
  {
    title: "Hawaii Judiciary Eviction Case Records",
    source: "Hawaii State Judiciary",
    access: "Restricted — contact Judiciary Data Governance Office",
    owner: "UHERO Housing Policy",
    contact: "housingpolicy@uhero.hawaii.edu",
    format: "SQL",
    security: "Regulated",
    requiresApproval: true,
    approvalDetails:
      "IRB approval required plus a signed data use agreement with the Judiciary — case-level records include personally identifying information.",
    description:
      "District court eviction (summary possession) case filings and outcomes by ZIP code, used for housing instability research.",
  },
  {
    title: "Hawaii Ocean Freight Container Volume",
    source: "Hawaii DOT Harbors Division",
    access: "https://hidot.hawaii.gov/harbors/",
    owner: "UHERO Forecast Team",
    contact: "forecast@uhero.hawaii.edu",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Monthly inbound/outbound container volume by harbor, used as a leading indicator of retail and construction activity.",
  },
  {
    title: "Hawaii Condo Association Financial Filings",
    source: "Hawaii Real Estate Commission",
    access: "Restricted — request via Real Estate Commission",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "MULTI",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Requires written approval from the Real Estate Commission's Condominium Registration Office before bulk access is granted.",
    description:
      "Annual condominium association budgets and reserve study filings, used to study maintenance-fee trends and reserve funding adequacy.",
  },
  {
    title: "Hawaii DBEDT Construction Cost Index",
    source: "Hawaii DBEDT",
    access: "https://dbedt.hawaii.gov/economic/data_reports/",
    owner: "DBEDT Research Division",
    contact: "research@dbedt.hawaii.gov",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Quarterly construction cost index by trade category for Honolulu, used to deflate nominal construction spending figures.",
  },
  {
    title: "UHERO Consumer Sentiment Survey",
    source: "UHERO",
    access: "Internal survey platform — see UHERO Survey Team",
    owner: "UHERO Survey Team",
    contact: "surveys@uhero.hawaii.edu",
    format: "SQL",
    security: "Restricted",
    requiresApproval: true,
    approvalDetails:
      "Requires IRB approval (survey protocol on file) — respondent-level data is not shared outside the Survey Team without PI sign-off.",
    description:
      "Quarterly survey of Hawaii resident economic sentiment and spending intentions, fielded and processed in-house by the UHERO Survey Team.",
  },
  {
    title: "Airbnb / Short-Term Rental Listings (AirDNA)",
    source: "AirDNA",
    access: "Restricted — paid data license, contact UHERO Data Team",
    owner: "UHERO Tourism Team",
    contact: "tourism@uhero.hawaii.edu",
    format: "API",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Licensed dataset — redistribution outside UHERO violates the AirDNA data license. Contact the UHERO Data Team lead before sharing extracts.",
    description:
      "Short-term rental listing counts, occupancy, and average daily rate by island, licensed from AirDNA for vacation rental market monitoring.",
  },
  {
    title: "Hawaii DOH Vital Statistics — Births",
    source: "Hawaii Department of Health",
    access: "Restricted — contact DOH Office of Health Status Monitoring",
    owner: "UHERO Health Economics",
    contact: "healtheconomics@uhero.hawaii.edu",
    format: "SQL",
    security: "Regulated",
    requiresApproval: true,
    approvalDetails:
      "IRB approval required plus DOH data use agreement — vital statistics microdata is subject to state confidentiality statutes.",
    description:
      "County-level birth records used for demographic and population projection cross-validation.",
  },
  {
    title: "Kauai County Real Property Tax Roll",
    source: "Kauai County Real Property Assessment",
    access:
      "https://www.kauai.gov/Government/Departments-Agencies/Finance/Real-Property",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual Kauai County property tax roll, loaded into HHDB alongside the other three counties for statewide parcel coverage.",
  },
  {
    title: "Maui County Real Property Tax Roll",
    source: "Maui County Real Property Assessment",
    access: "https://www.mauicounty.gov/223/Real-Property-Assessment",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual Maui County property tax roll, loaded into HHDB alongside the other three counties for statewide parcel coverage.",
  },
  {
    title: "Hawaii County Real Property Tax Roll",
    source: "Hawaii County Real Property Tax Office",
    access: "https://www.hawaiipropertytax.com/",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual Hawaii County (Big Island) property tax roll, loaded into HHDB alongside the other three counties for statewide parcel coverage.",
  },
  {
    title: "USDA Farm Income and Land Values",
    source: "USDA Economic Research Service",
    access:
      "https://www.ers.usda.gov/data-products/farm-income-and-wealth-statistics/",
    owner: "UHERO Agriculture Team",
    contact: "agriculture@uhero.hawaii.edu",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "State-level farm income and land value estimates, used as a benchmark for Hawaii agricultural sector research.",
  },
  {
    title: "Hawaii Homeless Point-in-Time Count",
    source: "Hawaii Department of Human Services",
    access: "https://homelessness.hawaii.gov/pit-count/",
    owner: "UHERO Housing Policy",
    contact: "housingpolicy@uhero.hawaii.edu",
    format: "PDF",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual statewide point-in-time count of individuals experiencing homelessness, broken out by sheltered/unsheltered status and county.",
  },
  {
    title: "Hawaii DCCA Business Registration Records",
    source: "Hawaii Department of Commerce and Consumer Affairs",
    access: "https://cca.hawaii.gov/breg/",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "SQL",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "New business registration filings by industry and county, used as a leading indicator of local business formation activity.",
  },
  {
    title: "Federal Reserve FRED Hawaii Series",
    source: "Federal Reserve Bank of St. Louis (FRED)",
    access: "https://fred.stlouisfed.org/",
    owner: "UHERO Forecast Team",
    contact: "forecast@uhero.hawaii.edu",
    format: "API",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Hawaii-specific macroeconomic time series (employment, housing, interest rates) pulled via the FRED API for benchmark comparisons.",
  },
  {
    title: "State of Hawaii Employee Payroll (Aggregated)",
    source: "Hawaii Department of Budget and Finance",
    access: "Restricted — contact B&F Office of Public Records",
    owner: "UHERO Public Sector Team",
    contact: "publicsector@uhero.hawaii.edu",
    format: "XLSX",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Aggregated to department level before release — request individual approval from B&F's Office of Public Records for any disaggregated cut.",
    description:
      "Aggregated state government payroll totals by department, used in public sector employment and wage research.",
  },
  {
    title: "Hawaii Solar PV Interconnection Applications",
    source: "Hawaiian Electric",
    access:
      "https://www.hawaiianelectric.com/products-and-services/customer-renewable-programs",
    owner: "UHERO Energy Policy",
    contact: "energy@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Monthly rooftop solar interconnection application and installation counts by island, used to track distributed generation adoption.",
  },
  {
    title: "Hawaii Vehicle Registration Counts",
    source: "Hawaii Department of Transportation",
    access: "https://hidot.hawaii.gov/",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual registered vehicle counts by county and vehicle class, used as a proxy for household wealth and transportation demand.",
  },
  {
    title: "Google Community Mobility Reports (Archived)",
    source: "Google",
    access: "Archived internally — original source discontinued",
    owner: "UHERO Data Team",
    contact: "data@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Archived daily mobility trend data by place category, originally published during the COVID-19 pandemic and retained for historical analysis.",
  },
  {
    title: "Hawaii Health Insurance Enrollment (ACA Marketplace)",
    source: "Centers for Medicare & Medicaid Services",
    access: "https://www.cms.gov/marketplace/resources/data",
    owner: "UHERO Health Economics",
    contact: "healtheconomics@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "County-level ACA marketplace enrollment and plan selection statistics, used in health insurance coverage research.",
  },
  {
    title: "Hawaii DBEDT Input-Output Model Tables",
    source: "Hawaii DBEDT",
    access: "Restricted — contact DBEDT Research Division",
    owner: "UHERO Forecast Team",
    contact: "forecast@uhero.hawaii.edu",
    format: "MULTI",
    security: "Sensitive",
    requiresApproval: true,
    approvalDetails:
      "Model coefficients are proprietary to DBEDT — requires written PI-level approval from DBEDT Research Division before use in published work.",
    description:
      "State input-output model tables used for economic impact analyses (e.g. estimating multiplier effects of tourism or construction spending).",
  },
  {
    title: "Hawaii Wildfire Risk Assessment Layer",
    source: "Hawaii Wildfire Management Organization",
    access: "https://www.hawaiiwildfire.org/",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "OTHER",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "GIS wildfire risk zone data used to flag parcels in elevated-risk areas within the housing database, especially relevant post-2023 Maui wildfires.",
  },
  {
    title: "Hawaii DBEDT Statistical Abstract Archive",
    source: "Hawaii DBEDT",
    access: "https://dbedt.hawaii.gov/economic/library/",
    owner: "DBEDT Research Division",
    contact: "research@dbedt.hawaii.gov",
    format: "PDF",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Historical archive of the annual State of Hawaii Data Book / Statistical Abstract publications, used for long-run historical comparisons.",
  },
  {
    title: "Hawaii Public Utilities Commission Rate Case Filings",
    source: "Hawaii Public Utilities Commission",
    access: "https://puc.hawaii.gov/",
    owner: "UHERO Energy Policy",
    contact: "energy@uhero.hawaii.edu",
    format: "PDF",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Electricity and water utility rate case filings and decisions, used to track regulated utility cost pass-through to ratepayers.",
  },
  {
    title: "Hawaii Statewide GIS Parcel Boundaries",
    source: "Hawaii Statewide GIS Program",
    access: "https://geoportal.hawaii.gov/",
    owner: "HHDB Team",
    contact: "hhdb@uhero.hawaii.edu",
    format: "OTHER",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Statewide parcel boundary shapefiles used as the geographic backbone for joining county assessor and GIS-derived measurements in HHDB.",
  },
  {
    title: "Hawaii Farm to School Program Participation",
    source: "Hawaii Department of Education",
    access: "Restricted — contact DOE Farm to School Coordinator",
    owner: "UHERO Agriculture Team",
    contact: "agriculture@uhero.hawaii.edu",
    format: "XLSX",
    security: "Restricted",
    requiresApproval: true,
    approvalDetails:
      "Contact the DOE Farm to School Coordinator for a data sharing agreement before requesting school-level participation figures.",
    description:
      "School-level participation and local food procurement data for Hawaii's Farm to School program, used in local agriculture demand studies.",
  },
  {
    title: "Hawaii Small Boat Harbor Usage Records",
    source: "Hawaii DLNR Division of Boating and Ocean Recreation",
    access: "https://dlnr.hawaii.gov/boating/",
    owner: "UHERO Tourism Team",
    contact: "tourism@uhero.hawaii.edu",
    format: "XLSX",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Vessel registration and small boat harbor slip occupancy records, used in marine recreation and tourism capacity studies.",
  },
  {
    title: "Hawaii Retail Gasoline Price Survey",
    source: "Hawaii Department of Business, Economic Development & Tourism",
    access: "https://energy.hawaii.gov/data-reports/",
    owner: "UHERO Energy Policy",
    contact: "energy@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Weekly average retail gasoline prices by county, used as an input to consumer cost-of-living and transportation cost indices.",
  },
  {
    title: "Hawaii Department of Agriculture Crop Production Reports",
    source: "Hawaii Department of Agriculture",
    access: "https://hdoa.hawaii.gov/stats/",
    owner: "UHERO Agriculture Team",
    contact: "agriculture@uhero.hawaii.edu",
    format: "PDF",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Annual crop production and value reports by commodity, used to track the size and composition of Hawaii's agricultural sector.",
  },
  {
    title: "Honolulu Rail Transit Ridership Data",
    source: "Honolulu Authority for Rapid Transportation",
    access: "https://www.honolulutransit.org/",
    owner: "UHERO Transportation Team",
    contact: "transportation@uhero.hawaii.edu",
    format: "CSV",
    security: "Public",
    requiresApproval: false,
    approvalDetails: null,
    description:
      "Monthly rail ridership counts by station, used to evaluate transit-oriented development impacts on nearby housing markets.",
  },
];

/** Find a single row ID or return null. */
async function findId(
  table: string,
  conditions: Record<string, string | number>,
): Promise<number | null> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    clauses.push(`${col} = ?`);
    params.push(val);
  }
  const rows = await rawQuery<{ id: number }>(
    `SELECT id FROM ${table} WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  );
  return rows[0]?.id ?? null;
}

async function resolveAuthorId(): Promise<number> {
  const admin = await rawQuery<{ id: number }>(
    `SELECT id FROM users WHERE role IN ('admin', 'dev') ORDER BY id ASC LIMIT 1`,
  );
  if (admin[0]) return admin[0].id;

  const anyUser = await rawQuery<{ id: number }>(
    `SELECT id FROM users ORDER BY id ASC LIMIT 1`,
  );
  if (!anyUser[0]) {
    throw new Error(
      "No users found in the database — cannot seed data_registry without an author_id.",
    );
  }
  return anyUser[0].id;
}

async function seed() {
  console.log(`Data Registry Seed ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"}`);
  console.log("─".repeat(60));
  console.log(`Entries defined: ${ENTRIES.length}`);

  const authorId = await resolveAuthorId();
  console.log(`Using author_id: ${authorId}`);

  if (DRY_RUN) {
    for (const entry of ENTRIES) {
      const existingId = await findId("data_registry", { title: entry.title });
      console.log(
        `  ${existingId ? "[skip, exists]" : "[create]"} ${entry.title} (${entry.format}, ${entry.security}${
          entry.requiresApproval ? ", approval required" : ""
        })`,
      );
    }
    console.log("\nRun with --execute to create these records.");
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const entry of ENTRIES) {
    const existingId = await findId("data_registry", { title: entry.title });
    if (existingId) {
      skipped++;
      continue;
    }

    await mysql`
      INSERT INTO data_registry
        (title, source, access, owner, contact, format, security, requires_approval, approval_details, description, author_id, created_at, updated_at)
      VALUES
        (${entry.title}, ${entry.source}, ${entry.access}, ${entry.owner}, ${entry.contact}, ${entry.format}, ${entry.security}, ${entry.requiresApproval ? 1 : 0}, ${entry.approvalDetails}, ${entry.description}, ${authorId}, NOW(), NOW())
    `;
    created++;
  }

  console.log("\n" + "─".repeat(60));
  console.log(
    `Data Registry Seed complete: ${created} created, ${skipped} skipped (already existed).`,
  );
}

seed()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nSEED FAILED:", err);
    process.exit(1);
  });
