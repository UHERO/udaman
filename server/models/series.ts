"use strict";

import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";
import { series } from "@prisma/client";
import { SeriesMetadata } from "@shared/types/shared";

import { SeriesSummary } from "../../shared/types";
import { NotFoundError } from "../errors";
import DataPoints from "./data-points";
import Measurements from "./measurements";

/** Related functions for managing series */

class Series {
  /** INTERNAL USE ONLY - queries must be prepared & property escaped using db.format
   * do not pass user input to this method */
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
  /** Create a series record */
  static async create() {}

  static async getSeriesMetadata(
    db: MySQLPromisePool,
    { id }: { id: number }
  ): Promise<SeriesMetadata> {
    const query = db.format(
      `
      SELECT 
        s.*,
        x.*,
        g.handle as geo_handle, g.display_name as geo_display_name,
        u.short_label as unit_short, u.long_label as unit_long,
        src.description as source_description, src.link as source_link,
        sd.description as source_detail_description
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      LEFT JOIN geographies g ON s.geography_id = g.id  
      LEFT JOIN units u ON s.unit_id = u.id
      LEFT JOIN sources src ON s.source_id = src.id
      LEFT JOIN source_details sd ON s.source_detail_id = sd.id
      WHERE s.id = ?
    `,
      [id]
    );
    const response = await this._queryDB(db, query);
    return response[0];
  }
  /**
   * Fetches a single series record with associated xseries, data points, and measurement.
   *
   * Used on /series/[id] page info
   * */
  static async getSeriesPageData(
    db: MySQLPromisePool,
    opts: { id: number }
  ): Promise<series> {
    const { id } = opts;

    const [metadata, measurement, dataPoints] = await Promise.all([
      this.getSeriesMetadata(db, { id }),
      Measurements.getSeriesMeasurements(db, { seriesId: id }),
      DataPoints.getBySeriesId(db, { seriesId: id }),
    ]);

    const aliases = await this.getAliases(db, {
      sId: id,
      xsId: metadata.xseries_id,
    });

    if (!metadata || !dataPoints || !measurement || !aliases) {
      throw new NotFoundError(String(opts.id));
    }
    console.log({
      dataPoints,
      metadata: metadata,
      measurement: measurement,
      aliases,
    });
    return {
      dataPoints,
      metadata: metadata,
      measurement: measurement,
      aliases,
    };
  }

  /** Fetch the the most recent 40 series to display on the homepage.
   *
   * todo: set min and max dates on the xseries table and update them when a series is loaded.
   * todo: This would allow simplifying this to a single query and avoid the data_points table.
   */
  static async getSummaryList(
    db: MySQLPromisePool,
    { offset, limit }: { offset?: number; limit?: number }
  ): Promise<SeriesSummary[]> {
    // fetch initial data
    const mainSql = db.format(
      `
    SELECT 
      s.name as name,
      s.xseries_id as id,
      xs.seasonal_adjustment as seasonalAdjustment,
      s.dataPortalName as portalName,
      u.short_label as unitShortLabel,
      src.description as sourceDescription,
      src.link as sourceUrl
    FROM series s
    INNER JOIN xseries xs ON xs.id = s.xseries_id 
    LEFT JOIN units u ON u.id = s.unit_id
    LEFT JOIN sources src ON src.id = s.source_id
    WHERE s.universe = ? 
    ORDER BY s.created_at DESC 
    LIMIT ?
    `,
      ["UHERO", 40]
    );

    const mainRows = await this._queryDB(db, mainSql);

    const xseriesIds = mainRows.map((row) => row.xseries_id || row.id);

    if (xseriesIds.length > 0) {
      // Second query - get min/max dates only for the 40 series
      const dateSql = db.format(
        `
      SELECT 
        xseries_id as id,
        MIN(date) as min_date,
        MAX(date) as max_date
      FROM data_points 
      WHERE xseries_id IN (${xseriesIds.map(() => "?").join(",")})
      GROUP BY xseries_id
      `,
        xseriesIds
      );

      const dateRows = await this._queryDB(db, dateSql);

      const dateMap = new Map(dateRows.map((row) => [row.id, row]));

      const finalRows: SeriesSummary[] = mainRows.map((row) => {
        const dateInfo = dateMap.get(row.id);
        return {
          name: row.name,
          id: row.id,
          seasonalAdjustment: row.seasonalAdjustment,
          portalName: row.portalName,
          unitShortLabel: row.unitShortLabel,
          sourceDescription: row.sourceDescription,
          sourceUrl: row.sourceUrl,
          minDate: dateInfo?.min_date || null,
          maxDate: dateInfo?.max_date || null,
        };
      });

      return finalRows;
    }
    return mainRows.map((row) => ({
      name: row.name,
      id: row.id,
      seasonalAdjustment: row.seasonalAdjustment,
      portalName: row.portalName,
      unitShortLabel: row.unitShortLabel,
      sourceDescription: row.sourceDescription,
      sourceUrl: row.sourceUrl,
      minDate: null,
      maxDate: null,
    }));
  }
  /** Update series data */
  static async update() {}
  /** Delete series from database */
  static async delete() {}

  static async getAliases(
    db: MySQLPromisePool,
    opts: { sId: number; xsId: number }
  ) {
    const { sId, xsId } = opts;
    const sql = db.format(
      `
      SELECT * FROM series
      WHERE xseries_id = ?
      AND id <> ? 
      ORDER BY
      CASE 
        WHEN id = (
          SELECT primary_series_id 
          FROM xseries 
          WHERE id = ?
        ) 
        THEN 0 ELSE 1 END,
      universe`,
      [xsId, sId, xsId]
    );

    const response = await this._queryDB(db, sql);

    return response;
  }
}

export default Series;
