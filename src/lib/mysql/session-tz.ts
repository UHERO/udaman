/**
 * Keep NOW() on Hawaii time whatever Bun version runs the app.
 *
 * The app's convention (see @catalog/utils/time) is that DATETIME columns
 * hold HST wall-clock and NOW() is the way to stamp them, which holds as
 * long as the session time zone is the server's (SYSTEM = HST). Bun 1.4.0
 * leaves it alone, but Bun 1.4.4's MySQL driver runs
 * `SET time_zone = '+00:00'` on every new connection, and Bun gives no
 * hook to run SQL per pooled connection. Upgrading Bun would then make
 * every NOW() / CURRENT_TIMESTAMP write UTC, and TIMESTAMP columns read
 * back as UTC, 10 hours off, with no error.
 *
 * So each statement that can call NOW() runs with MariaDB's per-statement
 * override (`SET STATEMENT time_zone = 'SYSTEM' FOR …`). It is a no-op on a
 * Bun that leaves the session alone. Only DML is prefixed; DDL, SET, SHOW
 * and statements starting with a comment or "(" go through unchanged.
 */

export const SESSION_TZ_PREFIX = "SET STATEMENT time_zone = 'SYSTEM' FOR ";

const DML = /^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\b/i;

/** The statement with the time-zone override, if it is DML. */
export function withSessionTz(sql: string): string {
  return DML.test(sql) ? SESSION_TZ_PREFIX + sql.trimStart() : sql;
}

const taggedCache = new WeakMap<TemplateStringsArray, TemplateStringsArray>();

/**
 * The same for a tagged-template call: a new strings array with the
 * prefix on its first part. Cached per call site (template strings arrays
 * are identity-stable), so the driver sees one statement text per site.
 */
export function withSessionTzStrings(
  strings: TemplateStringsArray,
): TemplateStringsArray {
  const hit = taggedCache.get(strings);
  if (hit) return hit;
  let out = strings;
  if (DML.test(strings[0] ?? "")) {
    const cooked = [withSessionTz(strings[0]), ...strings.slice(1)];
    const raw = [withSessionTz(strings.raw[0]), ...strings.raw.slice(1)];
    out = Object.freeze(
      Object.assign(cooked, { raw: Object.freeze(raw) }),
    ) as unknown as TemplateStringsArray;
  }
  taggedCache.set(strings, out);
  return out;
}
