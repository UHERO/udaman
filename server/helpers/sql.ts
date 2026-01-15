import { RowDataPacket, ResultSetHeader } from "@fastify/mysql";
import { app } from "app";

import { BadRequestError } from "../errors";
import { mysql } from "./mysql";

/**
 * Accepts two Arguments:
 *   1. dataToUpdate: object of values to be inserted by pg into SQL query.
 *         { firstName: "Frodo", isAdmin: true },
 *   2. jsToSql: object containing properties to identify column names for update in SQL SET query.
 *          { firstName: "first_name", isAdmin: "is_admin" }
 *
 * Returns two values:
 *  1. column names as $-strings formatted to be inserted into an SQL query,
 *  2. an array of corresponding values.
 */
//provide sample input --> output
function sqlForPartialUpdate(
  dataToUpdate: Record<string, string>,
  jsToSql: Record<string, string>
) {
  const keys = Object.keys(dataToUpdate);
  if (keys.length === 0) throw new BadRequestError("No data");

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map(
    (colName, idx) => `"${jsToSql[colName] || colName}"=$${idx + 1}`
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

// For read operations (SELECT)
async function queryDB<T extends RowDataPacket>(
  queryString: string
): Promise<T[]> {
  try {
    app.log.info(queryString);
    const [rows] = (await mysql().execute(queryString)) as [T[], any];
    return rows;
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}

// For write operations (INSERT, UPDATE, DELETE)
async function executeDB(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  try {
    const conn = mysql();
    app.log.info(conn.format(sql, params));
    const [result] = await conn.execute<ResultSetHeader>(sql, params);
    return result;
  } catch (err) {
    app.log.error(err);
    throw err;
  }
}
/** Convert string containing commas to regex OR list
 * and preserves commas where not part of a list
 */
function convertCommas(string: string) {
  string.replaceAll(",,", "#FOO#");
  string.replaceAll(",", "|");
  string.replaceAll("#FOO#", ",");
  return string;
}

/**
 * Converts camelCase to snake_case
 * e.g., "dataListId" -> "data_list_id"
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/*
 * Builds the SET clause for a SQL UPDATE query
 * Auto-converts camelCase keys to snake_case column names
 * Handles boolean -> 0/1 conversion for TINYINT columns
 *
 * sample input: { name: "New Name", dataListId: 5, hidden: true }
 * sample output: { fields: ["name = ?", "data_list_id = ?", "hidden = ?"], values: ["New Name", 5, 1] }
 */
function buildSetClause<T extends Record<string, any>>(
  updates: T
): { fields: string[]; values: (string | number | null)[] } {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const column = toSnakeCase(key);
      // handle boolean fields (stored as TINYINT in db as 0/1)
      if (typeof value === "boolean") {
        fields.push(`${column} = ?`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${column} = ?`);
        values.push(value as string | number | null);
      }
    }
  }

  return { fields, values };
}

export {
  sqlForPartialUpdate,
  queryDB,
  executeDB,
  convertCommas,
  buildSetClause,
};
