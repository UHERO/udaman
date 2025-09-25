"use strict";

import { MySQLPromisePool } from "@fastify/mysql";
import { SeriesMetadata, Universe } from "@shared/types/shared";
import { queryDB } from "helpers/sql";

import { SeriesSummary } from "../../shared/types";
import { NotFoundError } from "../errors";
import { DataLoaders } from "./data-loaders";
import DataPoints from "./data-points";
import Measurements from "./measurements";

/** Related functions for managing series */

class Series {
  /** Create a series record */
  static async create() {}

  static async getSeriesByName(
    db: MySQLPromisePool,
    seriesName: string
  ): Promise<{
    name: string;
    id: number;
    aremos_missing: number | null;
    aremos_diff: number | null;
  }> {
    const query = db.format(
      `
      SELECT 
        s.id,
        s.name,
        x.aremos_missing,
        x.aremos_diff
      FROM series s
      JOIN xseries x ON s.xseries_id = x.id
      WHERE s.name = ?
      LIMIT 1
    `,
      [seriesName]
    );

    const response = await queryDB(db, query);
    const r = response[0];
    if (!r) throw new NotFoundError(seriesName);
    return {
      name: r.name,
      id: r.id,
      aremos_missing: r.aremos_missing,
      aremos_diff: r.aremos_diff,
    };
  }

  static async getSeriesMetadata(
    db: MySQLPromisePool,
    { id }: { id: number }
  ): Promise<SeriesMetadata> {
    // todo: remove unused fields after initial build
    const query = db.format(
      `
      SELECT 
        s.id as s_id,
        s.geography_id as s_geography_id,
        s.unit_id as s_unit_id,
        s.source_id as s_source_id,
        s.source_detail_id as s_source_detail_id,
        s.universe as s_universe,
        s.decimals as s_decimals,
        s.name as s_name,
        s.dataPortalName as s_dataPortalName,
        s.description as s_description,
        s.created_at as s_created_at,
        s.updated_at as s_updated_at,
        s.dependency_depth as s_dependency_depth,
        s.source_link as s_source_link,
        s.investigation_notes as s_investigation_notes,
        s.scratch as s_scratch,
        x.id as xs_id,
        x.primary_series_id as xs_primary_series_id,
        x.restricted as xs_restricted,
        x.quarantined as xs_quarantined,
        x.frequency as xs_frequency,
        x.seasonally_adjusted as xs_seasonally_adjusted,
        x.seasonal_adjustment as xs_seasonal_adjustment,
        x.aremos_missing as xs_aremos_missing,
        x.aremos_diff as xs_aremos_diff,
        x.mult as xs_mult,
        x.created_at as xs_created_at,
        x.updated_at as xs_updated_at,
        x.units as xs_units,
        x.percent as xs_percent,
        x.real as xs_real,
        x.base_year as xs_base_year,
        x.frequency_transform as xs_frequency_transform,
        x.last_demetra_date as xs_last_demetra_date,
        x.last_demetra_datestring as xs_last_demetra_datestring,
        x.factor_application as xs_factor_application,
        x.factors as xs_factors,
        g.handle as geo_handle, 
        g.display_name as geo_display_name,
        u.short_label as u_short_label, 
        u.long_label as u_long_label,
        src.description as source_description, 
        src.link as source_link,
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
    const response = await queryDB(db, query);
    if (response.length === 0)
      throw new NotFoundError("404 - Series not found: " + id);
    return response[0] as SeriesMetadata;
  }
  /**
   * Fetches a single series record with associated xseries, data points, and measurement.
   *
   * Used on /series/[id] page info
   * */
  static async getSeriesPageData(db: MySQLPromisePool, opts: { id: number }) {
    const { id } = opts;

    // ? Previously Ruby did them all individually. I've merged them as much as is possible
    // ? but this would be a great place to test out different loading patterns and measure perf.
    const [metadata, measurement, dataPoints, loaders] = await Promise.all([
      this.getSeriesMetadata(db, { id }),
      Measurements.getSeriesMeasurements(db, { seriesId: id }),
      DataPoints.getBySeriesId(db, { seriesId: id }),
      DataLoaders.getSeriesLoaders(db, { seriesId: id }),
    ]);

    const aliases = await this.getAliases(db, {
      sId: id,
      xsId: metadata.xs_id,
    });

    if (!metadata || !dataPoints || !measurement || !aliases || !loaders) {
      throw new NotFoundError(String(opts.id));
    }

    return {
      dataPoints,
      metadata: metadata,
      measurement: measurement,
      aliases,
      loaders,
    };
  }

  /** Fetch the the most recent 40 series to display on the homepage.
   *
   * todo: set min and max dates on the xseries table and update them when a series is loaded.
   * todo: This would allow simplifying this to a single query and avoid the data_points table.
   */
  static async getSummaryList(
    db: MySQLPromisePool,
    {
      offset,
      limit,
      universe,
    }: { offset?: number; limit?: number; universe: Universe }
  ) {
    // fetch initial data
    const mainSql = db.format(
      `
    SELECT 
      s.name as name,
      s.id as id,
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
      [universe, 40]
    );

    const mainRows = await queryDB(db, mainSql);

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

      const dateRows = await queryDB(db, dateSql);

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

    const response = await queryDB(db, sql);

    return response;
  }

  static async search(
    { text: string, limit = 10000, user = null },
    universe: { text: string; limit: number; user: null; universe: Universe }
  ) {}

  static isValidName(str: string) {
    if (!str || !str.includes("@")) return false;

    // Simplified series name validation (XXXX@XXX.X format)
    const seriesNameRegex =
      /^([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?@(\w+?)(\.([ASQMWD]))?$/i;
    return seriesNameRegex.test(str);
  }
}

export default Series;
