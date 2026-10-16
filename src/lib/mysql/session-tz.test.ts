import { describe, expect, test } from "bun:test";

import {
  SESSION_TZ_PREFIX,
  withSessionTz,
  withSessionTzStrings,
} from "./session-tz";

describe("session time zone override", () => {
  test("DML is prefixed, everything else is left alone", () => {
    for (const q of [
      "SELECT NOW()",
      "  insert into t values (1)",
      "UPDATE t SET a = 1",
      "DELETE FROM t",
      "REPLACE INTO t VALUES (1)",
      "WITH x AS (SELECT 1) SELECT * FROM x",
    ]) {
      expect(withSessionTz(q)).toBe(SESSION_TZ_PREFIX + q.trimStart());
    }
    for (const q of [
      "SET time_zone = 'SYSTEM'",
      "CREATE TEMPORARY TABLE t (a INT)",
      "SHOW TABLES",
      "/* hint */ SELECT 1",
      "(SELECT 1) UNION (SELECT 2)",
    ]) {
      expect(withSessionTz(q)).toBe(q);
    }
  });

  const tag = (s: TemplateStringsArray, ..._values: unknown[]) => s;

  test("tagged templates keep their parts and get one stable array per call site", () => {
    const site = () => tag`SELECT * FROM t WHERE a = ${1} AND b = ${2}`;
    const a = withSessionTzStrings(site());
    expect([...a]).toEqual([
      `${SESSION_TZ_PREFIX}SELECT * FROM t WHERE a = `,
      " AND b = ",
      "",
    ]);
    expect(a.raw[0]).toStartWith(SESSION_TZ_PREFIX);
    expect(withSessionTzStrings(site())).toBe(a);
    const ddl = tag`CREATE TABLE x (a INT)`;
    expect(withSessionTzStrings(ddl)).toBe(ddl);
  });
});
