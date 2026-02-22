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
