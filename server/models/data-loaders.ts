import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";
import { DataSource } from "@shared/types/shared";

/** Called data_sources in the database. Goal is to change it to data_loaders to
 * be less ambiguous, and not overlap with the source and source detail tables.
 */
class DataLoaders {
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

  static async getSeriesLoaders(
    db: MySQLPromisePool,
    { seriesId }: { seriesId: number }
  ): Promise<DataSource[]> {
    const query = db.format(
      `
        SELECT
            id,
            series_id,
            disabled,
            universe,
            priority,
            created_at,
            updated_at,
            reload_nightly,
            pseudo_history,
            clear_before_load,
            eval,
            scale,
            presave_hook,
            color,
            runtime,
            last_run_at,
            last_run_in_seconds,
            last_error,
            last_error_at,
            dependencies,
            description
        FROM data_sources ds
        WHERE ds.series_id = ?
        `,
      [seriesId]
    );

    const response = await this._queryDB(db, query);
    return response as DataSource[];
  }
}

export { DataLoaders };
