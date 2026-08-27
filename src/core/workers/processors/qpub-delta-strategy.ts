/**
 * How each table reconciles a freshly scraped batch against what's already
 * stored — the set-based equivalent of what qpub-load.ts does one row at a time.
 *
 * The row-by-row loaders are the specification: this file restates their
 * matching rules as data so the same semantics can be applied with two or three
 * statements per table instead of tens of round trips per TMK. Every entry here
 * mirrors a specific loader; the citation is the point, not decoration.
 *
 * What makes this tractable is that the four largest tables never needed
 * change-detection in the first place. historical_tax_details (28.6M rows) and
 * historical_tax_payments (11M) are replaced wholesale per parcel, and
 * assessments (6.4M) and historical_tax_summary (6.5M) carry real unique keys.
 * Only small tables — none above ~1M rows — need the expensive path.
 */

export type DeltaStrategy =
  /**
   * A real UNIQUE/PRIMARY key exists, so the database can do the matching:
   * INSERT ... ON DUPLICATE KEY UPDATE. Preserves created_at.
   */
  | { kind: "upsert-key"; key: string[] }
  /**
   * No identity worth preserving — delete this parcel's rows and reinsert.
   * Used where the row-by-row loader already deletes by parent before
   * inserting, so there is no history to lose.
   */
  | { kind: "replace-by-tmk" }
  /**
   * Matched on a natural key that has no index behind it. Rows are updated in
   * place when the key matches and inserted otherwise — no versioning.
   */
  | { kind: "match-natural"; match: string[] }
  /**
   * Slowly-changing dimension. Match the LATEST row per (tmk + identity):
   * if every data column is unchanged, extend it by bumping last_year_observed
   * and scraped_at; if anything differs, insert a new version and leave the old
   * row in place as history.
   *
   * NOTE: the row path (batchUpsertSnapshot in qpub-load.ts) is additionally
   * occurrence-aware — k identical rows in one page pair against the k most
   * recent stored rows. This set-based form still compares 1-vs-latest, so a
   * within-parcel identity duplicate in staging collapses onto one stored row
   * here. Known limitation; the affected tables' identities were widened so
   * true duplicates are rare residuals.
   */
  | { kind: "scd"; identity: string[] };

/**
 * Columns that are never part of a comparison: surrogate keys, DB-managed
 * timestamps, and the two columns the SCD apply writes rather than compares.
 */
export const NON_COMPARED_COLUMNS = new Set([
  "id",
  "tmk",
  "created_at",
  "updated_at",
  "scraped_at",
  "last_year_observed",
]);

export const DELTA_STRATEGY: Record<string, DeltaStrategy> = {
  // ── Real keys — the database matches for us ──────────────────────────
  // qpub-load.ts loadProperties / ON_DUPLICATE in qpub-file-load.ts
  properties: { kind: "upsert-key", key: ["tmk"] },
  // loadCondoProject — condominium_projects PK is tmk
  condominium_projects: { kind: "upsert-key", key: ["tmk"] },
  // UNIQUE KEY unique_unit (tmk)
  condominium_units: { kind: "upsert-key", key: ["tmk"] },
  // loadAssessments:437 — UNIQUE KEY unique_assessment (tmk, tax_year)
  assessments: { kind: "upsert-key", key: ["tmk", "tax_year"] },
  // loadHistoricalTax:760 — UNIQUE KEY unique_year (tmk, year)
  historical_tax_summary: { kind: "upsert-key", key: ["tmk", "year"] },
  // One bill per period per parcel, once the rollup line is filtered out
  // (realTaxBillRows). Measured 1.051 versions per (tmk, tax_period) before
  // the filter — all of it interest/penalty accrual restating the same bill,
  // which is an update to current state rather than history worth keeping.
  current_tax_bills: { kind: "upsert-key", key: ["tmk", "tax_period"] },
  // One dedication row per parcel per tax year, backed by
  // UNIQUE(tmk, tax_year). The row path matches on tax_year via
  // GENERIC_MATCH_UPDATE in qpub-load.ts and updates the row in place —
  // equivalent semantics to this upsert-key, and it no longer trips the
  // unique key on a re-load the way the old plain-INSERT fallback did.
  dedications: { kind: "upsert-key", key: ["tmk", "tax_year"] },
  // One homestead claim per claimant per parcel per tax year (Maui only;
  // co-owners each file their own claim), backed by
  // UNIQUE unique_home_exemption (tmk, tax_year, claimant_name). The row path
  // matches the same key via GENERIC_MATCH_UPDATE in qpub-load.ts.
  home_exemptions: {
    kind: "upsert-key",
    key: ["tmk", "tax_year", "claimant_name"],
  },

  // ── Replace per parcel ───────────────────────────────────────────────
  // loadHistoricalTax:817-825 deletes these by historical_tax_summary_id
  // before reinserting. Scoping by tmk is the same set, and lets the delete
  // run without first resolving summary ids.
  historical_tax_details: { kind: "replace-by-tmk" },
  historical_tax_payments: { kind: "replace-by-tmk" },
  historical_tax_credits: { kind: "replace-by-tmk" },
  // Child of commercial_improvements via commercial_improvement_id. Its parent
  // ids are reassigned on every load, so the details must follow the parent
  // wholesale rather than being matched independently.
  commercial_improvement_details: { kind: "replace-by-tmk" },

  // ── Natural-key matches (no supporting index) ────────────────────────
  // loadOwners — the within-parcel identity is (name, type, address): qPublic
  // renders one estate several times with different representative C-O/ATTN
  // addresses and each is its own row, so a changed address is a new row,
  // never an update.
  owners: {
    kind: "match-natural",
    match: ["owner_name", "owner_type", "owner_address"],
  },
  // loadSales — the match carries the document identifiers, not just
  // (sale_date, instrument): distinct documents record on the same date with
  // consecutive doc numbers, and the narrower key silently dropped the second.
  sales: {
    kind: "match-natural",
    match: [
      "sale_date",
      "instrument",
      "land_court_document_number",
      "book_page",
      "sale_amount",
    ],
  },
  // loadPermits
  permits: { kind: "match-natural", match: ["permit_number"] },
  // loadCommercialImprovements
  commercial_improvements: {
    kind: "match-natural",
    match: ["building_number", "building_card"],
  },
  // Also lacks last_year_observed, so it is not a snapshot table either. The
  // row path (GENERIC_MATCH_UPDATE in qpub-load.ts) matches on this key and
  // updates the current row IN PLACE — status, hearing date, date_settled and
  // the taxpayer-opinion fields legitimately change across scrapes, and we
  // keep one current row per appeal, not history. Legitimate in-page
  // duplicates on the key (two same-year appeals with different hearing
  // dates, mostly Oahu) are kept distinct there by occurrence index; this
  // set-based match is not occurrence-aware, so a duplicated key in one batch
  // collapses onto the same stored row — acceptable for the delta path, which
  // stages at most one page version per parcel.
  appeals: { kind: "match-natural", match: ["year", "appeal_type_value"] },

  // ── Change-detection (upsertSnapshot) ────────────────────────────────
  // An empty identity means one current version per parcel — every data column
  // participates in the comparison.
  parcels: { kind: "scd", identity: [] }, // loadParcels
  // loadLandClassifications — size is identity, not data: a parcel routinely
  // carries several rows of one classification differing only in
  // sqft/acreage, and on classification alone they version against each
  // other. Only agricultural_use_indicator remains as compared data.
  land_classifications: {
    kind: "scd",
    identity: ["land_classification", "square_footage", "acreage"],
  },
  residential_improvements: { kind: "scd", identity: ["building_number"] },
  // GENERIC_IDENTITY_FIELDS, qpub-load.ts
  accessory_improvements: {
    kind: "scd",
    identity: ["building_number", "description", "year_built", "area"],
  },
  residential_additions: { kind: "scd", identity: ["card", "line"] },
  agricultural_assessments: { kind: "scd", identity: [] },
};

/**
 * FK-safe order. properties first (every table references it), parents before
 * their children.
 */
export const DELTA_ORDER: string[] = [
  "properties",
  "condominium_projects",
  "condominium_units",
  "parcels",
  "owners",
  "assessments",
  "land_classifications",
  "residential_improvements",
  "commercial_improvements",
  "commercial_improvement_details",
  "sales",
  "permits",
  "current_tax_bills",
  "historical_tax_summary",
  "historical_tax_details",
  "historical_tax_payments",
  "historical_tax_credits",
  "accessory_improvements",
  "residential_additions",
  "agricultural_assessments",
  "appeals",
  "dedications",
  "home_exemptions",
];
