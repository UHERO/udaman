import { mysql } from "helpers/mysql";
import { queryDB } from "helpers/sql";

class Measurements {
  static async getSeriesMeasurements({ seriesId }: { seriesId: number }) {
    const query = mysql().format(
      `
      SELECT m.*
      FROM measurements m
      JOIN measurement_series ms ON m.id = ms.measurement_id
      WHERE ms.series_id = ?
      `,
      [seriesId]
    );
    const response = await queryDB(query);
    return response;
  }
}

export default Measurements;
