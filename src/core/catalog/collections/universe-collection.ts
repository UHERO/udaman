import { mysql } from "@/lib/mysql/db";

import Universe from "../models/universe";
import type { UniverseAttrs } from "../models/universe";

class UniverseCollection {
  /** Fetch all universes */
  static async list(): Promise<Universe[]> {
    const rows = await mysql<UniverseAttrs>`
      SELECT name FROM universes ORDER BY name
    `;
    return rows.map((row) => new Universe(row));
  }

  /** Fetch a single universe by name */
  static async getByName(name: string): Promise<Universe> {
    const rows = await mysql<UniverseAttrs>`
      SELECT name FROM universes WHERE name = ${name} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Universe not found: ${name}`);
    return new Universe(row);
  }

  /** Create a new universe */
  static async create(name: string): Promise<Universe> {
    await mysql`INSERT INTO universes (name) VALUES (${name})`;
    return new Universe({ name });
  }

  /** Rename a universe (FK CASCADE propagates to referencing tables) */
  static async rename(oldName: string, newName: string): Promise<Universe> {
    await mysql`UPDATE universes SET name = ${newName} WHERE name = ${oldName}`;
    return new Universe({ name: newName });
  }

  /** Delete a universe (FK RESTRICT throws if referenced) */
  static async delete(name: string): Promise<void> {
    await mysql`DELETE FROM universes WHERE name = ${name}`;
  }
}

export default UniverseCollection;
