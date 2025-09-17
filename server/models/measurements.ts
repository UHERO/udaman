import { MySQLPromisePool } from "@fastify/mysql";
import { queryDB } from "helpers/sql";

class Measurements {
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
    const response = await queryDB(db, query);
    return response;
  }
}

export default Measurements;
