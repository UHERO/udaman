import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";

class Measurements {
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

  static async getSeriesMeasurements(
    db: MySQLPromisePool,
    { seriesId }: { seriesId: number }
  ) {
    const query = db.format(
      `
      SELECT m.*
      FROM measurements m
      JOIN measurement_series ms ON m.id = ms.measurement_id
      WHERE ms.series_id = ?
      `,
      [seriesId]
    );
    const response = await this._queryDB(db, query);
    return response;
  }
}

export default Measurements;
