/**
 * True when a query failed because the table does not exist
 * (MySQL/MariaDB ER_NO_SUCH_TABLE: errno 1146, SQLSTATE 42S02).
 *
 * HHDB tables whose migration is hand-applied (e.g. `mls_listings`) can ship in
 * the UI before they exist on the server. Read paths use this to degrade to an
 * empty result instead of taking the page down.
 */
export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    errno?: unknown;
    code?: unknown;
    sqlState?: unknown;
    message?: unknown;
  };
  if (Number(e.errno) === 1146) return true;
  if (e.code === "ER_NO_SUCH_TABLE") return true;
  if (e.sqlState === "42S02") return true;
  return (
    typeof e.message === "string" && /table\b.*\bdoesn't exist/i.test(e.message)
  );
}
