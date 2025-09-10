import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";
import { data_points } from "@prisma/client";

class DataPoints {
  static async _queryDB<T extends RowDataPacket>(
    db: MySQLPromisePool,
    queryString: string
  ): Promise<T[]> {
    try {
      const [rows] = (await db.execute(queryString)) as [T[], any];
      return rows;
    } catch (err) {
      console.log("Series query error ", err);
      throw err;
    }
  }

  /**
   * Gets Data points for a given series, and calculates YOY, YTD, and LVL.
   * The database contains these fields, but they appeare to be unused. So we calculate
   * them on demand. Alternative is to calculate them
   * {
   *  "date": Date,
   *  "value": number,
   *  "yoy": number,
   *  "ytd": number,
   *  "lvl_change": number,
   *  "updated_at": Date
   * }
   */
  static async getBySeriesId(
    db: MySQLPromisePool,
    opts: { seriesId: number }
  ): Promise<DataPoints[]> {
    const query = db.format(
      `
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
        FROM data_points dp
        WHERE xseries_id = ? AND current = 1
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
        FROM data_points
        WHERE xseries_id = ? AND current = 1
      )
      SELECT
        c.date,
        c.value,

        -- YOY (year-over-year percentage change)
        CASE
          WHEN p.prev_year_value IS NOT NULL AND p.prev_year_value != 0
          THEN (c.value / p.prev_year_value - 1) * 100
          ELSE NULL
        END AS yoy,

        -- YTD (year-to-date percentage change)
        CASE
          WHEN p.prev_ytd_sum IS NOT NULL AND p.prev_ytd_sum != 0
          THEN (c.ytd_sum / p.prev_ytd_sum - 1) * 100
          ELSE NULL
        END AS ytd,

        -- LVL (level change - absolute difference from previous period)
        CASE
          WHEN c.prev_value IS NOT NULL
          THEN c.value - c.prev_value
          ELSE NULL
        END AS lvl_change,

        c.updated_at,
        c.pseudo_history,
        ds.color
      FROM current_data c
      LEFT JOIN prev_year_data p ON c.prev_year_date = p.date
      LEFT JOIN data_sources ds ON ds.id = c.data_source_id
      ORDER BY c.date DESC
      `,
      [opts.seriesId, opts.seriesId]
    );

    const response = await this._queryDB(db, query);
    return response as DataPoints[];
  }
}

export default DataPoints;
