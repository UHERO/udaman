import { MLS_COMPLETENESS_COLUMNS } from "@/core/crawlers/mls/columns";
import { rawQuery } from "@/lib/mysql/hhdb";

import { isMissingTableError } from "../utils/hhdb-missing-table";

/**
 * Queries behind /hhdb/tables/mls-listings/exploration. All keyed on
 * list_date, the one date every source provides; rows with no list_date are
 * left out (and counted, so the page can say how many).
 */

/** First month shown. Earlier list dates exist but are a sparse tail. */
export const MLS_EXPLORATION_FROM = "2022-01-01";

export interface MlsMonthlyCountRow {
  month: string; // 'YYYY-MM'
  open: number;
  sold: number;
  off_market: number;
  total: number;
}

export interface MlsMonthlyMedianRow {
  month: string;
  property_type: string;
  median_list_price: number;
  listings: number;
}

export interface MlsPropertyTypeRow {
  property_type: string;
  count: number;
}

export interface MlsIslandRow {
  island: string;
  open: number;
  sold: number;
  off_market: number;
  total: number;
}

export interface MlsCompletenessRow {
  column: (typeof MLS_COMPLETENESS_COLUMNS)[number];
  source_site: string;
  listings: number;
  filled: number;
  /** filled / listings, 0..1 */
  rate: number;
}

export interface MlsCoverageRow {
  total: number;
  with_list_date: number;
  earliest: string | null;
  latest: string | null;
}

const T = "`mls_listings`";
const OPEN = `'active', 'active_under_contract', 'pending'`;

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

const n = (v: unknown) => Number(v ?? 0);

export default class HhdbMlsExplorationCollection {
  static async getMonthlyCounts(): Promise<MlsMonthlyCountRow[]> {
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT DATE_FORMAT(\`list_date\`, '%Y-%m') AS month,
                SUM(\`status\` IN (${OPEN})) AS open,
                SUM(\`status\` = 'sold') AS sold,
                SUM(\`status\` = 'off_market') AS off_market,
                COUNT(*) AS total
         FROM ${T}
         WHERE \`list_date\` >= ?
         GROUP BY month ORDER BY month`,
        [MLS_EXPLORATION_FROM],
      ),
    );
    return rows.map((r) => ({
      month: String(r.month),
      open: n(r.open),
      sold: n(r.sold),
      off_market: n(r.off_market),
      total: n(r.total),
    }));
  }

  /**
   * Median asking price per month for the two big property types. A single
   * all-types median would swing with the condo/house mix, not with prices.
   */
  static async getMonthlyMedianListPrice(): Promise<MlsMonthlyMedianRow[]> {
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT month, property_type, median_list_price, listings
         FROM (
           SELECT DATE_FORMAT(\`list_date\`, '%Y-%m') AS month,
                  \`property_type\`,
                  MEDIAN(\`list_price\`) OVER (
                    PARTITION BY DATE_FORMAT(\`list_date\`, '%Y-%m'), \`property_type\`
                  ) AS median_list_price,
                  COUNT(*) OVER (
                    PARTITION BY DATE_FORMAT(\`list_date\`, '%Y-%m'), \`property_type\`
                  ) AS listings,
                  ROW_NUMBER() OVER (
                    PARTITION BY DATE_FORMAT(\`list_date\`, '%Y-%m'), \`property_type\`
                    ORDER BY \`id\`
                  ) AS rn
           FROM ${T}
           WHERE \`list_date\` >= ? AND \`list_price\` IS NOT NULL
             AND \`property_type\` IN ('Single Family', 'Condo/Townhouse')
         ) m
         WHERE rn = 1 AND listings >= 5
         ORDER BY month, property_type`,
        [MLS_EXPLORATION_FROM],
      ),
    );
    return rows.map((r) => ({
      month: String(r.month),
      property_type: String(r.property_type),
      median_list_price: n(r.median_list_price),
      listings: n(r.listings),
    }));
  }

  static async getPropertyTypeCounts(): Promise<MlsPropertyTypeRow[]> {
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT COALESCE(\`property_type\`, '(unknown)') AS property_type, COUNT(*) AS count
         FROM ${T} GROUP BY property_type ORDER BY count DESC`,
      ),
    );
    return rows.map((r) => ({
      property_type: String(r.property_type),
      count: n(r.count),
    }));
  }

  static async getIslandCounts(): Promise<MlsIslandRow[]> {
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT COALESCE(\`island\`, '(unknown)') AS island,
                SUM(\`status\` IN (${OPEN})) AS open,
                SUM(\`status\` = 'sold') AS sold,
                SUM(\`status\` = 'off_market') AS off_market,
                COUNT(*) AS total
         FROM ${T} GROUP BY island ORDER BY total DESC`,
      ),
    );
    return rows.map((r) => ({
      island: String(r.island),
      open: n(r.open),
      sold: n(r.sold),
      off_market: n(r.off_market),
      total: n(r.total),
    }));
  }

  /** Non-NULL share of each MLS_COMPLETENESS_COLUMNS column, per source site. */
  static async getCompleteness(): Promise<MlsCompletenessRow[]> {
    const sums = MLS_COMPLETENESS_COLUMNS.map(
      (c) => `SUM(\`${c}\` IS NOT NULL) AS \`${c}\``,
    ).join(", ");
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT \`source_site\`, COUNT(*) AS listings, ${sums}
         FROM ${T} GROUP BY \`source_site\` ORDER BY \`source_site\``,
      ),
    );
    const out: MlsCompletenessRow[] = [];
    for (const r of rows) {
      const listings = n(r.listings);
      for (const column of MLS_COMPLETENESS_COLUMNS) {
        const filled = n(r[column]);
        out.push({
          column,
          source_site: String(r.source_site),
          listings,
          filled,
          rate: listings === 0 ? 0 : filled / listings,
        });
      }
    }
    return out;
  }

  /** How much of the table the list_date-based charts can see. */
  static async getCoverage(): Promise<MlsCoverageRow> {
    const rows = await safe(() =>
      rawQuery<Record<string, unknown>>(
        `SELECT COUNT(*) AS total,
                SUM(\`list_date\` IS NOT NULL) AS with_list_date,
                DATE_FORMAT(MIN(\`list_date\`), '%Y-%m-%d') AS earliest,
                DATE_FORMAT(MAX(\`list_date\`), '%Y-%m-%d') AS latest
         FROM ${T}`,
      ),
    );
    const r = rows[0] ?? {};
    return {
      total: n(r.total),
      with_list_date: n(r.with_list_date),
      earliest: r.earliest == null ? null : String(r.earliest),
      latest: r.latest == null ? null : String(r.latest),
    };
  }
}
