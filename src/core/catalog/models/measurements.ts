import { mysql } from "@/lib/mysql/db";

import type { MeasurementRef } from "../types/shared";

class Measurements {
  static async getSeriesMeasurements({
    seriesId,
  }: {
    seriesId: number;
  }): Promise<MeasurementRef[]> {
    return mysql<MeasurementRef>`
      SELECT m.id, m.prefix
      FROM measurements m
      JOIN measurement_series ms ON m.id = ms.measurement_id
      WHERE ms.series_id = ${seriesId}
    `;
  }
}

export default Measurements;
