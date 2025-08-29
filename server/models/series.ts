"use strict";

import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";

import { NotFoundError } from "../errors";

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
  /** Fetches a single series record with associated xseries info */
  static async find(
    db: MySQLPromisePool,
    opts: { id: string }
  ): Promise<Series> {
    const sql = db.format(
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
        WHERE s.id=?`,
      [opts.id]
    );

    const rows = await this._queryDB(db, sql);
    const data = rows[0];

    if (!data) {
      throw new NotFoundError(opts.id);
    }

    return data;
  }

  /** Find a set of series */
  static async findMany(
    db: MySQLPromisePool,
    { offset, limit }: { offset?: number; limit?: number }
  ) {
    const sql = db.format(
      `
      SELECT 
        series.* 
      FROM series 
      INNER JOIN xseries ON xseries.id = series.xseries_id 
      WHERE series.universe = ? 
      ORDER BY series.created_at DESC LIMIT ?
      `,
      ["UHERO", 40]
    );

    const rows = await this._queryDB(db, sql);

    if (rows.length === 0) {
      throw new NotFoundError("No series found");
    }

    return rows;
  }
  /** Update series data */
  static async update() {}
  /** Delete series from database */
  static async delete() {}
}

export default Series;
