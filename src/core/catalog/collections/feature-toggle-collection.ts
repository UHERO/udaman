import { mysql } from "@/lib/mysql/db";

import FeatureToggle from "../models/feature-toggle";
import type { FeatureToggleAttrs } from "../models/feature-toggle";

class FeatureToggleCollection {
  static async list(): Promise<FeatureToggle[]> {
    const rows = await mysql<FeatureToggleAttrs>`
      SELECT * FROM feature_toggles ORDER BY universe, name
    `;
    return rows.map((row) => new FeatureToggle(row));
  }

  /**
   * Whether a toggle is on for a universe. A missing row, or a row with a
   * NULL status, falls back to `defaultValue` (Rails FeatureToggle.is_set).
   */
  static async isSet(
    name: string,
    universe: string,
    defaultValue: boolean,
  ): Promise<boolean> {
    const rows = await mysql<{ status: boolean | number | null }>`
      SELECT status FROM feature_toggles
      WHERE name = ${name} AND universe = ${universe}
      LIMIT 1
    `;
    const status = rows[0]?.status;
    return status == null ? defaultValue : Boolean(Number(status));
  }

  static async updateStatus(
    id: number,
    status: boolean,
  ): Promise<FeatureToggle> {
    await mysql`
      UPDATE feature_toggles
      SET status = ${status ? 1 : 0}, updated_at = NOW()
      WHERE id = ${id}
    `;
    const rows = await mysql<FeatureToggleAttrs>`
      SELECT * FROM feature_toggles WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Feature toggle not found: ${id}`);
    return new FeatureToggle(rows[0]);
  }
}

export default FeatureToggleCollection;
