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
}
