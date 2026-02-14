import "server-only";
import { mysql } from "./db";

/**
 * Converts camelCase to snake_case
 * e.g., "dataListId" -> "data_list_id"
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/*
 * Builds a snake_case column object for use with Bun's sql(obj, ...keys) syntax
 * Auto-converts camelCase keys to snake_case column names
 * Handles boolean -> 0/1 conversion for TINYINT columns
 *
 * sample input: { name: "New Name", dataListId: 5, hidden: true }
 * sample output: { name: "New Name", data_list_id: 5, hidden: 1 }
 *
 * Use `columnOverrides` for columns that don't follow snake_case convention,
 * e.g. { dataPortalName: "dataPortalName" } to keep the camelCase column name.
 */
function buildUpdateObject<T extends Record<string, any>>(
  updates: T,
  columnOverrides?: Record<string, string>,
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const column = columnOverrides?.[key] ?? toSnakeCase(key);
      result[column] = typeof value === "boolean" ? (value ? 1 : 0) : value;
    }
  }
  return result;
}

/** Convert string containing commas to regex OR list
 * and preserves commas where not part of a list
 */
function convertCommas(str: string) {
  str = str.replaceAll(",,", "#FOO#");
  str = str.replaceAll(",", "|");
  str = str.replaceAll("#FOO#", ",");
  return str;
}

export { mysql, buildUpdateObject, convertCommas, toSnakeCase };
