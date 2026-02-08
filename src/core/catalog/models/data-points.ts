import { mysql } from "@/lib/mysql/db";
import { DataPoint } from "../types/shared";

class DataPoints {
  /**
   * Gets Data points for a given series, and calculates YOY, YTD, and LVL.
   * The database contains these fields, but they appear to be unused. So we calculate
   * them on demand.
   */
  static async getBySeriesId(opts: { xseriesId: number }): Promise<DataPoint[]> {
    const { xseriesId } = opts;
    const rows = await mysql`
      WITH current_data AS (
        SELECT
          date,
          value,
          updated_at,
          pseudo_history,
          data_source_id,
          SUM(value) OVER (
            PARTITION BY YEAR(date)
            ORDER BY date
            ROWS UNBOUNDED PRECEDING
          ) AS ytd_sum,
          DATE_SUB(date, INTERVAL 1 YEAR) AS prev_year_date,
          LAG(value, 1) OVER (ORDER BY date) AS prev_value
        FROM (
          SELECT
            date,
            value,
            updated_at,
            pseudo_history,
            data_source_id,
            ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) as rn
          FROM data_points
          WHERE xseries_id = ${xseriesId} AND current = 1
        ) ranked
        WHERE rn = 1
      ),
      prev_year_data AS (
        SELECT
          date,
          value AS prev_year_value,
          SUM(value) OVER (
            PARTITION BY YEAR(date)
            ORDER BY date
            ROWS UNBOUNDED PRECEDING
          ) AS prev_ytd_sum
        FROM (
          SELECT
            date,
            value,
            updated_at,
            ROW_NUMBER() OVER (PARTITION BY date ORDER BY updated_at DESC) as rn
          FROM data_points
          WHERE xseries_id = ${xseriesId} AND current = 1
        ) ranked
        WHERE rn = 1
      )
      SELECT
        c.date,
        c.value,
        CASE
          WHEN p.prev_year_value IS NOT NULL AND p.prev_year_value != 0
          THEN (c.value / p.prev_year_value - 1) * 100
          ELSE NULL
        END AS yoy,
        CASE
          WHEN p.prev_ytd_sum IS NOT NULL AND p.prev_ytd_sum != 0
          THEN (c.ytd_sum / p.prev_ytd_sum - 1) * 100
          ELSE NULL
        END AS ytd,
        CASE
          WHEN c.prev_value IS NOT NULL
          THEN c.value - c.prev_value
          ELSE NULL
        END AS lvl_change,
        c.updated_at,
        c.pseudo_history,
        c.data_source_id as loader_id,
        ds.color
      FROM current_data c
      LEFT JOIN prev_year_data p ON c.prev_year_date = p.date
      LEFT JOIN data_sources ds ON ds.id = c.data_source_id
      ORDER BY c.date DESC
    `;

    return rows as DataPoint[];
  }
}

export default DataPoints;
