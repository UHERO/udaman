import { mysql } from "@/lib/mysql/db";

class Measurements {
  static async getSeriesMeasurements({ seriesId }: { seriesId: number }) {
    return mysql`
      SELECT m.*
      FROM measurements m
      JOIN measurement_series ms ON m.id = ms.measurement_id
      WHERE ms.series_id = ${seriesId}
    `;
  }
}

export default Measurements;
