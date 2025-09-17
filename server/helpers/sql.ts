import { MySQLPromisePool, RowDataPacket } from "@fastify/mysql";

import { BadRequestError } from "../errors";

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
  db: MySQLPromisePool,
  queryString: string
): Promise<T[]> {
  try {
    const [rows] = (await db.execute(queryString)) as [T[], any];
    return rows;
  } catch (err) {
    console.log("Series query error ", err);
    throw err;
  }
}

export { sqlForPartialUpdate, queryDB };
