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
    naturalKey: ["tmk", "owner_name", "sequence_order"],
  },
  land_classifications: {
    category: "snapshot",
    naturalKey: ["tmk", "land_classification"],
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
  yard_improvements: {
    category: "snapshot",
    naturalKey: ["tmk", "description", "year_built"],
  },
  agricultural_assessments: {
    category: "snapshot",
    naturalKey: ["tmk", "agricultural_type"],
  },
  accessory_structures: {
    category: "snapshot",
    naturalKey: ["tmk", "building_number", "description"],
  },
  appeals: {
    category: "snapshot",
    naturalKey: ["tmk", "year", "appeal_type_value"],
  },
  dedications: {
    category: "snapshot",
    naturalKey: ["tmk", "tax_year"],
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
    naturalKey: ["tmk", "sale_date", "instrument"],
  },
  permits: {
    category: "accumulative",
    naturalKey: ["tmk", "permit_number"],
  },
};
