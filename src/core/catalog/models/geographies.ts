/**********************************************************************
 * GEOGRAPHIES MODEL
 * Handles read operations for geographies
 *
 * Pending other crud operations
 **********************************************************************/

import { mysql } from "@/lib/mysql/db";
import { Geography, Universe } from "../types/shared";

export type GeographyRow = Geography;

export type ListOptions = {
  universe?: Universe;
};

class Geographies {
  // Retrives all geographies, optionally filtered by universe
  static async list(options: ListOptions = {}): Promise<GeographyRow[]> {
    const { universe } = options;
    if (universe) {
      return mysql`
        SELECT * FROM geographies
        WHERE universe = ${universe}
        ORDER BY list_order ASC, display_name ASC
      ` as Promise<GeographyRow[]>;
    }
    return mysql`
      SELECT * FROM geographies
      ORDER BY list_order ASC, display_name ASC
    ` as Promise<GeographyRow[]>;
  }

  // Isolate geography by ID
  static async getById(id: number): Promise<GeographyRow | null> {
    const rows = await mysql`SELECT * FROM geographies WHERE id = ${id} LIMIT 1`;
    return (rows[0] as GeographyRow) || null;
  }
}

export default Geographies;
