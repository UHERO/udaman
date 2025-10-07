import { RowDataPacket } from "@fastify/mysql";
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
/** Convert string containing commas to regex OR list
 * and preserves commas where not part of a list
 */
function convertCommas(string: string) {
  string.replaceAll(",,", "#FOO#");
  string.replaceAll(",", "|");
  string.replaceAll("#FOO#", ",");
  return string;
}
export { sqlForPartialUpdate, queryDB, convertCommas };
