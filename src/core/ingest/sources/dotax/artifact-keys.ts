/**
 * DOTAX artifact keys, shared by fetch (which names what it stores) and
 * parse (which reads the month back): `<YYYY-MM>/<file name>`, e.g.
 * `2025-12/202512collec.xlsx` or `2019-01/2019-01.zip`.
 */

export function dotaxKey(month: string, file: string): string {
  return `${month}/${file}`;
}

export function parseDotaxKey(
  key: string,
): { month: string; file: string } | null {
  const m = key.match(/^(\d{4}-\d{2})\/(.+)$/);
  return m ? { month: m[1], file: m[2] } : null;
}
