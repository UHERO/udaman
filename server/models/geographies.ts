/**********************************************************************
 * GEOGRAPHIES MODEL
 * Handles read operations for geographies
 *
 * In a series like 1Q84@HI.A, 'HI' is the geography handle.
 * indicates where the series applies to (e.g., Hawaii, US, etc.)
 **********************************************************************/

import { RowDataPacket } from "@fastify/mysql";
import { Geography, Universe } from "@shared/types/shared";
import { mysql } from "helpers/mysql";
import { queryDB } from "helpers/sql";

export interface GeographyRow extends RowDataPacket, Geography {}

export type ListOptions = {
  universe?: Universe;
};

class Geographies {
  // Retrives all geographies, optionally filtered by universe
  static async list(options: ListOptions = {}): Promise<GeographyRow[]> {
    const { universe } = options;
    const params: string[] = [];
    let whereClause = "";

    if (universe) {
      whereClause = "WHERE universe = ?";
      params.push(universe);
    }

    const query = mysql().format(
      `
        SELECT *
        FROM geographies
        ${whereClause}
        ORDER BY list_order ASC, display_name ASC
      `,
      params
    );

    return queryDB<GeographyRow>(query);
  }

  // Isolate geography by ID
  static async getById(id: number): Promise<GeographyRow | null> {
    const query = mysql().format(
      `SELECT * FROM geographies WHERE id = ? LIMIT 1`,
      [id]
    );
    const rows = await queryDB<GeographyRow>(query);
    return rows[0] || null;
  }
}

export default Geographies;
