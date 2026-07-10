import { rawQuery } from "@/lib/mysql/hhdb";

export interface MedianAssessedRow {
  tax_year: number;
  property_class: string;
  median_value: number;
}

export interface MedianSalePriceRow {
  year: number;
  island_code: string;
  median_price: number;
}

export interface PropertyCountRow {
  property_class: string;
  count: number;
}

export interface TotalAssessedRow {
  tax_year: number;
  island_code: string;
  total_value: number;
}

export interface PermitActivityRow {
  year: number;
  permit_count: number;
  total_value: number;
}

export interface CondoAreaRow {
  year_built: number;
  median_living_area: number;
}

// --- Out-of-State Ownership ---

export interface OutOfStateRatioRow {
  year: number;
  quarter: number;
  period: string;
  total_transactions: number;
  out_of_state_count: number;
  ratio: number;
}

export interface OutOfStateByStateRow {
  mailing_state: string;
  transaction_count: number;
  pct: number;
}

export interface OutOfStateByZipRow {
  mailing_zip_code: string;
  mailing_state: string;
  mailing_city: string;
  transaction_count: number;
  avg_conveyance: number;
}

// --- Ownership Concentration ---

export interface OwnershipDistributionRow {
  bucket: string;
  owner_count: number;
  property_count: number;
  pct_of_properties: number;
}

export interface OwnershipLorenzPoint {
  cumulative_owner_pct: number;
  cumulative_property_pct: number;
}

export interface OwnershipLorenzResult {
  points: OwnershipLorenzPoint[];
  gini: number;
}

export interface TopOwnerRow {
  owner_name: string;
  property_count: number;
  island_codes: string;
}

export interface ConcentrationByIslandRow {
  island_code: string;
  island_name: string;
  gini: number;
  top10_pct: number;
  single_owner_pct: number;
}

/**
 * Maps canonical owner names to known aliases/variations.
 * Aliases are matched as prefixes (startsWith) to catch truncated names.
 */
const OWNER_ALIASES: [string, string[]][] = [
  [
    "KAMEHAMEHA SCHOOLS",
    [
      "B P BISHOP ESTATE",
      "BP BISHOP ESTATE",
      "BERNICE PAUAHI BISHOP",
      "KAMEHAMEHA SCHOOL",
    ],
  ],
  [
    "DEPT OF HAWAIIAN HOME LANDS",
    [
      "HAWAIIAN HOME LANDS",
      "DEPARTMENT OF HAWAIIAN HOME",
      "DEPT OF HAWAIIAN HOME",
      "HAWAIIAN HOMELANDS",
    ],
  ],
  ["STATE OF HAWAII", ["STATE OF HAWAII"]],
  [
    "CITY & COUNTY OF HONOLULU",
    [
      "CITY & COUNTY OF HONOLULU",
      "CITY AND COUNTY OF HONOLULU",
      "CITY&COUNTY OF HONOLULU",
    ],
  ],
  ["COUNTY OF MAUI", ["COUNTY OF MAUI"]],
  ["COUNTY OF HAWAII", ["COUNTY OF HAWAII"]],
  ["COUNTY OF KAUAI", ["COUNTY OF KAUAI"]],
  [
    "UNITED STATES OF AMERICA",
    [
      "UNITED STATES OF AMERICA",
      "UNITED STATES GOVERNMENT",
      "US GOVERNMENT",
      "U S OF AMERICA",
    ],
  ],
];

export default class HhdbDashboardCollection {
  /** Average assessed value by property class over time */
  static async getMedianAssessedByClass(): Promise<MedianAssessedRow[]> {
    const rows = await rawQuery<MedianAssessedRow>(`
      SELECT
        tax_year,
        property_class,
        AVG(total_property_assessed_value) as median_value
      FROM assessments
      WHERE total_property_assessed_value IS NOT NULL AND total_property_assessed_value > 0
        AND property_class IS NOT NULL AND property_class != ''
        AND tax_year BETWEEN 2015 AND 2025
      GROUP BY tax_year, property_class
      HAVING COUNT(*) >= 10
      ORDER BY tax_year, property_class
    `);
    return rows.map((r) => ({
      tax_year: Number(r.tax_year),
      property_class: String(r.property_class),
      median_value: Number(r.median_value),
    }));
  }

  /** Average sale price by island over time */
  static async getMedianSalePriceByIsland(): Promise<MedianSalePriceRow[]> {
    const rows = await rawQuery<MedianSalePriceRow>(`
      SELECT
        YEAR(s.sale_date) as year,
        p.island_code,
        AVG(s.sale_amount) as median_price
      FROM sales s
      JOIN properties p ON s.tmk = p.tmk
      WHERE s.sale_amount IS NOT NULL AND s.sale_amount > 0
        AND s.sale_date IS NOT NULL
        AND p.island_code IS NOT NULL
      GROUP BY YEAR(s.sale_date), p.island_code
      HAVING COUNT(*) >= 5
      ORDER BY year, p.island_code
    `);
    return rows.map((r) => ({
      year: Number(r.year),
      island_code: String(r.island_code),
      median_price: Number(r.median_price),
    }));
  }

  /** Property count by class (top 15) */
  static async getPropertyCountByClass(): Promise<PropertyCountRow[]> {
    const rows = await rawQuery<PropertyCountRow>(`
      SELECT property_class, COUNT(*) as count
      FROM properties
      WHERE property_class IS NOT NULL AND property_class != ''
      GROUP BY property_class
      ORDER BY count DESC
      LIMIT 15
    `);
    return rows.map((r) => ({
      property_class: String(r.property_class),
      count: Number(r.count),
    }));
  }

  /** Total assessed value by island over time */
  static async getTotalAssessedByIsland(): Promise<TotalAssessedRow[]> {
    const rows = await rawQuery<TotalAssessedRow>(`
      SELECT
        a.tax_year,
        p.island_code,
        SUM(a.total_property_assessed_value) as total_value
      FROM assessments a
      JOIN properties p ON a.tmk = p.tmk
      WHERE a.total_property_assessed_value IS NOT NULL
        AND p.island_code IS NOT NULL
        AND a.tax_year BETWEEN 2015 AND 2025
      GROUP BY a.tax_year, p.island_code
      ORDER BY a.tax_year, p.island_code
    `);
    return rows.map((r) => ({
      tax_year: Number(r.tax_year),
      island_code: String(r.island_code),
      total_value: Number(r.total_value),
    }));
  }

  /** Permit activity by year — count and total estimated value */
  static async getPermitActivityByYear(): Promise<PermitActivityRow[]> {
    const rows = await rawQuery<PermitActivityRow>(`
      SELECT
        YEAR(permit_date) as year,
        COUNT(*) as permit_count,
        SUM(permit_amount) as total_value
      FROM permits
      WHERE permit_date IS NOT NULL
      GROUP BY YEAR(permit_date)
      ORDER BY year
    `);
    return rows.map((r) => ({
      year: Number(r.year),
      permit_count: Number(r.permit_count),
      total_value: Number(r.total_value),
    }));
  }

  /** Average condo living area by year built */
  static async getCondoAreaByYearBuilt(): Promise<CondoAreaRow[]> {
    const rows = await rawQuery<CondoAreaRow>(`
      SELECT
        ri.year_built,
        AVG(CAST(ri.living_area AS UNSIGNED)) as median_living_area
      FROM residential_improvements ri
      WHERE ri.year_built IS NOT NULL AND ri.year_built > 0
        AND ri.living_area IS NOT NULL AND ri.living_area != ''
        AND ri.living_area REGEXP '^[0-9]+$'
      GROUP BY ri.year_built
      HAVING COUNT(*) >= 3
      ORDER BY ri.year_built
    `);
    return rows.map((r) => ({
      year_built: Number(r.year_built),
      median_living_area: Number(r.median_living_area),
    }));
  }

  // ---------------------------------------------------------------------------
  // Out-of-State Ownership
  // ---------------------------------------------------------------------------

  /** Out-of-state buyer ratio by quarter */
  static async getOutOfStateRatioByQuarter(
    islandCode?: string,
  ): Promise<OutOfStateRatioRow[]> {
    const islandJoin = islandCode ? "JOIN properties p ON t.tmk = p.tmk" : "";
    const islandWhere = islandCode ? "AND p.island_code = ?" : "";
    const params: (string | number)[] = [];
    if (islandCode) params.push(islandCode);

    const rows = await rawQuery<{
      year: number;
      quarter: number;
      total_transactions: number;
      out_of_state_count: number;
    }>(
      `SELECT
        YEAR(t.recDate) as year,
        QUARTER(t.recDate) as quarter,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN t.mailingState != 'HI' THEN 1 ELSE 0 END) as out_of_state_count
      FROM tg_transactions t
      ${islandJoin}
      WHERE t.conveyanceAmount > 0
        AND t.mailingState IS NOT NULL
        AND t.mailingState != ''
        AND t.recDate IS NOT NULL
        ${islandWhere}
      GROUP BY YEAR(t.recDate), QUARTER(t.recDate)
      HAVING COUNT(*) >= 5
      ORDER BY year, quarter`,
      params,
    );

    return rows.map((r) => ({
      year: Number(r.year),
      quarter: Number(r.quarter),
      period: `${r.year}-Q${r.quarter}`,
      total_transactions: Number(r.total_transactions),
      out_of_state_count: Number(r.out_of_state_count),
      ratio: Number(r.out_of_state_count) / Number(r.total_transactions),
    }));
  }

  /** Top 20 source states for out-of-state buyers */
  static async getOutOfStateTopStates(
    startYear?: number,
    endYear?: number,
  ): Promise<OutOfStateByStateRow[]> {
    const conditions: string[] = [
      "mailingState != 'HI'",
      "mailingState IS NOT NULL",
      "mailingState != ''",
      "conveyanceAmount > 0",
    ];
    const params: (string | number)[] = [];
    if (startYear) {
      conditions.push("YEAR(recDate) >= ?");
      params.push(startYear);
    }
    if (endYear) {
      conditions.push("YEAR(recDate) <= ?");
      params.push(endYear);
    }

    const rows = await rawQuery<{
      mailingState: string;
      transaction_count: number;
    }>(
      `SELECT
        mailingState,
        COUNT(*) as transaction_count
      FROM tg_transactions
      WHERE ${conditions.join(" AND ")}
      GROUP BY mailingState
      ORDER BY transaction_count DESC
      LIMIT 20`,
      params,
    );

    const total = rows.reduce((sum, r) => sum + Number(r.transaction_count), 0);
    return rows.map((r) => ({
      mailing_state: String(r.mailingState),
      transaction_count: Number(r.transaction_count),
      pct: total > 0 ? Number(r.transaction_count) / total : 0,
    }));
  }

  /** Top 30 source zip codes, optionally filtered by state */
  static async getOutOfStateTopZips(
    state?: string,
    startYear?: number,
    endYear?: number,
  ): Promise<OutOfStateByZipRow[]> {
    const conditions: string[] = [
      "mailingState != 'HI'",
      "mailingState IS NOT NULL",
      "mailingState != ''",
      "mailingZipCode IS NOT NULL",
      "mailingZipCode != ''",
      "conveyanceAmount > 0",
    ];
    const params: (string | number)[] = [];
    if (state) {
      conditions.push("mailingState = ?");
      params.push(state);
    }
    if (startYear) {
      conditions.push("YEAR(recDate) >= ?");
      params.push(startYear);
    }
    if (endYear) {
      conditions.push("YEAR(recDate) <= ?");
      params.push(endYear);
    }

    const rows = await rawQuery<{
      mailingZipCode: string;
      mailingState: string;
      mailingCity: string;
      transaction_count: number;
      avg_conveyance: number;
    }>(
      `SELECT
        mailingZipCode,
        mailingState,
        MAX(mailingCity) as mailingCity,
        COUNT(*) as transaction_count,
        AVG(conveyanceAmount) as avg_conveyance
      FROM tg_transactions
      WHERE ${conditions.join(" AND ")}
      GROUP BY mailingZipCode, mailingState
      ORDER BY transaction_count DESC
      LIMIT 30`,
      params,
    );

    return rows.map((r) => ({
      mailing_zip_code: String(r.mailingZipCode),
      mailing_state: String(r.mailingState),
      mailing_city: String(r.mailingCity ?? ""),
      transaction_count: Number(r.transaction_count),
      avg_conveyance: Number(r.avg_conveyance),
    }));
  }

  // ---------------------------------------------------------------------------
  // Ownership Concentration
  // ---------------------------------------------------------------------------

  /**
   * Normalize known owner name variations to a canonical form.
   * Many large institutional owners appear under slightly different names
   * (e.g. truncated, with/without "TTEES", legacy vs current name).
   */
  private static normalizeOwnerName(name: string): string {
    const upper = name.trim().toUpperCase();
    for (const [canonical, aliases] of OWNER_ALIASES) {
      if (
        upper === canonical ||
        aliases.some((a) => upper.startsWith(a) || upper === a)
      ) {
        return canonical;
      }
    }
    return name.trim();
  }

  /**
   * Re-aggregate owner rows after name normalization.
   * Merges property counts for owners that map to the same canonical name.
   */
  private static mergeOwnerRows(
    rows: { owner_name: string; property_count: number }[],
  ): { owner_name: string; property_count: number }[] {
    const merged = new Map<string, number>();
    for (const r of rows) {
      const canonical = this.normalizeOwnerName(String(r.owner_name));
      merged.set(
        canonical,
        (merged.get(canonical) ?? 0) + Number(r.property_count),
      );
    }
    return [...merged.entries()].map(([owner_name, property_count]) => ({
      owner_name,
      property_count,
    }));
  }

  /** Ownership distribution by bucket */
  static async getOwnershipDistribution(
    islandCode?: string,
  ): Promise<OwnershipDistributionRow[]> {
    const islandJoin = islandCode ? "JOIN properties p ON o.tmk = p.tmk" : "";
    const islandWhere = islandCode ? "AND p.island_code = ?" : "";
    const params: (string | number)[] = [];
    if (islandCode) params.push(islandCode);

    const rawRows = await rawQuery<{
      owner_name: string;
      property_count: number;
    }>(
      `SELECT
        o.owner_name,
        COUNT(DISTINCT o.tmk) as property_count
      FROM owners o
      ${islandJoin}
      WHERE o.owner_name IS NOT NULL AND o.owner_name != ''
        ${islandWhere}
      GROUP BY o.owner_name`,
      params,
    );
    const rows = this.mergeOwnerRows(rawRows);

    const buckets: {
      label: string;
      min: number;
      max: number;
    }[] = [
      { label: "1", min: 1, max: 1 },
      { label: "2-3", min: 2, max: 3 },
      { label: "4-9", min: 4, max: 9 },
      { label: "10-24", min: 10, max: 24 },
      { label: "25-99", min: 25, max: 99 },
      { label: "100+", min: 100, max: Infinity },
    ];

    const totalProperties = rows.reduce(
      (sum, r) => sum + Number(r.property_count),
      0,
    );

    return buckets.map((b) => {
      const matching = rows.filter((r) => {
        const count = Number(r.property_count);
        return count >= b.min && count <= b.max;
      });
      const ownerCount = matching.length;
      const propertyCount = matching.reduce(
        (sum, r) => sum + Number(r.property_count),
        0,
      );
      return {
        bucket: b.label,
        owner_count: ownerCount,
        property_count: propertyCount,
        pct_of_properties:
          totalProperties > 0 ? propertyCount / totalProperties : 0,
      };
    });
  }

  /** Lorenz curve + Gini coefficient for ownership concentration */
  static async getOwnershipLorenzCurve(
    islandCode?: string,
  ): Promise<OwnershipLorenzResult> {
    const islandJoin = islandCode ? "JOIN properties p ON o.tmk = p.tmk" : "";
    const islandWhere = islandCode ? "AND p.island_code = ?" : "";
    const params: (string | number)[] = [];
    if (islandCode) params.push(islandCode);

    const rawRows = await rawQuery<{
      owner_name: string;
      property_count: number;
    }>(
      `SELECT
        o.owner_name,
        COUNT(DISTINCT o.tmk) as property_count
      FROM owners o
      ${islandJoin}
      WHERE o.owner_name IS NOT NULL AND o.owner_name != ''
        ${islandWhere}
      GROUP BY o.owner_name`,
      params,
    );
    const rows = this.mergeOwnerRows(rawRows);
    rows.sort((a, b) => a.property_count - b.property_count);

    const counts = rows.map((r) => r.property_count);
    const totalOwners = counts.length;
    const totalProperties = counts.reduce((a, b) => a + b, 0);

    if (totalOwners === 0) {
      return { points: [], gini: 0 };
    }

    // Generate ~100 points for a smooth curve
    const numPoints = Math.min(100, totalOwners);
    const points: OwnershipLorenzPoint[] = [
      { cumulative_owner_pct: 0, cumulative_property_pct: 0 },
    ];

    let cumulativeProperties = 0;
    let giniArea = 0;

    for (let i = 0; i < totalOwners; i++) {
      cumulativeProperties += counts[i];
      const ownerPct = (i + 1) / totalOwners;
      const propertyPct = cumulativeProperties / totalProperties;

      // Gini calculation: area under Lorenz curve
      giniArea += propertyPct / totalOwners;

      // Sample points for the curve
      if (
        i === totalOwners - 1 ||
        Math.floor((i * numPoints) / totalOwners) !==
          Math.floor(((i + 1) * numPoints) / totalOwners)
      ) {
        points.push({
          cumulative_owner_pct: Math.round(ownerPct * 10000) / 10000,
          cumulative_property_pct: Math.round(propertyPct * 10000) / 10000,
        });
      }
    }

    // Gini = 1 - 2 * area under Lorenz curve
    const gini = Math.round((1 - 2 * giniArea) * 10000) / 10000;

    return { points, gini };
  }

  /** Top multi-property owners */
  static async getTopOwners(
    limit = 25,
    islandCode?: string,
  ): Promise<TopOwnerRow[]> {
    const islandJoin = islandCode ? "JOIN properties p ON o.tmk = p.tmk" : "";
    const islandWhere = islandCode ? "AND p.island_code = ?" : "";
    const params: (string | number)[] = [];
    if (islandCode) params.push(islandCode);

    // Fetch without LIMIT so we can merge aliases before cutting
    const rawRows = await rawQuery<{
      owner_name: string;
      property_count: number;
      island_codes: string;
    }>(
      `SELECT
        o.owner_name,
        COUNT(DISTINCT o.tmk) as property_count,
        GROUP_CONCAT(DISTINCT LEFT(o.tmk, 1) ORDER BY LEFT(o.tmk, 1)) as island_codes
      FROM owners o
      ${islandJoin}
      WHERE o.owner_name IS NOT NULL AND o.owner_name != ''
        ${islandWhere}
      GROUP BY o.owner_name
      HAVING COUNT(DISTINCT o.tmk) > 1
      ORDER BY property_count DESC`,
      params,
    );

    // Merge aliases, combining property counts and island code sets
    const merged = new Map<string, { count: number; islands: Set<string> }>();
    for (const r of rawRows) {
      const canonical = this.normalizeOwnerName(String(r.owner_name));
      const existing = merged.get(canonical) ?? {
        count: 0,
        islands: new Set(),
      };
      existing.count += Number(r.property_count);
      for (const code of String(r.island_codes ?? "").split(",")) {
        if (code) existing.islands.add(code);
      }
      merged.set(canonical, existing);
    }

    return [...merged.entries()]
      .map(([name, { count, islands }]) => ({
        owner_name: name,
        property_count: count,
        island_codes: [...islands].sort().join(","),
      }))
      .sort((a, b) => b.property_count - a.property_count)
      .slice(0, limit);
  }

  /** Concentration metrics by island */
  static async getConcentrationByIsland(): Promise<ConcentrationByIslandRow[]> {
    const islandNames: Record<string, string> = {
      "1": "Hawaii",
      "2": "Maui",
      "3": "Oahu",
      "4": "Kauai",
      "5": "Molokai",
      "6": "Lanai",
    };

    const results: ConcentrationByIslandRow[] = [];

    for (const [code, name] of Object.entries(islandNames)) {
      const rawRows = await rawQuery<{
        owner_name: string;
        property_count: number;
      }>(
        `SELECT
          o.owner_name,
          COUNT(DISTINCT o.tmk) as property_count
        FROM owners o
        JOIN properties p ON o.tmk = p.tmk
        WHERE o.owner_name IS NOT NULL AND o.owner_name != ''
          AND p.island_code = ?
        GROUP BY o.owner_name`,
        [code],
      );

      if (rawRows.length === 0) continue;

      const rows = this.mergeOwnerRows(rawRows);
      rows.sort((a, b) => a.property_count - b.property_count);
      const counts = rows.map((r) => r.property_count);
      const totalOwners = counts.length;
      const totalProperties = counts.reduce((a, b) => a + b, 0);

      // Gini
      let giniArea = 0;
      let cumProperties = 0;
      for (const c of counts) {
        cumProperties += c;
        giniArea += cumProperties / totalProperties / totalOwners;
      }
      const gini = Math.round((1 - 2 * giniArea) * 10000) / 10000;

      // Top 10% of owners' share
      const top10Count = Math.max(1, Math.floor(totalOwners * 0.1));
      const top10Properties = counts
        .slice(-top10Count)
        .reduce((a, b) => a + b, 0);
      const top10Pct =
        Math.round((top10Properties / totalProperties) * 10000) / 10000;

      // Single-owner %
      const singleOwners = counts.filter((c) => c === 1).length;
      const singleOwnerPct =
        Math.round((singleOwners / totalOwners) * 10000) / 10000;

      results.push({
        island_code: code,
        island_name: name,
        gini,
        top10_pct: top10Pct,
        single_owner_pct: singleOwnerPct,
      });
    }

    return results;
  }
}
