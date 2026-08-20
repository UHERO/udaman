/**
 * QPub table configuration — dedup strategies and natural keys per table.
 *
 * Categories:
 *  - upsert:           ON DUPLICATE KEY UPDATE or check+upsert
 *  - snapshot:         Delete same-period → insert
 *  - year-partitioned: Delete by covered years → insert
 *  - accumulative:     Check natural key, skip if exists
 */

export type DedupeCategory =
  | "upsert"
  | "snapshot"
  | "year-partitioned"
  | "accumulative";

export interface TableConfig {
  category: DedupeCategory;
  /** Columns that form the natural key for dedup */
  naturalKey: string[];
}

export const TABLE_CONFIGS: Record<string, TableConfig> = {
  // ─── upsert ─────────────────────────────────────────────────
  properties: {
    category: "upsert",
    naturalKey: ["tmk"],
  },
  condominium_projects: {
    category: "upsert",
    naturalKey: ["tmk"],
  },
  condominium_units: {
    category: "upsert",
    naturalKey: ["tmk"],
  },

  // ─── snapshot (period-based delete → insert) ────────────────
  parcels: {
    category: "snapshot",
    naturalKey: ["tmk"],
  },
  owners: {
    category: "snapshot",
    // Address is identity, not data: qPublic renders one estate several times
    // with different representative addresses and each is its own row.
    naturalKey: ["tmk", "owner_name", "owner_type", "owner_address"],
  },
  land_classifications: {
    category: "snapshot",
    // Size is identity: several rows of one classification per parcel,
    // differing only in sqft/acreage.
    naturalKey: ["tmk", "land_classification", "square_footage", "acreage"],
  },
  residential_improvements: {
    category: "snapshot",
    naturalKey: ["tmk", "building_number"],
  },
  residential_additions: {
    category: "snapshot",
    naturalKey: ["tmk", "card", "line"],
  },
  commercial_improvements: {
    category: "snapshot",
    naturalKey: ["tmk", "building_number", "building_card"],
  },
  current_tax_bills: {
    category: "snapshot",
    naturalKey: ["tmk", "tax_period", "description"],
  },
  accessory_improvements: {
    category: "snapshot",
    naturalKey: ["tmk", "description", "year_built"],
  },
  agricultural_assessments: {
    category: "snapshot",
    naturalKey: ["tmk", "agricultural_type"],
  },
  appeals: {
    category: "snapshot",
    // The row loader (GENERIC_MATCH_UPDATE in qpub-load.ts) matches this key
    // NULL-safe and updates the current row in place — one row per appeal, no
    // history; in-page duplicates on the key stay distinct by occurrence.
    naturalKey: ["tmk", "year", "appeal_type_value"],
  },
  dedications: {
    category: "snapshot",
    naturalKey: ["tmk", "tax_year"],
  },
  home_exemptions: {
    category: "snapshot",
    // Mirrors UNIQUE unique_home_exemption — co-owners each file a claim, so
    // claimant_name is part of the identity.
    naturalKey: ["tmk", "tax_year", "claimant_name"],
  },

  // ─── year-partitioned (delete by covered years → insert) ────
  assessments: {
    category: "year-partitioned",
    naturalKey: ["tmk", "tax_year"],
  },
  historical_tax_summary: {
    category: "year-partitioned",
    naturalKey: ["tmk", "year"],
  },

  // ─── accumulative (check natural key, skip if exists) ───────
  sales: {
    category: "accumulative",
    // Carries the document identifiers: distinct documents record on the same
    // date with consecutive doc numbers, so (tmk, sale_date, instrument)
    // alone would drop the second one.
    naturalKey: [
      "tmk",
      "sale_date",
      "instrument",
      "land_court_document_number",
      "book_page",
      "sale_amount",
    ],
  },
  permits: {
    category: "accumulative",
    naturalKey: ["tmk", "permit_number"],
  },
};
