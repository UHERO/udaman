"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { HhdbPagination } from "@/components/hhdb/hhdb-pagination";

/**
 * URL-driven pager for a catalog detail page's series table: page and size
 * live in `?page=&limit=` so the server component fetches just that slice
 * and the view is linkable / survives refresh.
 */
export function SeriesRefPager({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (next: { page: number; limit: number }) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(next.page));
    sp.set("limit", String(next.limit));
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <HhdbPagination
      page={page}
      limit={limit}
      total={total}
      onPageChange={(p) => go({ page: p, limit })}
      // New size → back to page 1 so the start row stays in range.
      onLimitChange={(l) => go({ page: 1, limit: l })}
    />
  );
}
