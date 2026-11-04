/** Page sizes offered by the catalog detail pages' series pager. */
export const SERIES_PAGE_LIMITS = [25, 50, 100, 250] as const;
const DEFAULT_LIMIT = 100;

export type SeriesPage = { page: number; limit: number };

/**
 * Read `?page=&limit=` from a detail page's search params. Anything malformed
 * or off-list falls back to page 1 / the default size, so a hand-edited URL
 * can't request an arbitrary row count.
 */
export function parseSeriesPage(
  sp: Record<string, string | string[] | undefined>,
): SeriesPage {
  const rawLimit = Number(sp.limit);
  const limit = (SERIES_PAGE_LIMITS as readonly number[]).includes(rawLimit)
    ? rawLimit
    : DEFAULT_LIMIT;
  const rawPage = Number(sp.page);
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  return { page, limit };
}
